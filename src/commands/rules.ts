import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function registerRulesCommand(program: Command): void {
  const rules = program
    .command("rules")
    .description("Manage rule engine");

  // rules list
  const list = rules
    .command("list")
    .description("List all rules")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/rules");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all rules",
      command: "geonic rules list",
    },
  ]);

  // rules get
  const get = rules
    .command("get <id>")
    .description("Get a rule by ID")
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
      description: "Get a specific rule",
      command: "geonic rules get <rule-id>",
    },
  ]);

  // rules create
  const create = rules
    .command("create [json]")
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
    .description("Delete a rule")
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
      description: "Delete a rule",
      command: "geonic rules delete <rule-id>",
    },
  ]);

  // rules activate
  const activate = rules
    .command("activate <id>")
    .description("Activate a rule")
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
      description: "Activate a rule",
      command: "geonic rules activate <rule-id>",
    },
  ]);

  // rules deactivate
  const deactivate = rules
    .command("deactivate <id>")
    .description("Deactivate a rule")
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
      description: "Deactivate a rule",
      command: "geonic rules deactivate <rule-id>",
    },
  ]);
}
