import { Command } from "commander";
import { loadConfig, saveConfig, validateUrl } from "./config.js";
import { DryRunSignal, GdbClient, GdbClientError } from "./client.js";
import { printError, printOutput, printCount } from "./output.js";
import type { ClientResponse, GlobalOptions, OutputFormat } from "./types.js";

/**
 * Valid scope values for --scopes option help text (OAuth clients).
 */
export const SCOPES_HELP_NOTES = [
  "Valid scopes:",
  "  read:entities, write:entities, read:subscriptions, write:subscriptions,",
  "  read:registrations, write:registrations, read:rules, write:rules,",
  "  read:custom-data-models, write:custom-data-models,",
  "  admin:users, admin:tenants, admin:policies, admin:oauth-clients,",
  "  admin:api-keys, admin:metrics",
  "",
  "admin:X implies both read:X and write:X.",
  "write:X does NOT imply read:X — specify both if needed.",
];

/**
 * Valid scope values for --scopes option help text (API keys).
 */
export const API_KEY_SCOPES_HELP_NOTES = [
  "Valid scopes:",
  "  read:entities, write:entities, read:subscriptions, write:subscriptions,",
  "  read:registrations, write:registrations",
];

/**
 * Valid permission values for --permissions option.
 */
export const VALID_PERMISSIONS = new Set(["read", "write", "create", "update", "delete"]);

/**
 * Parse and validate --permissions flag value.
 * Returns the parsed array or calls process.exit(1) on invalid input.
 */
export function parsePermissions(raw: string): string[] {
  const permissions = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (permissions.length === 0 || permissions.some((p) => !VALID_PERMISSIONS.has(p))) {
    printError("--permissions must be a comma-separated list of: read, write, create, update, delete");
    process.exit(1);
  }
  return permissions;
}

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
      } else if (err instanceof GdbClientError && err.status === 403) {
        const detail = (err.ngsiError?.detail ?? err.ngsiError?.description ?? "").toLowerCase();
        if (detail.includes("entity type") || detail.includes("allowedentitytypes")) {
          printError(`Entity type restriction: ${err.message}`);
        } else {
          printError(err.message);
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
