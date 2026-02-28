import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";

export function registerPoliciesCommand(parent: Command): void {
  const policies = parent
    .command("policies")
    .description("Manage policies");

  // policies list
  policies
    .command("list")
    .description("List all policies")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/policies");
        outputResponse(response, format);
      }),
    );

  // policies get
  policies
    .command("get <id>")
    .description("Get a policy by ID")
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

  // policies create
  policies
    .command("create <json>")
    .description("Create a new policy")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/policies", {
          body,
        });
        outputResponse(response, format);
        printSuccess("Policy created.");
      }),
    );

  // policies update
  policies
    .command("update <id> <json>")
    .description("Update a policy")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = parseJsonInput(String(json));
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

  // policies delete
  policies
    .command("delete <id>")
    .description("Delete a policy")
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

  // policies activate
  policies
    .command("activate <id>")
    .description("Activate a policy")
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

  // policies deactivate
  policies
    .command("deactivate <id>")
    .description("Deactivate a policy")
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
}
