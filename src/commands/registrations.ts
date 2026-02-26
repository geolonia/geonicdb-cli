import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";

export function registerRegistrationsCommand(program: Command): void {
  const registrations = program
    .command("registrations")
    .alias("reg")
    .description("Manage context registrations");

  // registrations list
  registrations
    .command("list")
    .description("List registrations")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .option("--count", "Include total count in response")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};
        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);
        if (cmdOpts.count) params["options"] = "count";

        const response = await client.get("/registrations", params);
        outputResponse(response, format, !!cmdOpts.count);
      }),
    );

  // registrations get
  registrations
    .command("get <id>")
    .description("Get a registration by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get(
          `/registrations/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  // registrations create
  registrations
    .command("create <json>")
    .description("Create a registration")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/registrations", data);
        outputResponse(response, format);
        printSuccess("Registration created.");
      }),
    );

  // registrations update
  registrations
    .command("update <id> <json>")
    .description("Update a registration")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const data = parseJsonInput(String(json));

          const response = await client.patch(
            `/registrations/${encodeURIComponent(String(id))}`,
            data,
          );
          outputResponse(response, format);
          printSuccess("Registration updated.");
        },
      ),
    );

  // registrations delete
  registrations
    .command("delete <id>")
    .description("Delete a registration")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(
          `/registrations/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Registration deleted.");
      }),
    );
}
