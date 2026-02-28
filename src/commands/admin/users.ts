import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";

export function registerUsersCommand(parent: Command): void {
  const users = parent
    .command("users")
    .description("Manage users");

  // users list
  users
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

  // users get
  users
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

  // users create
  users
    .command("create <json>")
    .description("Create a new user")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/users", {
          body,
        });
        outputResponse(response, format);
        printSuccess("User created.");
      }),
    );

  // users update
  users
    .command("update <id> <json>")
    .description("Update a user")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = parseJsonInput(String(json));
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

  // users delete
  users
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

  // users activate
  users
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

  // users deactivate
  users
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

  // users unlock
  users
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
}
