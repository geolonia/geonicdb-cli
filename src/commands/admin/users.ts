import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
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
    .description("List all users")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/users");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all users",
      command: "geonic admin users list",
    },
  ]);

  // users get
  const get = users
    .command("get <id>")
    .description("Get a user by ID")
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
      description: "Get a user by ID",
      command: "geonic admin users get <user-id>",
    },
  ]);

  // users create
  const create = users
    .command("create [json]")
    .description(
      "Create a new user\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "email": "user@example.com",\n' +
        '    "password": "SecurePassword123!",\n' +
        '    "role": "super_admin"\n' +
        "  }",
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
      description: "Create with inline JSON",
      command: `geonic admin users create '{"email":"user@example.com","password":"SecurePassword123!","role":"super_admin"}'`,
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
    .description("Delete a user")
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
      description: "Delete a user",
      command: "geonic admin users delete <user-id>",
    },
  ]);

  // users activate
  const activate = users
    .command("activate <id>")
    .description("Activate a user")
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
      description: "Activate a user",
      command: "geonic admin users activate <user-id>",
    },
  ]);

  // users deactivate
  const deactivate = users
    .command("deactivate <id>")
    .description("Deactivate a user")
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
      description: "Deactivate a user",
      command: "geonic admin users deactivate <user-id>",
    },
  ]);

  // users unlock
  const unlock = users
    .command("unlock <id>")
    .description("Unlock a user")
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
