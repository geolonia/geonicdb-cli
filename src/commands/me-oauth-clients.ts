import type { Command } from "commander";
import { withErrorHandler, createClient, resolveOptions, getFormat, outputResponse } from "../helpers.js";
import { loadConfig, saveConfig, validateUrl } from "../config.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printError, printInfo, printWarning } from "../output.js";
import { clientCredentialsGrant } from "../oauth.js";
import { addExamples, addNotes } from "./help.js";

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
    .option("--policy <policyId>", "Policy ID to attach")
    .option("--save", "Save credentials to config for automatic re-authentication")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          policy?: string;
          save?: boolean;
        };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.policy) {
          // Build body from flags
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.name = opts.name;
          if (opts.policy) payload.policyId = opts.policy;
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

  addNotes(create, [
    "Use --policy to attach an existing XACML policy to the OAuth client.",
    "Manage policies with `geonic admin policies` commands.",
  ]);

  addExamples(create, [
    {
      description: "Create an OAuth client with flags",
      command: "geonic me oauth-clients create --name my-ci-bot",
    },
    {
      description: "Create with a policy attached",
      command: "geonic me oauth-clients create --name my-ci-bot --policy <policy-id>",
    },
    {
      description: "Create and save credentials for auto-reauth",
      command: "geonic me oauth-clients create --name my-ci-bot --save",
    },
    {
      description: "Create an OAuth client from JSON",
      command: 'geonic me oauth-clients create \'{"name":"my-bot","policyId":"<policy-id>"}\'',
    },
  ]);

  // oauth-clients update
  const update = oauthClients
    .command("update <clientId> [json]")
    .description("Update an OAuth client")
    .option("--name <name>", "Client name")
    .option("--description <desc>", "Client description")
    .option("--policy-id <policyId>", "Policy ID to attach (use 'null' to unbind)")
    .option("--active", "Activate the OAuth client")
    .option("--inactive", "Deactivate the OAuth client")
    .action(
      withErrorHandler(async (clientId: unknown, json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          description?: string;
          policyId?: string;
          active?: boolean;
          inactive?: boolean;
        };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.description || opts.policyId !== undefined || opts.active || opts.inactive) {
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.name = opts.name;
          if (opts.description) payload.description = opts.description;
          if (opts.policyId !== undefined) payload.policyId = opts.policyId === "null" ? null : opts.policyId;
          if (opts.active) payload.isActive = true;
          if (opts.inactive) payload.isActive = false;
          body = payload;
        } else {
          body = await parseJsonInput();
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "PATCH",
          `/me/oauth-clients/${encodeURIComponent(String(clientId))}`,
          { body },
        );
        outputResponse(response, format);
        printSuccess("OAuth client updated.");
      }),
    );

  addExamples(update, [
    {
      description: "Rename an OAuth client",
      command: "geonic me oauth-clients update <client-id> --name new-name",
    },
    {
      description: "Attach a policy",
      command: "geonic me oauth-clients update <client-id> --policy-id <policy-id>",
    },
    {
      description: "Unbind policy",
      command: "geonic me oauth-clients update <client-id> --policy-id null",
    },
    {
      description: "Deactivate an OAuth client",
      command: "geonic me oauth-clients update <client-id> --inactive",
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
