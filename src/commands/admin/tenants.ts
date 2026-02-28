import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";

export function registerTenantsCommand(parent: Command): void {
  const tenants = parent
    .command("tenants")
    .description("Manage tenants");

  // tenants list
  tenants
    .command("list")
    .description("List all tenants")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/tenants");
        outputResponse(response, format);
      }),
    );

  // tenants get
  tenants
    .command("get <id>")
    .description("Get a tenant by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/admin/tenants/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  // tenants create
  tenants
    .command("create <json>")
    .description("Create a new tenant")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/tenants", {
          body,
        });
        outputResponse(response, format);
        printSuccess("Tenant created.");
      }),
    );

  // tenants update
  tenants
    .command("update <id> <json>")
    .description("Update a tenant")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = parseJsonInput(String(json));
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/admin/tenants/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("Tenant updated.");
        },
      ),
    );

  // tenants delete
  tenants
    .command("delete <id>")
    .description("Delete a tenant")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/admin/tenants/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Tenant deleted.");
      }),
    );

  // tenants activate
  tenants
    .command("activate <id>")
    .description("Activate a tenant")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/tenants/${encodeURIComponent(String(id))}/activate`,
        );
        printSuccess("Tenant activated.");
      }),
    );

  // tenants deactivate
  tenants
    .command("deactivate <id>")
    .description("Deactivate a tenant")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/tenants/${encodeURIComponent(String(id))}/deactivate`,
        );
        printSuccess("Tenant deactivated.");
      }),
    );
}
