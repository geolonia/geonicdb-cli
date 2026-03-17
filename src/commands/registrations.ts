import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function registerRegistrationsCommand(program: Command): void {
  const registrations = program
    .command("registrations")
    .alias("reg")
    .description("Manage context registrations");

  // registrations list
  const list = registrations
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
        if (cmdOpts.count) params["count"] = "true";

        const response = await client.get("/csourceRegistrations", params);
        outputResponse(response, format, !!cmdOpts.count);
      }),
    );

  addExamples(list, [
    {
      description: "List all registrations",
      command: "geonic registrations list",
    },
    {
      description: "List with pagination",
      command: "geonic registrations list --limit 10",
    },
  ]);

  // registrations get
  const get = registrations
    .command("get <id>")
    .description("Get a registration by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get(
          `/csourceRegistrations/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get registration by ID",
      command:
        "geonic registrations get urn:ngsi-ld:ContextSourceRegistration:001",
    },
  ]);

  // registrations create
  const create = registrations
    .command("create [json]")
    .description(
      "Create a registration\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "type": "ContextSourceRegistration",\n' +
        '    "information": [{"entities": [{"type": "Room"}]}],\n' +
        '    "endpoint": "http://localhost:4000/source"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/csourceRegistrations", data);
        outputResponse(response, format);
        printSuccess("Registration created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`,
    },
    {
      description: "Create from a file",
      command: "geonic registrations create @registration.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat registration.json | geonic registrations create",
    },
  ]);

  // registrations update
  const regUpdate = registrations
    .command("update <id> [json]")
    .description("Update a registration")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const data = await parseJsonInput(json as string | undefined);

          const response = await client.patch(
            `/csourceRegistrations/${encodeURIComponent(String(id))}`,
            data,
          );
          outputResponse(response, format);
          printSuccess("Registration updated.");
        },
      ),
    );

  addExamples(regUpdate, [
    {
      description: "Update endpoint",
      command: `geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001 '{"endpoint":"http://localhost:5000/source"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001 @registration.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat registration.json | geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001",
    },
  ]);

  // registrations delete
  const del = registrations
    .command("delete <id>")
    .description("Delete a registration")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(
          `/csourceRegistrations/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Registration deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a registration",
      command:
        "geonic registrations delete urn:ngsi-ld:ContextSourceRegistration:001",
    },
  ]);
}
