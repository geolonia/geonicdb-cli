import { createHash } from "node:crypto";
import { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  resolveOptions,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { loadConfig, saveConfig, getCurrentProfile, validateUrl } from "../config.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import { isInteractive, promptEmail, promptPassword, promptTenantSelection } from "../prompt.js";
import type { TenantChoice } from "../prompt.js";
import { getTokenStatus, formatDuration } from "../token.js";
import { clientCredentialsGrant } from "../oauth.js";
import { addExamples } from "./help.js";
import { addMeOAuthClientsSubcommand } from "./me-oauth-clients.js";
import { addMeApiKeysSubcommand } from "./me-api-keys.js";

function createLoginCommand(): Command {
  return new Command("login")
    .description("Authenticate and save token")
    .option("--client-credentials", "Use OAuth 2.0 Client Credentials flow")
    .option("--client-id <id>", "OAuth client ID")
    .option("--client-secret <secret>", "OAuth client secret")
    .option("--scope <scopes>", "OAuth scopes (space-separated)")
    .option("--tenant-id <id>", "Tenant ID for scoped authentication")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const loginOpts = cmd.opts() as {
          clientCredentials?: boolean;
          clientId?: string;
          clientSecret?: string;
          scope?: string;
          tenantId?: string;
        };
        const globalOpts = resolveOptions(cmd);

        if (loginOpts.clientCredentials) {
          const clientId = loginOpts.clientId ?? process.env.GDB_OAUTH_CLIENT_ID;
          const clientSecret = loginOpts.clientSecret ?? process.env.GDB_OAUTH_CLIENT_SECRET;

          if (!clientId || !clientSecret) {
            printError(
              "Client ID and secret are required. Use --client-id/--client-secret or GDB_OAUTH_CLIENT_ID/GDB_OAUTH_CLIENT_SECRET.",
            );
            process.exit(1);
          }

          if (!globalOpts.url) {
            printError("No URL configured. Use `geonic config set url <url>` or pass --url.");
            process.exit(1);
          }

          const result = await clientCredentialsGrant({
            baseUrl: globalOpts.url,
            clientId,
            clientSecret,
            scope: loginOpts.scope,
          });

          const config = loadConfig(globalOpts.profile);
          config.token = result.access_token;
          delete config.refreshToken;
          saveConfig(config, globalOpts.profile);

          printSuccess("Login successful (OAuth Client Credentials). Token saved to config.");
          return;
        }

        // Email/password flow (interactive only)
        if (!isInteractive()) {
          printError(
            "Interactive terminal required. Run `geonic auth login` in a terminal with TTY.",
          );
          process.exit(1);
        }

        const email = await promptEmail();
        const password = await promptPassword();

        const client = createClient(cmd);
        const body: Record<string, string> = { email, password };
        if (loginOpts.tenantId) {
          body.tenantId = loginOpts.tenantId;
        }

        const response = await client.rawRequest("POST", "/auth/login", {
          body,
          skipTenantHeader: true,
        });

        const data = response.data as Record<string, unknown>;
        let token = (data.accessToken ?? data.token) as string | undefined;
        let refreshToken = data.refreshToken as string | undefined;

        if (!token) {
          printError("No token received from server.");
          process.exit(1);
        }

        // Handle multi-tenant: show available tenants and prompt for selection
        const availableTenants = data.availableTenants as TenantChoice[] | undefined;
        const currentTenantId = data.tenantId as string | undefined;

        if (availableTenants && availableTenants.length > 1 && !loginOpts.tenantId) {
          const selectedTenantId = await promptTenantSelection(availableTenants, currentTenantId);
          if (selectedTenantId && selectedTenantId !== currentTenantId) {
            // Re-login with selected tenant
            const reloginResponse = await client.rawRequest("POST", "/auth/login", {
              body: { email, password, tenantId: selectedTenantId },
              skipTenantHeader: true,
            });
            const reloginData = reloginResponse.data as Record<string, unknown>;
            const newToken = (reloginData.accessToken ?? reloginData.token) as string | undefined;
            if (!newToken) {
              printError("Re-login failed: no token received for selected tenant.");
              process.exit(1);
            }
            token = newToken;
            refreshToken = reloginData.refreshToken as string | undefined;
          }
        }

        const config = loadConfig(globalOpts.profile);
        config.token = token;
        if (refreshToken) {
          config.refreshToken = refreshToken;
        } else {
          delete config.refreshToken;
        }
        saveConfig(config, globalOpts.profile);

        printSuccess("Login successful. Token saved to config.");
      }),
    );
}

