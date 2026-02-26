import { createRequire } from "node:module";
import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { printInfo } from "../output.js";

export function registerHealthCommand(program: Command): void {
  program
    .command("health")
    .description("Check the health status of the server")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.rawRequest("GET", "/health");
        outputResponse(response, format);
      }),
    );
}

export function registerVersionCommand(program: Command): void {
  program
    .command("version")
    .description("Display CLI and server version information")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const require = createRequire(import.meta.url);
        const pkg = require("../../package.json") as { version: string };
        const cliVersion = pkg.version;

        printInfo(`CLI version: ${cliVersion}`);

        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.rawRequest("GET", "/version");
        printInfo("Server version:");
        outputResponse(response, format);
      }),
    );
}
