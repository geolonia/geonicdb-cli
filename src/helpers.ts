import { Command, InvalidArgumentError } from "commander";
import { loadConfig, saveConfig, validateUrl } from "./config.js";
import { DryRunSignal, GdbClient, GdbClientError } from "./client.js";
import { printError, printOutput, printCount, printWarning } from "./output.js";
import type { ClientResponse, GlobalOptions, OutputFormat } from "./types.js";

/**
 * Resolve merged options from config + CLI flags.
 */
export function resolveOptions(cmd: Command): GlobalOptions {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  const config = loadConfig(opts.profile);
  return {
    url: opts.url ?? config.url,
    service: opts.service ?? config.service,
    token: opts.token ?? config.token,
    format: opts.format ?? config.format ?? "json",
    color: opts.color,
    verbose: opts.verbose,
    profile: opts.profile,
    apiKey: opts.apiKey ?? process.env.GDB_API_KEY ?? config.apiKey,
    dryRun: opts.dryRun,
  };
}

/**
 * Create a GdbClient from resolved options.
 */
export function createClient(cmd: Command): GdbClient {
  const opts = resolveOptions(cmd);
  if (!opts.url) {
    printError("No URL configured. Use `geonic config set url <url>` or pass --url.");
    process.exit(1);
  }
  opts.url = validateUrl(opts.url);
  const cliOpts = cmd.optsWithGlobals() as GlobalOptions;
  const usingCliToken = !!cliOpts.token;
  const config = loadConfig(opts.profile);
  return new GdbClient({
    baseUrl: opts.url,
    service: opts.service,
    token: opts.token,
    refreshToken: usingCliToken ? undefined : config.refreshToken,
    clientId: usingCliToken ? undefined : config.clientId,
    clientSecret: usingCliToken ? undefined : config.clientSecret,
    apiKey: opts.apiKey,
    onTokenRefresh: usingCliToken
      ? undefined
      : (token, refreshToken) => {
          const cfg = loadConfig(opts.profile);
          cfg.token = token;
          if (refreshToken) cfg.refreshToken = refreshToken;
          saveConfig(cfg, opts.profile);
        },
    onBeforeRefresh: usingCliToken
      ? undefined
      : () => {
          const cfg = loadConfig(opts.profile);
          return { token: cfg.token, refreshToken: cfg.refreshToken };
        },
    verbose: opts.verbose,
    dryRun: opts.dryRun,
  });
}

/**
 * Get the output format from resolved options.
 */
export function getFormat(cmd: Command): OutputFormat {
  const opts = resolveOptions(cmd);
  return opts.format as OutputFormat;
}

/**
 * Standard handler for outputting API responses.
 */
export function outputResponse(
  response: ClientResponse,
  format: OutputFormat,
  showCount?: boolean,
): void {
  if (showCount && response.count !== undefined) {
    printCount(response.count);
  }
  if (response.data !== undefined && response.data !== "") {
    printOutput(response.data, format);
  }
}

/**
 * Commander.js option parser for `--limit` / `--offset` style flags.
 * Rejects non-integer or negative values with InvalidArgumentError so
 * Commander surfaces a clear failure before the request is built.
 */
export function parseNonNegativeInt(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError("Must be a non-negative integer.");
  }
  return Number(value);
}

/**
 * Build a pagination query-param record from parsed CLI options.
 * Centralizes the limit/offset → string conversion shared by every list command.
 */
export function buildPaginationParams(opts: {
  limit?: number;
  offset?: number;
}): Record<string, string> {
  const params: Record<string, string> = {};
  if (opts.limit !== undefined) params["limit"] = String(opts.limit);
  if (opts.offset !== undefined) params["offset"] = String(opts.offset);
  return params;
}

/** Server-side maximum page size for admin/me list endpoints (ADMIN_MAX_LIMIT). */
const LIST_PAGE_SIZE = 100;

function parseTotalCount(headers: Headers): number | undefined {
  const raw = headers.get("X-Total-Count");
  if (raw === null) return undefined;
  const total = Number(raw);
  return Number.isInteger(total) && total >= 0 ? total : undefined;
}

/**
 * Fetch a paginated list endpoint (admin/me APIs).
 *
 * Without explicit --limit/--offset the server returns only its default page
 * (20 items) with no indication that more exist, so "list" commands would
 * silently truncate. Instead, follow X-Total-Count and aggregate every page.
 * With explicit flags, issue a single request as-is and warn on stderr when
 * the result is only a slice of the total.
 */
export async function fetchPaginatedList(
  client: GdbClient,
  path: string,
  opts: { limit?: number; offset?: number },
  extraParams: Record<string, string> = {},
): Promise<ClientResponse> {
  if (opts.limit !== undefined || opts.offset !== undefined) {
    const response = await client.rawRequest("GET", path, {
      params: { ...extraParams, ...buildPaginationParams(opts) },
    });
    const total = parseTotalCount(response.headers);
    if (total !== undefined && Array.isArray(response.data)) {
      const offset = opts.offset ?? 0;
      const remaining = total - offset - response.data.length;
      if (remaining > 0) {
        printWarning(
          `Showing ${response.data.length} of ${total} results. ${remaining} more available (use --offset ${offset + response.data.length}).`,
        );
      }
    }
    return response;
  }

  const items: unknown[] = [];
  let firstResponse: ClientResponse | undefined;
  let offset = 0;
  for (;;) {
    const response = await client.rawRequest("GET", path, {
      params: { ...extraParams, limit: String(LIST_PAGE_SIZE), offset: String(offset) },
    });
    // Endpoint doesn't return a collection — pass the response through untouched.
    if (!Array.isArray(response.data)) return response;
    firstResponse ??= response;
    items.push(...response.data);
    offset += response.data.length;
    const total = parseTotalCount(response.headers);
    if (
      response.data.length === 0 ||
      response.data.length < LIST_PAGE_SIZE ||
      (total !== undefined && offset >= total)
    ) {
      break;
    }
  }
  return { ...firstResponse!, data: items };
}

/**
 * Wrap an async command handler with error handling.
 */
export function withErrorHandler<T extends unknown[]>(fn: (...args: T) => Promise<void>) {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      if (err instanceof DryRunSignal) {
        return;
      }
      if (err instanceof GdbClientError && err.status === 401) {
        printError("Authentication failed. Please re-authenticate (e.g., `geonic auth login` or check your API key).");
      } else if (err instanceof GdbClientError && err.status === 403 && /not assigned to any tenant|invalid token/i.test(err.message)) {
        printError("Authentication failed. Please re-authenticate (e.g., `geonic auth login` or check your API key).");
      } else if (err instanceof GdbClientError && err.status === 403) {
        const detail = (err.ngsiError?.detail ?? err.ngsiError?.description ?? "").toLowerCase();
        if (detail.includes("entity type") || detail.includes("allowedentitytypes")) {
          printError(`Entity type restriction: ${err.message}`);
        } else {
          printError(err.message);
        }
      } else if (err instanceof GdbClientError && err.status === 409) {
        // 409 AlreadyExists — サーバのメッセージに違反した一意制約名が含まれる (#136)
        printError(err.message);
        if (/violates unique constraint/i.test(err.message)) {
          printWarning("Hint: inspect the model's unique constraints with `geonic models get <type>`.");
        }
      } else if (err instanceof Error) {
        printError(err.message);
      } else {
        printError(String(err));
      }
      process.exit(1);
    }
  };
}