function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Clear saved authentication token")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const globalOpts = resolveOptions(cmd);
        const config = loadConfig(globalOpts.profile);

        // Try to notify server (best effort)
        if (config.token && globalOpts.url) {
          try {
            const client = createClient(cmd);
            await client.rawRequest("POST", "/auth/logout");
          } catch {
            // Ignore errors - token may already be invalid
          }
        }

        delete config.token;
        delete config.refreshToken;
        saveConfig(config, globalOpts.profile);
        printSuccess("Logged out. Token cleared from config.");
      }),
    );
}

function createMeAction() {
  return withErrorHandler(async (...args: unknown[]) => {
    const cmd = args[args.length - 1] as Command;
    const globalOpts = resolveOptions(cmd);

    if (!globalOpts.token && !globalOpts.apiKey) {
      printInfo("Not logged in. Use `geonic auth login` to authenticate.");
      return;
    }

    const client = createClient(cmd);
    const format = getFormat(cmd);
    const response = await client.rawRequest("GET", "/me");
    outputResponse(response, format);

    // Suppress additional human-readable logs for structured formats
    if (format && format !== "table") {
      return;
    }

    // Show token expiry if token exists (re-read in case of auto-refresh)
    const latestConfig = loadConfig(globalOpts.profile);
    if (latestConfig.token) {
      const status = getTokenStatus(latestConfig.token);
      if (status.expiresAt) {
        if (status.isExpired) {
          printError(`Token expires: ${status.expiresAt.toISOString()} (expired)`);
        } else if (status.isExpiringSoon) {
          printWarning(
            `Token expires: ${status.expiresAt.toISOString()} (${formatDuration(status.remainingMs!)} remaining)`,
          );
        } else {
          printInfo(
            `Token expires: ${status.expiresAt.toISOString()} (${formatDuration(status.remainingMs!)} remaining)`,
          );
        }
      }
    }

    // Show current profile
    const profileName = globalOpts.profile ?? getCurrentProfile();
    printInfo(`Profile: ${profileName}`);
  });
}

async function fetchNonce(
  baseUrl: string,
  apiKey: string,
): Promise<{ nonce: string; challenge: string; difficulty: number }> {
  const origin = new URL(baseUrl).origin;
  const url = new URL("/auth/nonce", baseUrl).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": origin,
    },
    body: JSON.stringify({ api_key: apiKey }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Nonce request failed: ${text || `HTTP ${response.status}`}`);
  }

  return (await response.json()) as { nonce: string; challenge: string; difficulty: number };
}

function createNonceCommand(): Command {
  return new Command("nonce")
    .description("Get a nonce and PoW challenge for API key authentication")
    .option("--api-key <key>", "API key to get nonce for")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const nonceOpts = cmd.opts() as { apiKey?: string };
        const globalOpts = resolveOptions(cmd);
        const apiKey = nonceOpts.apiKey ?? globalOpts.apiKey;

        if (!apiKey) {
          printError("API key is required. Use --api-key or configure it with `geonic config set api-key <key>`.");
          process.exit(1);
        }
        if (!globalOpts.url) {
          printError("No URL configured. Use `geonic config set url <url>` or pass --url.");
          process.exit(1);
        }

        const baseUrl = validateUrl(globalOpts.url);
        const data = await fetchNonce(baseUrl, apiKey);
        const format = getFormat(cmd);
        outputResponse({ status: 200, headers: new Headers(), data }, format);
      }),
    );
}

function hasLeadingZeroBits(hash: Buffer, bits: number): boolean {
  const fullBytes = Math.floor(bits / 8);
  const remainingBits = bits % 8;
  for (let i = 0; i < fullBytes; i++) {
    if (hash[i] !== 0) return false;
  }
  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((hash[fullBytes] & mask) !== 0) return false;
  }
  return true;
}

const MAX_POW_ITERATIONS = 10_000_000;

function solvePoW(challenge: string, difficulty: number): number {
  for (let nonce = 0; nonce < MAX_POW_ITERATIONS; nonce++) {
    const hash = createHash("sha256")
      .update(`${challenge}${nonce}`)
      .digest();
    if (hasLeadingZeroBits(hash, difficulty)) return nonce;
  }
  throw new Error(`PoW could not be solved within ${MAX_POW_ITERATIONS} iterations`);
}

function createTokenExchangeCommand(): Command {
  return new Command("token-exchange")
    .description("Exchange API key for a session JWT via nonce + PoW")
    .option("--api-key <key>", "API key to exchange")
    .option("--save", "Save the obtained token to profile config")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const exchangeOpts = cmd.opts() as { apiKey?: string; save?: boolean };
        const globalOpts = resolveOptions(cmd);
        const apiKey = exchangeOpts.apiKey ?? globalOpts.apiKey;

        if (!apiKey) {
          printError("API key is required. Use --api-key or configure it with `geonic config set api-key <key>`.");
          process.exit(1);
        }
        if (!globalOpts.url) {
          printError("No URL configured. Use `geonic config set url <url>` or pass --url.");
          process.exit(1);
        }

        const baseUrl = validateUrl(globalOpts.url);
        const origin = new URL(baseUrl).origin;

        // Step 1: Get nonce
        const nonceData = await fetchNonce(baseUrl, apiKey);

        printInfo(`Nonce received. Solving PoW (difficulty=${nonceData.difficulty})...`);

        // Step 2: Solve PoW
        const powNonce = solvePoW(nonceData.challenge, nonceData.difficulty);

        // Step 3: Exchange for JWT
        const tokenUrl = new URL("/oauth/token", baseUrl).toString();
        const tokenResponse = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Origin": origin,
          },
          body: JSON.stringify({
            grant_type: "api_key",
            api_key: apiKey,
            nonce: nonceData.nonce,
            proof: String(powNonce),
          }),
        });

        if (!tokenResponse.ok) {
          const text = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${text || `HTTP ${tokenResponse.status}`}`);
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token: string;
          token_type: string;
          expires_in?: number;
        };

        if (exchangeOpts.save) {
          const config = loadConfig(globalOpts.profile);
          config.token = tokenData.access_token;
          saveConfig(config, globalOpts.profile);
          printSuccess("Token exchange successful. Token saved to config.");
        } else {
          const format = getFormat(cmd);
          outputResponse({ status: tokenResponse.status, headers: tokenResponse.headers, data: tokenData }, format);
          printSuccess("Token exchange successful.");
        }
      }),
    );
}

