import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GdbClient } from "./client.js";

const PLATFORM_TOKEN_PATH = "/auth/platform-token";
const EXECUTE_API_SERVICE = "execute-api";

export class PlatformLoginError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PlatformLoginError";
  }
}

/** Read `region` from ~/.aws/config (or AWS_CONFIG_FILE) for the given profile. */
export function regionFromAwsConfig(profile: string): string | undefined {
  const configPath = process.env.AWS_CONFIG_FILE ?? join(homedir(), ".aws", "config");
  if (!existsSync(configPath)) return undefined;

  let text: string;
  try {
    text = readFileSync(configPath, "utf-8");
  } catch {
    return undefined;
  }

  const wanted = profile === "default" ? "default" : `profile ${profile}`;
  let inSection = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;
    const section = line.match(/^\[(.+)]$/);
    if (section) {
      inSection = section[1].trim() === wanted;
      continue;
    }
    if (!inSection) continue;
    const kv = line.match(/^region\s*=\s*(.+)$/i);
    if (kv) {
      const value = kv[1].trim();
      return value.length > 0 ? value : undefined;
    }
  }
  return undefined;
}

/**
 * Region resolution per DESIGN: --aws-region → AWS_REGION → profile → fail-fast.
 * AWS_DEFAULT_REGION is intentionally ignored (near-miss: must not silently satisfy).
 */
export function resolveAwsRegion(opts: {
  awsRegion?: string;
  awsProfile?: string;
}): string {
  if (opts.awsRegion && opts.awsRegion.trim()) return opts.awsRegion.trim();
  if (process.env.AWS_REGION && process.env.AWS_REGION.trim()) {
    return process.env.AWS_REGION.trim();
  }
  const profile = opts.awsProfile ?? process.env.AWS_PROFILE ?? "default";
  const fromProfile = regionFromAwsConfig(profile);
  if (fromProfile) return fromProfile;
  throw new PlatformLoginError(
    "AWS region is required. Pass --aws-region, set AWS_REGION, or set region in the AWS profile.",
  );
}

/** Mask SigV4 Authorization (and session token) for dry-run curl output. */
export function maskSigV4Headers(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "authorization" && value.startsWith("AWS4-HMAC-SHA256")) {
      out[key] = "AWS4-HMAC-SHA256 <redacted>";
    } else if (lower === "x-amz-security-token") {
      out[key] = "<redacted>";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function joinPlatformTokenUrl(baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}${PLATFORM_TOKEN_PATH}`;
}

export interface PlatformTokenSuccess {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  user?: { id?: string; role?: string; tenantId?: string | null };
}

export interface PlatformLoginRequestOptions {
  baseUrl: string;
  region: string;
  awsProfile?: string;
  dryRun?: boolean;
  /** Injected for tests — skips real AWS credential chain / network. */
  fetchImpl?: typeof fetch;
  signRequest?: (input: {
    url: URL;
    region: string;
    awsProfile?: string;
  }) => Promise<Record<string, string>>;
}

async function defaultSignRequest(input: {
  url: URL;
  region: string;
  awsProfile?: string;
}): Promise<Record<string, string>> {
  // Dynamic import — keep AWS SDK off the general CLI startup path (DESIGN).
  const [{ SignatureV4 }, { Sha256 }, credProviders] = await Promise.all([
    import("@smithy/signature-v4"),
    import("@aws-crypto/sha256-js"),
    import("@aws-sdk/credential-providers"),
  ]);

  const credentials = input.awsProfile
    ? credProviders.fromIni({ profile: input.awsProfile })
    : credProviders.fromNodeProviderChain();

  const signer = new SignatureV4({
    credentials,
    region: input.region,
    service: EXECUTE_API_SERVICE,
    sha256: Sha256,
  });

  const headers: Record<string, string> = {
    host: input.url.host,
    "content-type": "application/json",
  };

  const signed = await signer.sign({
    method: "POST",
    protocol: input.url.protocol,
    hostname: input.url.hostname,
    ...(input.url.port ? { port: Number(input.url.port) } : {}),
    path: `${input.url.pathname}${input.url.search}`,
    headers,
    body: "",
  });

  return signed.headers as Record<string, string>;
}

/**
 * SigV4-sign POST /auth/platform-token and return the platform_admin token body.
 * On dry-run, prints a curl with masked Authorization and throws DryRunSignal via caller.
 */
export async function requestPlatformToken(
  opts: PlatformLoginRequestOptions,
): Promise<{ dryRunCurl?: string; data?: PlatformTokenSuccess }> {
  const urlString = joinPlatformTokenUrl(opts.baseUrl);
  const url = new URL(urlString);
  const sign = opts.signRequest ?? defaultSignRequest;
  const signedHeaders = await sign({
    url,
    region: opts.region,
    awsProfile: opts.awsProfile,
  });

  if (opts.dryRun) {
    const masked = maskSigV4Headers(signedHeaders);
    const curl = GdbClient.buildCurlCommand("POST", urlString, masked, "");
    return { dryRunCurl: curl };
  }

  // Node fetch forbids / ignores Host; signature still covered host via signing.
  const fetchHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(signedHeaders)) {
    if (key.toLowerCase() === "host") continue;
    fetchHeaders[key] = value;
  }

  const fetchImpl = opts.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(urlString, {
      method: "POST",
      headers: fetchHeaders,
      body: "",
    });
  } catch (err) {
    throw new PlatformLoginError(
      err instanceof Error ? err.message : String(err),
    );
  }

  if (response.status === 403) {
    throw new PlatformLoginError("許可された IAM 呼び出し元ではない", 403);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new PlatformLoginError(
      text || `HTTP ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as PlatformTokenSuccess;
  if (!data.accessToken) {
    throw new PlatformLoginError("No accessToken received from server.");
  }
  return { data };
}
