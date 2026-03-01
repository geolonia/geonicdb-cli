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
    .description("List all tenants")
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
  ]);

  // tenants get
  const get = tenants
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

  addExamples(get, [
    {
      description: "Get a tenant by ID",
      command: "geonic admin tenants get <tenant-id>",
    },
  ]);

  // tenants create
  const create = tenants
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

  addExamples(create, [
    {
      description: "Create a tenant from a JSON file",
      command: "geonic admin tenants create @tenant.json",
    },
  ]);

  // tenants update
  const update = tenants
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

  addExamples(update, [
    {
      description: "Update a tenant from a JSON file",
      command: "geonic admin tenants update <tenant-id> @tenant.json",
    },
  ]);

  // tenants delete
  const del = tenants
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

  addExamples(del, [
    {
      description: "Delete a tenant",
      command: "geonic admin tenants delete <tenant-id>",
    },
  ]);

  // tenants activate
  const activate = tenants
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

  addExamples(activate, [
    {
      description: "Activate a tenant",
      command: "geonic admin tenants activate <tenant-id>",
    },
  ]);

  // tenants deactivate
  const deactivate = tenants
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

  addExamples(deactivate, [
    {
      description: "Deactivate a tenant",
      command: "geonic admin tenants deactivate <tenant-id>",
    },
  ]);
}
