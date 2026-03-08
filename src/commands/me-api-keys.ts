import type { Command } from "commander";
import { withErrorHandler, createClient, resolveOptions, getFormat, outputResponse } from "../helpers.js";
import { loadConfig, saveConfig } from "../config.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printError, printWarning } from "../output.js";
import { addExamples } from "./help.js";

export function addMeApiKeysSubcommand(me: Command): void {
  const apiKeys = me
    .command("api-keys")
    .description("Manage your API keys");

  // api-keys list
  const list = apiKeys
    .command("list")
    .description("List your API keys")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/me/api-keys");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List your API keys",
      command: "geonic me api-keys list",
    },
  ]);

  // api-keys create
  const create = apiKeys
    .command("create [json]")
    .description("Create a new API key")
    .option("--name <name>", "Key name")
    .option("--scopes <scopes>", "Allowed scopes (comma-separated)")
    .option("--origins <origins>", "Allowed origins (comma-separated)")
    .option("--entity-types <types>", "Allowed entity types (comma-separated)")
    .option("--rate-limit <n>", "Rate limit per minute")
    .option("--save", "Save the API key to config for automatic use")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          scopes?: string;
          origins?: string;
          entityTypes?: string;
          rateLimit?: string;
          save?: boolean;
        };

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.scopes || opts.origins || opts.entityTypes || opts.rateLimit) {
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.name = opts.name;
          if (opts.scopes) payload.allowedScopes = opts.scopes.split(",").map((s: string) => s.trim());
          if (opts.origins) payload.allowedOrigins = opts.origins.split(",").map((s: string) => s.trim());
          if (opts.entityTypes) payload.allowedEntityTypes = opts.entityTypes.split(",").map((s: string) => s.trim());
          if (opts.rateLimit) payload.rateLimit = { perMinute: parseInt(opts.rateLimit, 10) };
          body = payload;
        } else {
          body = await parseJsonInput();
        }

        // Validate allowedOrigins is not empty (Issue #58)
        if (opts.origins !== undefined && opts.origins.trim() === "") {
          printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
          process.exit(1);
        }
        if (body && typeof body === "object" && "allowedOrigins" in (body as Record<string, unknown>)) {
          const origins = (body as Record<string, unknown>).allowedOrigins;
          if (Array.isArray(origins) && origins.length === 0) {
            printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
            process.exit(1);
          }
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/me/api-keys", { body });

        const data = response.data as Record<string, unknown>;

        if (opts.save) {
          const globalOpts = resolveOptions(cmd);
          const key = (data as Record<string, unknown>).key as string | undefined;
          if (!key) {
            printError("Response missing key. Cannot save API key.");
            outputResponse(response, format);
            printSuccess("API key created.");
            return;
          }
          const config = loadConfig(globalOpts.profile);
          config.apiKey = key;
          saveConfig(config, globalOpts.profile);
          printSuccess("API key saved to config. X-Api-Key header will be sent automatically.");
        } else {
          printWarning("Save the API key now — it will not be shown again. Use --save to store it automatically.");
        }

        outputResponse(response, format);
        printSuccess("API key created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create an API key with flags",
      command: "geonic me api-keys create --name my-app --scopes read:entities --origins 'https://example.com'",
    },
    {
      description: "Create and save API key to config",
      command: "geonic me api-keys create --name my-app --save",
    },
    {
      description: "Create an API key from JSON",
      command: 'geonic me api-keys create \'{"name":"my-app","allowedScopes":["read:entities"]}\'',
    },
    {
      description: "Create an API key with rate limiting",
      command: "geonic me api-keys create --name my-app --rate-limit 100",
    },
  ]);

  // api-keys delete
  const del = apiKeys
    .command("delete <keyId>")
    .description("Delete an API key")
    .action(
      withErrorHandler(async (keyId: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/me/api-keys/${encodeURIComponent(String(keyId))}`,
        );
        printSuccess("API key deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete an API key",
      command: "geonic me api-keys delete <key-id>",
    },
  ]);
}
