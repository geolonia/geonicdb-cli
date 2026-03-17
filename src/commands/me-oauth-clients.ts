import type { Command } from "commander";
import { withErrorHandler, createClient, resolveOptions, getFormat, outputResponse } from "../helpers.js";
import { loadConfig, saveConfig, validateUrl } from "../config.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import { clientCredentialsGrant } from "../oauth.js";
import { addExamples, addNotes } from "./help.js";
import { SCOPES_HELP_NOTES } from "../helpers.js";

export function addMeOAuthClientsSubcommand(me: Command): void {
  const oauthClients = me
    .command("oauth-clients")
    .description("Manage your OAuth clients");

  // oauth-clients list
  const list = oauthClients
    .command("list")
    .description("List your OAuth clients")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/me/oauth-clients");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List your OAuth clients",
      command: "geonic me oauth-clients list",
    },
  ]);

  // oauth-clients create
  const create = oauthClients
    .command("create [json]")
    .description("Create a new OAuth client")
    .option("--name <name>", "Client name")
    .option("--scopes <scopes>", "Allowed scopes (comma-separated)")
    .option("--save", "Save credentials to config for automatic re-authentication")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          scopes?: string;
          save?: boolean;
        };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.scopes) {
          // Build body from flags
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.clientName = opts.name;
          if (opts.scopes) payload.allowedScopes = opts.scopes.split(",").map((s) => s.trim());
          body = payload;
        } else {
          // Read from stdin (pipe or interactive)
          body = await parseJsonInput();
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/me/oauth-clients", { body });

        const data = response.data as Record<string, unknown>;

        if (opts.save) {
          const globalOpts = resolveOptions(cmd);
          const clientId = data.clientId as string | undefined;
          const clientSecret = data.clientSecret as string | undefined;

          if (!clientId || !clientSecret) {
            printError("Response missing clientId or clientSecret. Cannot save credentials.");
            outputResponse(response, format);
            printSuccess("OAuth client created.");
            return;
          }

          // Perform client_credentials grant to get a fresh token
          const baseUrl = validateUrl(globalOpts.url!);
          const tokenResult = await clientCredentialsGrant({
            baseUrl,
            clientId,
            clientSecret,
            scope: (data.allowedScopes as string[] | undefined)?.join(" "),
          });

          const config = loadConfig(globalOpts.profile);
          config.clientId = clientId;
          config.clientSecret = clientSecret;
          config.token = tokenResult.access_token;
          delete config.refreshToken;
          saveConfig(config, globalOpts.profile);

          printInfo("Client credentials saved to config. Auto-reauth enabled.");
        } else {
          printWarning(
            "Save the clientSecret now — it will not be shown again.",
          );
        }

        outputResponse(response, format);
        printSuccess("OAuth client created.");
      }),
    );

  addNotes(create, SCOPES_HELP_NOTES);

  addExamples(create, [
    {
      description: "Create an OAuth client with flags",
      command: "geonic me oauth-clients create --name my-ci-bot --scopes read:entities,write:entities",
    },
    {
      description: "Create and save credentials for auto-reauth",
      command: "geonic me oauth-clients create --name my-ci-bot --save",
    },
    {
      description: "Create an OAuth client from JSON",
      command: 'geonic me oauth-clients create \'{"clientName":"my-bot","allowedScopes":["read:entities"]}\'',
    },
  ]);

  // oauth-clients delete
  const del = oauthClients
    .command("delete <id>")
    .description("Delete an OAuth client")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/me/oauth-clients/${encodeURIComponent(String(id))}`,
        );
        printSuccess("OAuth client deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete an OAuth client",
      command: "geonic me oauth-clients delete <client-id>",
    },
  ]);
}
