import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";
import { addExamples } from "../help.js";

export function registerPoliciesCommand(parent: Command): void {
  const policies = parent
    .command("policies")
    .description("Manage XACML access control policies");

  // policies list
  const list = policies
    .command("list")
    .description("List all access control policies, showing their status and priority")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/policies");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all policies",
      command: "geonic admin policies list",
    },
    {
      description: "List policies in table format for an overview",
      command: "geonic admin policies list --format table",
    },
  ]);

  // policies get
  const get = policies
    .command("get <id>")
    .description("Get a policy's full details — target rules, effect, priority, and status")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/admin/policies/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Inspect a policy's rules and target configuration",
      command: "geonic admin policies get <policy-id>",
    },
  ]);

  // policies create
  const create = policies
    .command("create [json]")
    .summary("Create a new policy")
    .description(
      "Create a new policy\n\n" +
        "JSON payload examples:\n\n" +
        "  Allow all entities:\n" +
        "  {\n" +
        '    "description": "Allow all entities",\n' +
        '    "rules": [{"ruleId": "allow-all", "effect": "Permit"}]\n' +
        "  }\n\n" +
        "  Allow GET access to a specific entity type:\n" +
        "  {\n" +
        '    "description": "Allow GET access to Landmark entities",\n' +
        '    "target": {\n' +
        '      "resources": [{"attributeId": "entityType", "matchValue": "Landmark"}],\n' +
        '      "actions": [{"attributeId": "method", "matchValue": "GET"}]\n' +
        "    },\n" +
        '    "rules": [{"ruleId": "permit-get", "effect": "Permit"}]\n' +
        "  }\n\n" +
        "Target fields:\n" +
        "  subjects   — attributeId: role, userId, email, tenantId\n" +
        "  resources  — attributeId: path, entityType, entityId, entityOwner, tenantService, servicePath\n" +
        "  actions    — attributeId: method (GET, POST, PATCH, DELETE)\n\n" +
        "Each element: {attributeId, matchValue, matchFunction?}\n" +
        "  matchFunction: \"string-equal\" (default) | \"string-regexp\" | \"glob\"\n\n" +
        "Priority: smaller value = higher precedence (e.g. priority 10 overrides user default at 100).\n" +
        "  tenant_admin: minimum priority 10. user self-service (/me/policies): fixed at 100.\n\n" +
        "Default role policies (priority 100):\n" +
        "  user → /v2/** and /ngsi-ld/** all methods Permit; other data APIs GET only\n" +
        "  api_key → all Deny, anonymous → all Deny",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/policies", {
          body,
        });
        outputResponse(response, format);
        printSuccess("Policy created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic admin policies create '{"description":"Allow all entities","rules":[{"ruleId":"allow-all","effect":"Permit"}]}'`,
    },
    {
      description: "Create with target (entity type + method)",
      command: `geonic admin policies create '{"description":"Allow GET Landmark","target":{"resources":[{"attributeId":"entityType","matchValue":"Landmark"}],"actions":[{"attributeId":"method","matchValue":"GET"}]},"rules":[{"ruleId":"permit-get","effect":"Permit"}]}'`,
    },
    {
      description: "Create anonymous access policy",
      command: `geonic admin policies create '{"policyId":"public-read","target":{"subjects":[{"attributeId":"role","matchValue":"anonymous"}],"resources":[{"attributeId":"entityType","matchValue":"WeatherObserved"}],"actions":[{"attributeId":"method","matchValue":"GET"}]},"rules":[{"effect":"Permit"}]}'`,
    },
    {
      description: "Create servicePath-based policy (glob match)",
      command: `geonic admin policies create '{"description":"Allow read on /opendata/**","priority":100,"target":{"resources":[{"attributeId":"servicePath","matchValue":"/opendata/**","matchFunction":"glob"}],"actions":[{"attributeId":"method","matchValue":"GET"}]},"rules":[{"effect":"Permit"}]}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic admin policies create @policy.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat policy.json | geonic admin policies create",
    },
  ]);

  // policies update
  const update = policies
    .command("update <id> [json]")
    .summary("Update a policy")
    .description(
      "Update a policy\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"description": "Updated policy"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = await parseJsonInput(json as string | undefined);
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/admin/policies/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("Policy updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic admin policies update <policy-id> '{"description":"Updated policy"}'`,
    },
    {
      description: "Update from a JSON file",
      command: "geonic admin policies update <policy-id> @policy.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat policy.json | geonic admin policies update <policy-id>",
    },
  ]);

  // policies delete
  const del = policies
    .command("delete <id>")
    .description("Delete a policy. Users or API keys referencing this policy will lose the access it granted")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/admin/policies/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Policy deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a policy by ID",
      command: "geonic admin policies delete <policy-id>",
    },
  ]);

  // policies activate
  const activate = policies
    .command("activate <id>")
    .description("Activate a policy so its access control rules are enforced")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/policies/${encodeURIComponent(String(id))}/activate`,
        );
        printSuccess("Policy activated.");
      }),
    );

  addExamples(activate, [
    {
      description: "Enable a policy to start enforcing its rules",
      command: "geonic admin policies activate <policy-id>",
    },
  ]);

  // policies deactivate
  const deactivate = policies
    .command("deactivate <id>")
    .description("Deactivate a policy, suspending its rules without deleting it")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/policies/${encodeURIComponent(String(id))}/deactivate`,
        );
        printSuccess("Policy deactivated.");
      }),
    );

  addExamples(deactivate, [
    {
      description: "Temporarily disable a policy without deleting it",
      command: "geonic admin policies deactivate <policy-id>",
    },
  ]);
}
