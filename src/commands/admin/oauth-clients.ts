import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";

export function registerOAuthClientsCommand(parent: Command): void {
  const oauthClients = parent
    .command("oauth-clients")
    .description("Manage OAuth clients");

  // oauth-clients list
  oauthClients
    .command("list")
    .description("List all OAuth clients")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/oauth-clients");
        outputResponse(response, format);
      }),
    );

  // oauth-clients get
  oauthClients
    .command("get <id>")
    .description("Get an OAuth client by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/admin/oauth-clients/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  // oauth-clients create
  oauthClients
    .command("create <json>")
    .description("Create a new OAuth client")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/oauth-clients", {
          body,
        });
        outputResponse(response, format);
        printSuccess("OAuth client created.");
      }),
    );

  // oauth-clients update
  oauthClients
    .command("update <id> <json>")
    .description("Update an OAuth client")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = parseJsonInput(String(json));
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/admin/oauth-clients/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("OAuth client updated.");
        },
      ),
    );

  // oauth-clients delete
  oauthClients
    .command("delete <id>")
    .description("Delete an OAuth client")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/admin/oauth-clients/${encodeURIComponent(String(id))}`,
        );
        printSuccess("OAuth client deleted.");
      }),
    );
}

export function registerCaddeCommand(parent: Command): void {
  const cadde = parent
    .command("cadde")
    .description("Manage CADDE configuration");

  // cadde get
  cadde
    .command("get")
    .description("Get CADDE configuration")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/cadde");
        outputResponse(response, format);
      }),
    );

  // cadde set
  cadde
    .command("set <json>")
    .description("Set CADDE configuration")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("PUT", "/admin/cadde", {
          body,
        });
        outputResponse(response, format);
        printSuccess("CADDE configuration set.");
      }),
    );

  // cadde delete
  cadde
    .command("delete")
    .description("Delete CADDE configuration")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest("DELETE", "/admin/cadde");
        printSuccess("CADDE configuration deleted.");
      }),
    );
}
