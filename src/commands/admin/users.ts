import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse, parseNonNegativeInt, buildPaginationParams } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";
import { addExamples } from "../help.js";

export function registerUsersCommand(parent: Command): void {
  const users = parent
    .command("users")
    .description("Manage users");

  // users list
  const list = users
    .command("list")
    .description("List all users across tenants, showing email, role, and status")
    .option("--limit <n>", "Maximum number of results", parseNonNegativeInt)
    .option("--offset <n>", "Skip N results", parseNonNegativeInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const params = buildPaginationParams(cmd.opts());

        const response = await client.rawRequest("GET", "/admin/users", { params });
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all users",
      command: "geonic admin users list",
    },
    {
      description: "List users in table format",
      command: "geonic admin users list --format table",
    },
    {
      description: "List users for a specific tenant",
      command: "geonic admin users list --service <tenant-id>",
    },
    {
      description: "List with pagination",
      command: "geonic admin users list --limit 50 --offset 100",
    },
  ]);

  // users get
  const get = users
    .command("get <id>")
    .description("Get a user's details — email, role, tenant, status, and login history")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/admin/users/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Inspect a user's account details",
      command: "geonic admin users get <user-id>",
    },
    {
      description: "Get user details in table format",
      command: "geonic admin users get <user-id> --format table",
    },
  ]);

  // users create
  const create = users
    .command("create [json]")
    .summary("Create a new user")
    .description(
      "Create a new user\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "email": "user@example.com",\n' +
        '    "password": "SecurePassword123!",\n' +
        '    "role": "tenant_admin",\n' +
        '    "tenantId": "<tenant-id>"\n' +
        "  }\n\n" +
        "Roles: super_admin, tenant_admin, user\n" +
        "tenantId is required for tenant_admin and user roles.",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/users", {
          body,
        });
        outputResponse(response, format);
        printSuccess("User created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create a tenant admin",
      command: `geonic admin users create '{"email":"admin@example.com","password":"SecurePass12345!","role":"tenant_admin","tenantId":"<tenant-id>"}'`,
    },
    {
      description: "Create a user for a tenant",
      command: `geonic admin users create '{"email":"user@example.com","password":"SecurePass12345!","role":"user","tenantId":"<tenant-id>"}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic admin users create @user.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat user.json | geonic admin users create",
    },
  ]);

  // users update
  const update = users
    .command("update <id> [json]")
    .summary("Update a user")
    .description(
      "Update a user\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"role": "admin"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = await parseJsonInput(json as string | undefined);
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/admin/users/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("User updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update role with inline JSON",
      command: `geonic admin users update <user-id> '{"role":"admin"}'`,
    },
    {
      description: "Update from a JSON file",
      command: "geonic admin users update <user-id> @user.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat user.json | geonic admin users update <user-id>",
    },
  ]);

  // users delete
  const del = users
    .command("delete <id>")
    .description("Permanently delete a user account. This revokes all access and cannot be undone")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/admin/users/${encodeURIComponent(String(id))}`,
        );
        printSuccess("User deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a user by ID",
      command: "geonic admin users delete <user-id>",
    },
    {
      description: "Delete with verbose output",
      command: "geonic admin users delete <user-id> --verbose",
    },
  ]);

  // users activate
  const activate = users
    .command("activate <id>")
    .description("Activate a user account, allowing them to log in and access the API")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/users/${encodeURIComponent(String(id))}/activate`,
        );
        printSuccess("User activated.");
      }),
    );

  addExamples(activate, [
    {
      description: "Activate a deactivated user",
      command: "geonic admin users activate <user-id>",
    },
  ]);

  // users deactivate
  const deactivate = users
    .command("deactivate <id>")
    .description("Deactivate a user account, preventing login until reactivated")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/users/${encodeURIComponent(String(id))}/deactivate`,
        );
        printSuccess("User deactivated.");
      }),
    );

  addExamples(deactivate, [
    {
      description: "Deactivate a user to suspend their access",
      command: "geonic admin users deactivate <user-id>",
    },
  ]);

  // users unlock
  const unlock = users
    .command("unlock <id>")
    .description("Unlock a user account that was locked due to repeated failed login attempts")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "POST",
          `/admin/users/${encodeURIComponent(String(id))}/unlock`,
        );
        printSuccess("User unlocked.");
      }),
    );

  addExamples(unlock, [
    {
      description: "Unlock a locked user account",
      command: "geonic admin users unlock <user-id>",
    },
  ]);
}
