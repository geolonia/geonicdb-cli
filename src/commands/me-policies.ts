import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples, addNotes } from "./help.js";

export function addMePoliciesSubcommand(me: Command): void {
  const policies = me
    .command("policies")
    .description("Manage your personal XACML policies");

  // policies list
  const list = policies
    .command("list")
    .description("List your personal policies")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/me/policies");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List your personal policies",
      command: "geonic me policies list",
    },
    {
      description: "List in table format for a quick overview",
      command: "geonic me policies list --format table",
    },
  ]);

  // policies get
  const get = policies
    .command("get <policyId>")
    .description("Get a personal policy by ID to inspect its XACML rules and target resources")
    .action(
      withErrorHandler(async (policyId: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/me/policies/${encodeURIComponent(String(policyId))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get a personal policy by ID",
      command: "geonic me policies get <policy-id>",
    },
    {
      description: "Inspect policy rules and permitted actions",
      command: "geonic me policies get my-readonly --format table",
    },
  ]);

  // policies create
  const create = policies
    .command("create [json]")
    .description(
      "Create a personal XACML policy\n\n" +
        "Constraints (enforced server-side):\n" +
        "  - priority is fixed at 100 (user role minimum)\n" +
        "  - scope is 'personal' — not applied tenant-wide\n" +
        "  - target is required\n" +
        "  - data API paths only (/v2/**, /ngsi-ld/** etc.)\n\n" +
        "Example — GET-only policy for /v2/**:\n" +
        "  {\n" +
        '    "policyId": "my-readonly",\n' +
        '    "target": {\n' +
        '      "resources": [{"attributeId": "path", "matchValue": "/v2/**", "matchFunction": "glob"}]\n' +
        "    },\n" +
        '    "rules": [\n' +
        '      {"ruleId": "allow-get", "effect": "Permit", "target": {"actions": [{"attributeId": "method", "matchValue": "GET"}]}},\n' +
        '      {"ruleId": "deny-others", "effect": "Deny"}\n' +
        "    ]\n" +
        "  }",
    )
    .option("--policy-id <id>", "Policy ID (auto-generated UUID if omitted)")
    .option("--description <text>", "Policy description")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as { policyId?: string; description?: string };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.policyId || opts.description) {
          const payload: Record<string, unknown> = {};
          if (opts.policyId) payload.policyId = opts.policyId;
          if (opts.description) payload.description = opts.description;
          body = payload;
        } else {
          body = await parseJsonInput();
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/me/policies", { body });
        outputResponse(response, format);
        printSuccess("Policy created.");
      }),
    );

  addNotes(create, [
    "priority is always set to 100 by the server regardless of the value you specify.",
    "Bind the policy to an API key or OAuth client with `geonic me api-keys update --policy-id` or `geonic me oauth-clients update --policy-id`.",
  ]);

  addExamples(create, [
    {
      description: "Create a GET-only policy from inline JSON",
      command: `geonic me policies create '{"policyId":"my-readonly","target":{"resources":[{"attributeId":"path","matchValue":"/v2/**","matchFunction":"glob"}]},"rules":[{"ruleId":"allow-get","effect":"Permit","target":{"actions":[{"attributeId":"method","matchValue":"GET"}]}},{"ruleId":"deny-others","effect":"Deny"}]}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic me policies create @policy.json",
    },
    {
      description: "Create from stdin",
      command: "cat policy.json | geonic me policies create",
    },
  ]);

  // policies update
  const update = policies
    .command("update <policyId> [json]")
    .description("Update a personal policy (partial update)")
    .option("--description <text>", "Policy description")
    .action(
      withErrorHandler(async (policyId: unknown, json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as { description?: string };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.description) {
          body = { description: opts.description };
        } else {
          body = await parseJsonInput();
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "PATCH",
          `/me/policies/${encodeURIComponent(String(policyId))}`,
          { body },
        );
        outputResponse(response, format);
        printSuccess("Policy updated.");
      }),
    );

  addExamples(update, [
    {
      description: "Update policy rules",
      command: `geonic me policies update <policy-id> '{"rules":[{"ruleId":"allow-get","effect":"Permit"}]}'`,
    },
    {
      description: "Update from a JSON file",
      command: "geonic me policies update <policy-id> @patch.json",
    },
  ]);

  // policies delete
  const del = policies
    .command("delete <policyId>")
    .description("Delete a personal policy — any API key or OAuth client bound to it loses its access restrictions")
    .action(
      withErrorHandler(async (policyId: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/me/policies/${encodeURIComponent(String(policyId))}`,
        );
        printSuccess("Policy deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a personal policy by ID",
      command: "geonic me policies delete <policy-id>",
    },
    {
      description: "Remove a policy (unbind from API keys/OAuth clients first)",
      command: "geonic me policies delete my-readonly",
    },
  ]);
}
