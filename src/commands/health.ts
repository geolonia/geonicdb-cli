import { createRequire } from "node:module";
import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { printInfo } from "../output.js";
import { addExamples } from "./help.js";

export function registerHealthCommand(program: Command): void {
  const health = program
    .command("health")
    .description("Check Context Broker connectivity and health status")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.rawRequest("GET", "/health");
        outputResponse(response, format);
      }),
    );

  addExamples(health, [
    {
      description: "Check server health",
      command: "geonic health",
    },
    {
      description: "Check health with table output",
      command: "geonic health --format table",
    },
    {
      description: "Check health of a specific server",
      command: "geonic health --url https://api.example.com",
    },
  ]);
}

export function registerVersionCommand(program: Command): void {
  const version = program
    .command("version")
    .description("Display both CLI and server version information")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const require = createRequire(import.meta.url);
        const pkg = require("../package.json") as { version: string };
        const cliVersion = pkg.version;

        printInfo(`CLI version: ${cliVersion}`);

        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.rawRequest("GET", "/version");
        printInfo("Server version:");
        outputResponse(response, format);
      }),
    );

  addExamples(version, [
    {
      description: "Show CLI and server version",
      command: "geonic version",
    },
    {
      description: "Show version as JSON",
      command: "geonic version --format json",
    },
  ]);
}
