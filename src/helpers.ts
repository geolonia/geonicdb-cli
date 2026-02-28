import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.js";
import { GdbClient, GdbClientError } from "./client.js";
import { printError, printOutput, printCount } from "./output.js";
import type { ApiVersion, ClientResponse, GlobalOptions, OutputFormat } from "./types.js";

/**
 * Resolve merged options from config + CLI flags.
 */
export function resolveOptions(cmd: Command): GlobalOptions {
  const opts = cmd.optsWithGlobals() as GlobalOptions;
  const config = loadConfig(opts.profile);
  return {
    url: opts.url ?? config.url,
    service: opts.service ?? config.service,
    servicePath: opts.servicePath ?? config.servicePath,
    api: opts.api ?? config.api ?? "v2",
    token: opts.token ?? config.token,
    format: opts.format ?? config.format ?? "json",
    color: opts.color,
    verbose: opts.verbose,
    profile: opts.profile,
    apiKey: opts.apiKey ?? process.env.GDB_API_KEY ?? config.apiKey,
  };
}

/**
 * Create a GdbClient from resolved options.
 */
export function createClient(cmd: Command): GdbClient {
  const opts = resolveOptions(cmd);
  if (!opts.url) {
    printError("No URL configured. Use `gdb config set url <url>` or pass --url.");
    process.exit(1);
  }
  const cliOpts = cmd.optsWithGlobals() as GlobalOptions;
  const usingCliToken = !!cliOpts.token;
  const config = loadConfig(opts.profile);
  return new GdbClient({
    baseUrl: opts.url,
    service: opts.service,
    servicePath: opts.servicePath,
    api: opts.api as ApiVersion,
    token: opts.token,
    refreshToken: usingCliToken ? undefined : config.refreshToken,
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withErrorHandler(fn: (...args: any[]) => Promise<void>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (...args: any[]) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      if (err instanceof GdbClientError && err.status === 401) {
        printError("Authentication failed. Please run `gdb login` to re-authenticate.");
      } else if (err instanceof Error) {
        printError(err.message);
      } else {
        printError(String(err));
      }
      process.exit(1);
    }
  };
}
