import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { GdbClient } from "./client.js";

const PLATFORM_TOKEN_PATH = "/auth/platform-token";
const EXECUTE_API_SERVICE = "execute-api";
/** Refuse pathological ~/.aws/config before parsing into memory. */
const AWS_CONFIG_MAX_BYTES = 1_048_576;
const AWS_REGION_RE = /^[a-z0-9-]+$/;

export const PLATFORM_TOKEN_FORBIDDEN_MESSAGE =
  "許可された IAM 呼び出し元ではない（署名・region・資格情報の不正でも 403 になりうる）";

export class PlatformLoginError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PlatformLoginError";
  }
}

/** Strip AWS INI inline comments (`#` / `;`). */
export function stripIniInlineComment(line: string): string {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "#" || ch === ";") return line.slice(0, i).trimEnd();
  }
  return line;
}

/** Collapse whitespace so `[profile  ops]` matches profile `ops`. */
export function normalizeIniSectionName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function assertValidAwsRegion(region: string): string {
  if (!AWS_REGION_RE.test(region)) {
    throw new PlatformLoginError(
      `Invalid AWS region "${region}". Expected lowercase letters, digits, and hyphens only (e.g. ap-northeast-1).`,
    );
  }
  return region;
}

/** Read `region` from ~/.aws/config (or AWS_CONFIG_FILE) for the given profile. */
export function regionFromAwsConfig(profile: string): string | undefined {
  const configPath = process.env.AWS_CONFIG_FILE ?? join(homedir(), ".aws", "config");
  if (!existsSync(configPath)) return undefined;

  try {
    const size = statSync(configPath).size;
    if (size > AWS_CONFIG_MAX_BYTES) return undefined;
  } catch {
    return undefined;
  }

  let text: string;
  try {
    text = readFileSync(configPath, "utf-8");
  } catch {
    return undefined;
  }

  const wanted =
    profile === "default" ? "default" : normalizeIniSectionName(`profile ${profile}`);
  let inSection = false;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = stripIniInlineComment(rawLine).trim();
    if (!line) continue;
    const section = line.match(/^\[(.+)]$/);
    if (section) {
      inSection = normalizeIniSectionName(section[1]) === wanted;
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
  let region: string | undefined;
  if (opts.awsRegion && opts.awsRegion.trim()) {
    region = opts.awsRegion.trim();
  } else if (process.env.AWS_REGION && process.env.AWS_REGION.trim()) {
    region = process.env.AWS_REGION.trim();
  } else {
    const profile = opts.awsProfile ?? process.env.AWS_PROFILE ?? "default";
    region = regionFromAwsConfig(profile);
  }
  if (!region) {
    throw new PlatformLoginError(
      "AWS region is required. Pass --aws-region, set AWS_REGION, or set region in the AWS profile.",
    );
  }
  return assertValidAwsRegion(region);
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
  expiresIn?: number;
  tokenType: string;
  user: { id?: string; role: string; tenantId?: string | null; email?: string };
}

/** Validate POST /auth/platform-token 200 body (L1). */
export function parsePlatformTokenResponse(raw: unknown): PlatformTokenSuccess {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new PlatformLoginError("Invalid platform-token response: expected a JSON object.");
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.accessToken !== "string" || data.accessToken.length === 0) {
    throw new PlatformLoginError("Invalid platform-token response: accessToken must be a non-empty string.");
  }
  if (data.tokenType !== "Bearer") {
    throw new PlatformLoginError('Invalid platform-token response: tokenType must be "Bearer".');
  }
  const user = data.user;
  if (user === null || typeof user !== "object" || Array.isArray(user)) {
    throw new PlatformLoginError("Invalid platform-token response: user object is required.");
  }
  const role = (user as Record<string, unknown>).role;
  if (role !== "platform_admin") {
    throw new PlatformLoginError(
      'Invalid platform-token response: user.role must be "platform_admin".',
    );
  }
  let expiresIn: number | undefined;
  if (data.expiresIn !== undefined && data.expiresIn !== null) {
    if (typeof data.expiresIn !== "number" || !Number.isFinite(data.expiresIn)) {
      throw new PlatformLoginError("Invalid platform-token response: expiresIn must be a number when present.");
    }
    expiresIn = data.expiresIn;
  }
  return {
    accessToken: data.accessToken,
    tokenType: "Bearer",
    user: user as PlatformTokenSuccess["user"],
    ...(expiresIn !== undefined ? { expiresIn } : {}),
  };
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

export async function defaultSignRequest(input: {
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

  try {
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
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new PlatformLoginError(
      "Failed to obtain AWS credentials for SigV4 signing. " +
        "If you use AWS IAM Identity Center (SSO), run `aws sso login`" +
        (input.awsProfile ? ` --profile ${input.awsProfile}` : "") +
        ". Otherwise check AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, " +
        "`~/.aws/credentials`, or pass --aws-profile. " +
        `Detail: ${detail}`,
    );
  }
}

/**
 * SigV4-sign POST /auth/platform-token and return the platform_admin token body.
 * On dry-run, returns a curl with masked Authorization (caller prints it).
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
      redirect: "error",
    });
  } catch (err) {
    if (err instanceof PlatformLoginError) throw err;
    throw new PlatformLoginError(err instanceof Error ? err.message : String(err));
  }

  if (response.status === 403) {
    throw new PlatformLoginError(PLATFORM_TOKEN_FORBIDDEN_MESSAGE, 403);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new PlatformLoginError(text || `HTTP ${response.status}`, response.status);
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new PlatformLoginError("Invalid platform-token response: body is not JSON.");
  }
  return { data: parsePlatformTokenResponse(raw) };
}
