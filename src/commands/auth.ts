import { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  resolveOptions,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { loadConfig, saveConfig, getCurrentProfile } from "../config.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import { isInteractive, promptEmail, promptPassword } from "../prompt.js";
import { getTokenStatus, formatDuration } from "../token.js";
import { clientCredentialsGrant } from "../oauth.js";
import chalk from "chalk";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
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
            printError("No URL configured. Use `gdb config set url <url>` or pass --url.");
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

        // Email/password flow
        let email = process.env.GDB_EMAIL;
        let password = process.env.GDB_PASSWORD;

        if (!email || !password) {
          if (isInteractive()) {
            if (!email) email = await promptEmail();
            if (!password) password = await promptPassword();
          } else {
            printError(
              "Set GDB_EMAIL and GDB_PASSWORD environment variables, or run in a terminal for interactive login.",
            );
            process.exit(1);
          }
        }

        const client = createClient(cmd);
        const body: Record<string, string> = { email, password };
        if (loginOpts.tenantId) {
          body.tenantId = loginOpts.tenantId;
        }

        const response = await client.rawRequest("POST", "/auth/login", { body });

        const data = response.data as Record<string, unknown>;
        const token = data.token as string | undefined;
        const refreshToken = data.refreshToken as string | undefined;

        if (!token) {
          printError("No token received from server.");
          process.exit(1);
        }

        const config = loadConfig(globalOpts.profile);
        config.token = token;
        if (refreshToken) {
          config.refreshToken = refreshToken;
        }
        saveConfig(config, globalOpts.profile);

        printSuccess("Login successful. Token saved to config.");
      }),
    );

  program
    .command("logout")
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

  program
    .command("whoami")
    .description("Display current authenticated user")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const globalOpts = resolveOptions(cmd);
        const config = loadConfig(globalOpts.profile);

        if (!config.token && !config.apiKey) {
          printInfo("Not logged in. Use `gdb login` to authenticate.");
          return;
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/auth/me");
        outputResponse(response, format);

        // Show token expiry if token exists (re-read in case of auto-refresh)
        const latestConfig = loadConfig(globalOpts.profile);
        if (latestConfig.token) {
          const status = getTokenStatus(latestConfig.token);
          if (status.expiresAt) {
            if (status.isExpired) {
              console.log(chalk.red(`Token expires: ${status.expiresAt.toISOString()} (expired)`));
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
      }),
    );
}
