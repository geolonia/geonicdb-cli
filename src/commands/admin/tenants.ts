import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";
import { addExamples } from "../help.js";

export function registerTenantsCommand(parent: Command): void {
  const tenants = parent
    .command("tenants")
    .description("Manage tenants");

  // tenants list
  const list = tenants
    .command("list")
    .description("List all tenants in the system, including their status and configuration")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/tenants");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all tenants",
      command: "geonic admin tenants list",
    },
    {
      description: "List tenants in table format",
      command: "geonic admin tenants list --format table",
    },
  ]);

  // tenants get
  const get = tenants
    .command("get <id>")
    .description("Get a tenant's details — name, description, status, and creation date")
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

  addExamples(get, [
    {
      description: "Get tenant details by ID",
      command: "geonic admin tenants get <tenant-id>",
    },
    {
      description: "Get tenant details in table format",
      command: "geonic admin tenants get <tenant-id> --format table",
    },
  ]);

  // tenants create
  const create = tenants
    .command("create [json]")
    .summary("Create a new tenant")
    .description(
      "Create a new tenant\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "name": "production",\n' +
        '    "description": "Production environment tenant"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/tenants", {
          body,
        });
        outputResponse(response, format);
        printSuccess("Tenant created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic admin tenants create '{"name":"my-tenant","description":"My first tenant"}'`,
    },
    {
      description: "Minimal (name only)",
      command: `geonic admin tenants create '{"name":"production"}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic admin tenants create @tenant.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat tenant.json | geonic admin tenants create",
    },
    {
      description: "Interactive mode (omit JSON argument)",
      command: "geonic admin tenants create",
    },
  ]);

  // tenants update
  const update = tenants
    .command("update <id> [json]")
    .summary("Update a tenant")
    .description(
      "Update a tenant\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"name": "new-name", "description": "Updated description"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = (await parseJsonInput(json as string | undefined)) as Record<string, unknown>;
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

  addExamples(update, [
    {
      description: "Update description with inline JSON",
      command: `geonic admin tenants update <tenant-id> '{"description":"Updated description"}'`,
    },
    {
      description: "Rename a tenant",
      command: `geonic admin tenants update <tenant-id> '{"name":"new-name"}'`,
    },
    {
      description: "Update from a JSON file",
      command: "geonic admin tenants update <tenant-id> @patch.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat patch.json | geonic admin tenants update <tenant-id>",
    },
    {
      description: "Interactive mode",
      command: "geonic admin tenants update <tenant-id>",
    },
  ]);

  // tenants delete
  const del = tenants
    .command("delete <id>")
    .description("Permanently delete a tenant and all its associated data. This action cannot be undone")
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

  addExamples(del, [
    {
      description: "Delete a tenant by ID",
      command: "geonic admin tenants delete <tenant-id>",
    },
    {
      description: "Delete with verbose output to confirm",
      command: "geonic admin tenants delete <tenant-id> --verbose",
    },
  ]);

  // tenants activate
  const activate = tenants
    .command("activate <id>")
    .description("Activate a tenant, restoring API access for all its users")
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

  addExamples(activate, [
    {
      description: "Activate a deactivated tenant",
      command: "geonic admin tenants activate <tenant-id>",
    },
  ]);

  // tenants deactivate
  const deactivate = tenants
    .command("deactivate <id>")
    .description("Deactivate a tenant, blocking API access for all its users until reactivated")
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

  addExamples(deactivate, [
    {
      description: "Deactivate a tenant to temporarily suspend access",
      command: "geonic admin tenants deactivate <tenant-id>",
    },
  ]);
}
