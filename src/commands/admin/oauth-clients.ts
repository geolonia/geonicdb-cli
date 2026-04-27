import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../../helpers.js";
import { parseJsonInput } from "../../input.js";
import { printSuccess } from "../../output.js";
import { addExamples } from "../help.js";

export function registerOAuthClientsCommand(parent: Command): void {
  const oauthClients = parent
    .command("oauth-clients")
    .description("Manage OAuth clients");

  // oauth-clients list
  const list = oauthClients
    .command("list")
    .description("List all registered OAuth clients and their configurations")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};
        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);

        const response = await client.rawRequest("GET", "/admin/oauth-clients", { params });
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all OAuth clients",
      command: "geonic admin oauth-clients list",
    },
    {
      description: "List OAuth clients in table format",
      command: "geonic admin oauth-clients list --format table",
    },
    {
      description: "List with pagination",
      command: "geonic admin oauth-clients list --limit 50 --offset 100",
    },
  ]);

  // oauth-clients get
  const get = oauthClients
    .command("get <id>")
    .description("Get an OAuth client's details — name, client ID, policy, and redirect URIs")
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

  addExamples(get, [
    {
      description: "Inspect an OAuth client's configuration",
      command: "geonic admin oauth-clients get <client-id>",
    },
  ]);

  // oauth-clients create
  const create = oauthClients
    .command("create [json]")
    .summary("Create a new OAuth client")
    .description(
      "Create a new OAuth client\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "name": "my-app",\n' +
        '    "policyId": "<policy-id>"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/oauth-clients", {
          body,
        });
        outputResponse(response, format);
        printSuccess("OAuth client created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic admin oauth-clients create '{"name":"my-app","policyId":"<policy-id>"}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic admin oauth-clients create @client.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat client.json | geonic admin oauth-clients create",
    },
  ]);

  // oauth-clients update
  const update = oauthClients
    .command("update <id> [json]")
    .summary("Update an OAuth client")
    .description(
      "Update an OAuth client\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"description": "Updated client"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = await parseJsonInput(json as string | undefined);
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

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic admin oauth-clients update <client-id> '{"description":"Updated client"}'`,
    },
    {
      description: "Update from a JSON file",
      command: "geonic admin oauth-clients update <client-id> @client.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat client.json | geonic admin oauth-clients update <client-id>",
    },
  ]);

  // oauth-clients delete
  const del = oauthClients
    .command("delete <id>")
    .description("Delete an OAuth client. Existing tokens issued by this client will be invalidated")
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

  addExamples(del, [
    {
      description: "Delete an OAuth client by ID",
      command: "geonic admin oauth-clients delete <client-id>",
    },
  ]);
}

export function registerCaddeCommand(parent: Command): void {
  const cadde = parent
    .command("cadde")
    .description("Manage CADDE (data exchange) configuration for cross-platform data sharing");

  // cadde get
  const caddeGet = cadde
    .command("get")
    .description("Get the current CADDE data exchange configuration (provider, endpoint, etc.)")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/admin/cadde");
        outputResponse(response, format);
      }),
    );

  addExamples(caddeGet, [
    {
      description: "View current CADDE configuration",
      command: "geonic admin cadde get",
    },
    {
      description: "View CADDE configuration in table format",
      command: "geonic admin cadde get --format table",
    },
  ]);

  // cadde set
  const caddeSet = cadde
    .command("set [json]")
    .summary("Set CADDE configuration")
    .description(
      "Set CADDE configuration\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "provider": "my-provider",\n' +
        '    "endpoint": "http://localhost:6000"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("PUT", "/admin/cadde", {
          body,
        });
        outputResponse(response, format);
        printSuccess("CADDE configuration set.");
      }),
    );

  addExamples(caddeSet, [
    {
      description: "Set with inline JSON",
      command: `geonic admin cadde set '{"provider":"my-provider","endpoint":"http://localhost:6000"}'`,
    },
    {
      description: "Set from a JSON file",
      command: "geonic admin cadde set @cadde-config.json",
    },
    {
      description: "Set from stdin pipe",
      command: "cat cadde-config.json | geonic admin cadde set",
    },
  ]);

  // cadde delete
  const caddeDelete = cadde
    .command("delete")
    .description("Remove the CADDE data exchange configuration, disabling cross-platform data sharing")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest("DELETE", "/admin/cadde");
        printSuccess("CADDE configuration deleted.");
      }),
    );

  addExamples(caddeDelete, [
    {
      description: "Remove CADDE configuration",
      command: "geonic admin cadde delete",
    },
  ]);
}
