import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function registerRulesCommand(program: Command): void {
  const rules = program
    .command("rules")
    .description("Manage ReactiveCore rules that trigger actions based on entity changes");

  // rules list
  const list = rules
    .command("list")
    .description("List all configured rules and their current status")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};
        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);

        const response = await client.rawRequest("GET", "/rules", { params });
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all rules as JSON",
      command: "geonic rules list",
    },
    {
      description: "List rules in table format to review status at a glance",
      command: "geonic rules list --format table",
    },
    {
      description: "List with pagination",
      command: "geonic rules list --limit 50 --offset 100",
    },
  ]);

  // rules get
  const get = rules
    .command("get <id>")
    .description("Get a rule's full definition including conditions, actions, and status")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/rules/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Inspect a rule's conditions and actions",
      command: "geonic rules get <rule-id>",
    },
    {
      description: "Get a rule and check if it is active",
      command: "geonic rules get urn:ngsi-ld:Rule:high-temp-alert",
    },
  ]);

  // rules create
  const create = rules
    .command("create [json]")
    .summary("Create a new rule")
    .description(
      "Create a new rule\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "name": "high-temp-alert",\n' +
        '    "description": "Alert on high temperature",\n' +
        '    "conditions": [{"type": "celExpression", "expression": "entity.temperature > 30"}],\n' +
        '    "actions": [{"type": "webhook", "url": "http://localhost:5000/alert", "method": "POST"}]\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/rules", { body });
        outputResponse(response, format);
        printSuccess("Rule created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic rules create '{"name":"high-temp-alert","conditions":[{"type":"celExpression","expression":"entity.temperature > 30"}],"actions":[{"type":"webhook","url":"http://localhost:5000/alert","method":"POST"}]}'`,
    },
    {
      description: "Create from a file",
      command: "geonic rules create @rule.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat rule.json | geonic rules create",
    },
  ]);

  // rules update
  const update = rules
    .command("update <id> [json]")
    .summary("Update a rule")
    .description(
      "Update a rule\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        "  e.g. {\"description\": \"Updated rule\"}",
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = await parseJsonInput(json as string | undefined);
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/rules/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("Rule updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic rules update <rule-id> '{"description":"Updated rule"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic rules update <rule-id> @rule.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat rule.json | geonic rules update <rule-id>",
    },
  ]);

  // rules delete
  const del = rules
    .command("delete <id>")
    .description("Permanently delete a rule and stop its processing")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/rules/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Rule deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a rule by ID",
      command: "geonic rules delete <rule-id>",
    },
    {
      description: "Remove an obsolete alert rule",
      command: "geonic rules delete urn:ngsi-ld:Rule:old-alert",
    },
  ]);

  // rules activate
  const activate = rules
    .command("activate <id>")
    .description("Enable a rule so it begins evaluating conditions and firing actions")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/rules/${encodeURIComponent(String(id))}/activate`,
        );
        printSuccess("Rule activated.");
      }),
    );

  addExamples(activate, [
    {
      description: "Start processing a rule",
      command: "geonic rules activate <rule-id>",
    },
    {
      description: "Re-enable a previously deactivated rule",
      command: "geonic rules activate urn:ngsi-ld:Rule:high-temp-alert",
    },
  ]);

  // rules deactivate
  const deactivate = rules
    .command("deactivate <id>")
    .description("Disable a rule without deleting it, pausing condition evaluation and actions")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/rules/${encodeURIComponent(String(id))}/deactivate`,
        );
        printSuccess("Rule deactivated.");
      }),
    );

  addExamples(deactivate, [
    {
      description: "Temporarily pause a rule during maintenance",
      command: "geonic rules deactivate <rule-id>",
    },
    {
      description: "Disable a noisy alert rule without removing it",
      command: "geonic rules deactivate urn:ngsi-ld:Rule:high-temp-alert",
    },
  ]);
}
