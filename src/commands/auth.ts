import { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { loadConfig, saveConfig } from "../config.js";
import { printSuccess, printError, printInfo } from "../output.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Authenticate and save token")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;

        const email = process.env.GDB_EMAIL;
        const password = process.env.GDB_PASSWORD;

        if (!email || !password) {
          printError(
            "Set GDB_EMAIL and GDB_PASSWORD environment variables to log in.",
          );
          process.exit(1);
        }

        const client = createClient(cmd);
        const response = await client.rawRequest("POST", "/auth/tokens", {
          body: { email, password },
        });

        const data = response.data as Record<string, unknown>;
        const token = data.token as string | undefined;
        const refreshToken = data.refreshToken as string | undefined;

        if (!token) {
          printError("No token received from server.");
          process.exit(1);
        }

        const config = loadConfig(profile);
        config.token = token;
        if (refreshToken) {
          config.refreshToken = refreshToken;
        }
        saveConfig(config, profile);

        printSuccess("Login successful. Token saved to config.");
      }),
    );

  program
    .command("logout")
    .description("Clear saved authentication token")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;

        const config = loadConfig(profile);
        delete config.token;
        delete config.refreshToken;
        saveConfig(config, profile);
        printSuccess("Logged out. Token cleared from config.");
      }),
    );

  program
    .command("whoami")
    .description("Display current authenticated user")
    .action(
      withErrorHandler(async (...args: unknown[]) => {
        const cmd = args[args.length - 1] as Command;
        const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;

        const config = loadConfig(profile);
        if (!config.token) {
          printInfo("Not logged in. Use `gdb login` to authenticate.");
          return;
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/auth/me");
        outputResponse(response, format);
      }),
    );
}
