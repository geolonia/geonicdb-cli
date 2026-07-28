import type { Command } from "commander";
import type { ClientResponse } from "../../types.js";
import { withErrorHandler, createClient, getFormat, outputResponse, parseNonNegativeInt, fetchPaginatedList } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess, printTemporaryPasswordBox } from "../../output.js";
import { addExamples } from "../help.js";

/** Response shape carrying a server-issued temporary password (geonicdb#1532). */
interface TemporaryPasswordResponse {
  temporaryPassword?: unknown;
  expiresAt?: unknown;
}

/**
 * Emit a temporary-password response consistently for both invite-create and
 * reset-password. The full response goes to stdout (so scripts can capture the
 * value, matching the API-key command), and the password is highlighted on
 * stderr. Fails loudly *before* printing success if the server did not return a
 * usable temporary password, so a "success" line is never followed by a crash.
 */
function emitTemporaryPassword(
  response: ClientResponse<TemporaryPasswordResponse>,
  format: ReturnType<typeof getFormat>,
  successMessage: string,
): void {
  outputResponse(response, format);
  const temporaryPassword = response.data?.temporaryPassword;
  if (typeof temporaryPassword !== "string") {
    throw new Error(
      "Server did not return a temporary password; the account may not be in a forced-reset state.",
    );
  }
  const expiresAt =
    typeof response.data?.expiresAt === "string" ? response.data.expiresAt : undefined;
  printSuccess(successMessage);
  printTemporaryPasswordBox(temporaryPassword, expiresAt);
}

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

        const response = await fetchPaginatedList(client, "/admin/users", cmd.opts());
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
        "By default the password from the JSON 'password' field is set directly and\n" +
        "the account is active immediately.\n\n" +
        "Use --force-reset to instead issue a server-generated one-time temporary\n" +
        "password: the user is forced to set a new password on their first login\n" +
        "(single-shot). In that mode do NOT provide a 'password' field (the server\n" +
        "generates it); the temporary password is displayed once.\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "email": "user@example.com",\n' +
        '    "password": "SecurePassword123!",\n' +
        '    "role": "tenant_admin",\n' +
        '    "primaryTenantId": "<tenant-id>"\n' +
        "  }\n\n" +
        "Roles: super_admin, tenant_admin, user\n" +
        "primaryTenantId is required for tenant_admin and user roles.",
    )
    .option(
      "--force-reset",
      "Issue a server-generated temporary password and force a change on first login (omit 'password')",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const forceReset = Boolean(cmd.opts().forceReset);

        if (!forceReset) {
          // 従来動作 (非破壊): JSON の password を直接設定し、強制変更なしで有効化する。
          const response = await client.rawRequest("POST", "/admin/users", { body });
          outputResponse(response, format);
          printSuccess("User created.");
          return;
        }

        // 招待モード (--force-reset): サーバーが一時パスワードを生成する。
        // JSON ペイロードはオブジェクトである必要がある (配列/文字列を spread すると
        // {"0": ...} のような不正なボディになるため、送信前に弾く)。
        if (typeof body !== "object" || body === null || Array.isArray(body)) {
          throw new Error("JSON payload must be an object.");
        }
        // password の同梱は禁止 (サーバーも 400 を返すが、送信前に fail fast する)。
        const createBody = { ...(body as Record<string, unknown>) };
        if (createBody.password !== undefined) {
          throw new Error(
            "--force-reset issues a server-generated temporary password; do not include a 'password' field.",
          );
        }
        createBody.passwordResetRequired = true;

        const response = await client.rawRequest<TemporaryPasswordResponse>(
          "POST",
          "/admin/users",
          { body: createBody },
        );
        emitTemporaryPassword(response, format, "User created (forced password reset).");
      }),
    );

  addExamples(create, [
    {
      description: "Create a tenant admin with a password",
      command: `geonic admin users create '{"email":"admin@example.com","password":"SecurePass12345!","role":"tenant_admin","primaryTenantId":"<tenant-id>"}'`,
    },
    {
      description: "Invite a user (server issues a one-time temporary password)",
      command: `geonic admin users create --force-reset '{"email":"user@example.com","role":"user","primaryTenantId":"<tenant-id>"}'`,
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

  // users reset-password
  const resetPassword = users
    .command("reset-password <id>")
    .summary("Issue a one-time temporary password for a user")
    .description(
      "Issue a one-time temporary password for an existing user and force a\n" +
        "password change on their next login (single-shot, geonicdb#1532).\n\n" +
        "The temporary password is displayed once and cannot be retrieved again.\n" +
        "It expires after a fixed validity window (7 days by default). Existing\n" +
        "password-derived sessions are revoked; API keys and OAuth clients are kept.\n\n" +
        "Permissions: super_admin can reset any user; tenant_admin can reset users\n" +
        "in their own tenant.",
    )
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest<TemporaryPasswordResponse>(
          "POST",
          `/admin/users/${encodeURIComponent(String(id))}/reset-password`,
        );
        emitTemporaryPassword(response, format, "Temporary password issued.");
      }),
    );

  addExamples(resetPassword, [
    {
      description: "Issue a temporary password for a user",
      command: "geonic admin users reset-password <user-id>",
    },
    {
      description: "Show the response in JSON format",
      command: "geonic admin users reset-password <user-id> --format json",
    },
  ]);
}