export function registerAuthCommands(program: Command): void {
  // auth command group with login/logout subcommands
  const auth = program
    .command("auth")
    .description("Manage authentication");

  const login = createLoginCommand();
  addExamples(login, [
    {
      description: "Interactive login (email/password prompt)",
      command: "geonic auth login",
    },
    {
      description: "Login with OAuth client credentials",
      command:
        "geonic auth login --client-credentials --client-id MY_ID --client-secret MY_SECRET",
    },
    {
      description: "Login to a specific tenant",
      command: "geonic auth login --tenant-id my-tenant",
    },
  ]);
  auth.addCommand(login);

  const logout = createLogoutCommand();
  addExamples(logout, [
    {
      description: "Clear saved authentication token",
      command: "geonic auth logout",
    },
  ]);
  auth.addCommand(logout);

  const nonce = createNonceCommand();
  addExamples(nonce, [
    {
      description: "Get a nonce for API key authentication",
      command: "geonic auth nonce --api-key gdb_abcdef...",
    },
  ]);
  auth.addCommand(nonce);

  const tokenExchange = createTokenExchangeCommand();
  addExamples(tokenExchange, [
    {
      description: "Exchange API key for a JWT and save it",
      command: "geonic auth token-exchange --api-key gdb_abcdef... --save",
    },
  ]);
  auth.addCommand(tokenExchange);

  // me command (top-level, maps to /me API endpoint)
  const me = program
    .command("me")
    .description("Display current authenticated user and manage user resources");

  // Default action: show user info when no subcommand is given
  const meInfo = me
    .command("info", { isDefault: true, hidden: true })
    .description("Display current authenticated user")
    .action(createMeAction());

  addExamples(me, [
    {
      description: "Show current user info",
      command: "geonic me",
    },
    {
      description: "List your OAuth clients",
      command: "geonic me oauth-clients list",
    },
    {
      description: "List your API keys",
      command: "geonic me api-keys list",
    },
  ]);

  addExamples(meInfo, [
    {
      description: "Show current user info",
      command: "geonic me",
    },
  ]);

  // Add me oauth-clients subcommands
  addMeOAuthClientsSubcommand(me);

  // Add me api-keys subcommands
  addMeApiKeysSubcommand(me);

  // Backward-compatible hidden aliases
  program.addCommand(createLoginCommand(), { hidden: true });
  program.addCommand(createLogoutCommand(), { hidden: true });

  const hiddenWhoami = new Command("whoami")
    .description("Display current authenticated user")
    .action(createMeAction());
  program.addCommand(hiddenWhoami, { hidden: true });
}
