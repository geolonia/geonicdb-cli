import type { Command } from "commander";
import { withErrorHandler, createClient, resolveOptions, getFormat, outputResponse } from "../helpers.js";
import { loadConfig, saveConfig } from "../config.js";
import { parseJsonInput } from "../input.js";
import { printApiKeyBox, printError } from "../output.js";
import { addExamples, addNotes } from "./help.js";

/** Strip masked key placeholder from API key response for cleaner display. */
function cleanApiKeyData(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(cleanApiKeyData);
  if (typeof data !== "object" || data === null) return data;
  const obj = { ...(data as Record<string, unknown>) };
  if (obj.key === "******") delete obj.key;
  return obj;
}

/** Save API key to profile config and print confirmation. Returns false if key missing or save fails. */
function handleSaveKey(
  data: Record<string, unknown>,
  cmd: Command,
): boolean {
  const globalOpts = resolveOptions(cmd);
  const key = data.key as string | undefined;
  if (!key) {
    printError("Response missing key. API key was created, but it could not be saved.");
    process.exitCode = 1;
    return false;
  }
  try {
    const config = loadConfig(globalOpts.profile);
    config.apiKey = key;
    saveConfig(config, globalOpts.profile);
    console.error("API key saved to config. X-Api-Key header will be sent automatically.");
    return true;
  } catch (err) {
    printError(`Failed to save API key to config: ${err instanceof Error ? err.message : String(err)}`);
    printApiKeyBox(key);
    process.exitCode = 1;
    return false;
  }
}

/** Show API key value prominently. Returns false if key is missing (treated as error). */
function showKeyResult(
  data: Record<string, unknown>,
  save: boolean,
  cmd: Command,
): boolean {
  const key = data.key as string | undefined;
  if (!key) {
    printError("Response missing key. The new API key value was not returned.");
    process.exitCode = 1;
    return false;
  }
  if (save) return handleSaveKey(data, cmd);
  printApiKeyBox(key);
  return true;
}

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
        response.data = cleanApiKeyData(response.data);
        outputResponse(response, format);
        console.error("※ API キー値は作成時 (create) またはリフレッシュ時 (refresh) にのみ表示されます。");
      }),
    );

  addExamples(list, [
    {
      description: "List your API keys",
      command: "geonic me api-keys list",
    },
    {
      description: "List in table format for a quick overview",
      command: "geonic me api-keys list --format table",
    },
  ]);

  // api-keys create
  const create = apiKeys
    .command("create [json]")
    .description("Create a new API key")
    .option("--name <name>", "Key name")
    .option("--policy <policyId>", "Policy ID to attach")
    .option("--origins <origins>", "Allowed origins (comma-separated)")
    .option("--rate-limit <n>", "Rate limit per minute")
    .option("--dpop-required", "Require DPoP token binding")
    .option("--save", "Save the API key to config for automatic use")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          policy?: string;
          origins?: string;
          rateLimit?: string;
          dpopRequired?: boolean;
          save?: boolean;
        };

        // Validate --origins flag early
        if (opts.origins !== undefined) {
          const parsed = opts.origins.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (parsed.length === 0) {
            printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
            process.exit(1);
          }
        }

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.policy || opts.origins || opts.rateLimit || opts.dpopRequired !== undefined) {
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.name = opts.name;
          if (opts.policy) payload.policyId = opts.policy;
          if (opts.origins) payload.allowedOrigins = opts.origins.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (opts.dpopRequired !== undefined) payload.dpopRequired = opts.dpopRequired;
          if (opts.rateLimit) {
            const raw = opts.rateLimit.trim();
            if (!/^\d+$/.test(raw)) {
              printError("--rate-limit must be a positive integer.");
              process.exit(1);
            }
            const perMinute = Number(raw);
            if (perMinute <= 0) {
              printError("--rate-limit must be a positive integer.");
              process.exit(1);
            }
            payload.rateLimit = { perMinute };
          }
          body = payload;
        } else {
          body = await parseJsonInput();
        }

        // Validate allowedOrigins from JSON input
        if (body && typeof body === "object" && "allowedOrigins" in (body as Record<string, unknown>)) {
          const origins = (body as Record<string, unknown>).allowedOrigins;
          if (Array.isArray(origins) && origins.filter((o: unknown) => typeof o === "string" && o.trim() !== "").length === 0) {
            printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
            process.exit(1);
          }
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/me/api-keys", { body });

        const data = response.data as Record<string, unknown>;
        const ok = showKeyResult(data, !!opts.save, cmd);

        outputResponse(response, format);
        if (ok) console.error("API key created.");
      }),
    );

  addNotes(create, [
    "Use --policy to attach an existing XACML policy to the API key.",
    "Manage policies with `geonic admin policies` commands.",
  ]);

  addExamples(create, [
    {
      description: "Create an API key with a policy",
      command: "geonic me api-keys create --name my-app --policy <policy-id>",
    },
    {
      description: "Create and save API key to config",
      command: "geonic me api-keys create --name my-app --save",
    },
    {
      description: "Create an API key from JSON",
      command: 'geonic me api-keys create \'{"name":"my-app","policyId":"<policy-id>"}\'',
    },
    {
      description: "Create an API key with rate limiting",
      command: "geonic me api-keys create --name my-app --rate-limit 100",
    },
    {
      description: "Create an API key with DPoP required",
      command: "geonic me api-keys create --name my-app --dpop-required",
    },
  ]);

  // api-keys refresh
  const refresh = apiKeys
    .command("refresh <keyId>")
    .description("Refresh (rotate) an API key — generates a new key value")
    .option("--save", "Save the new API key to config for automatic use")
    .action(
      withErrorHandler(async (keyId: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as { save?: boolean };
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "POST",
          `/me/api-keys/${encodeURIComponent(String(keyId))}/refresh`,
        );

        const data = response.data as Record<string, unknown>;
        const ok = showKeyResult(data, !!opts.save, cmd);

        outputResponse(response, format);
        if (ok) console.error("API key refreshed.");
      }),
    );

  addNotes(refresh, [
    "Refreshing generates a new key value while keeping keyId, name, and policy settings.",
    "The previous key value is immediately invalidated.",
  ]);

  addExamples(refresh, [
    {
      description: "Refresh an API key",
      command: "geonic me api-keys refresh <key-id>",
    },
    {
      description: "Refresh and save new key to config",
      command: "geonic me api-keys refresh <key-id> --save",
    },
  ]);

  // api-keys update
  const update = apiKeys
    .command("update <keyId> [json]")
    .description("Update an API key")
    .option("--name <name>", "Key name")
    .option("--policy-id <policyId>", "Policy ID to attach (use 'null' to unbind)")
    .option("--origins <origins>", "Allowed origins (comma-separated)")
    .option("--rate-limit <n>", "Rate limit (requests per minute)")
    .option("--dpop-required", "Require DPoP token binding")
    .option("--no-dpop-required", "Disable DPoP requirement")
    .option("--active", "Activate the API key")
    .option("--inactive", "Deactivate the API key")
    .action(
      withErrorHandler(async (keyId: unknown, json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          policyId?: string;
          origins?: string;
          rateLimit?: string;
          dpopRequired?: boolean;
          active?: boolean;
          inactive?: boolean;
        };

        // Validate --origins flag early
        if (opts.origins !== undefined) {
          const parsed = opts.origins.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (parsed.length === 0) {
            printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
            process.exit(1);
          }
        }

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.policyId !== undefined || opts.origins !== undefined || opts.rateLimit || opts.dpopRequired !== undefined || opts.active || opts.inactive) {
          const payload: Record<string, unknown> = {};
          if (opts.name) payload.name = opts.name;
          if (opts.policyId !== undefined) payload.policyId = opts.policyId === "null" ? null : opts.policyId;
          if (opts.origins !== undefined) payload.allowedOrigins = opts.origins.split(",").map((s: string) => s.trim()).filter(Boolean);
          if (opts.dpopRequired !== undefined) payload.dpopRequired = opts.dpopRequired;
          if (opts.rateLimit) {
            const raw = opts.rateLimit.trim();
            if (!/^\d+$/.test(raw)) {
              printError("--rate-limit must be a positive integer.");
              process.exit(1);
            }
            const perMinute = Number(raw);
            if (perMinute <= 0) {
              printError("--rate-limit must be a positive integer.");
              process.exit(1);
            }
            payload.rateLimit = { perMinute };
          }
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
          `/me/api-keys/${encodeURIComponent(String(keyId))}`,
          { body },
        );
        outputResponse(response, format);
        console.error("API key updated.");
      }),
    );

  addExamples(update, [
    {
      description: "Rename an API key",
      command: "geonic me api-keys update <key-id> --name new-name",
    },
    {
      description: "Attach a policy",
      command: "geonic me api-keys update <key-id> --policy-id <policy-id>",
    },
    {
      description: "Unbind policy",
      command: "geonic me api-keys update <key-id> --policy-id null",
    },
    {
      description: "Deactivate an API key",
      command: "geonic me api-keys update <key-id> --inactive",
    },
    {
      description: "Update from JSON",
      command: 'geonic me api-keys update <key-id> \'{"name":"new-name","rateLimit":{"perMinute":60}}\'',
    },
  ]);

  // api-keys delete
  const del = apiKeys
    .command("delete <keyId>")
    .description("Delete an API key — immediately revokes access for any client using it")
    .action(
      withErrorHandler(async (keyId: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/me/api-keys/${encodeURIComponent(String(keyId))}`,
        );
        console.error("API key deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete an API key by ID",
      command: "geonic me api-keys delete <key-id>",
    },
    {
      description: "Revoke a leaked or unused key",
      command: "geonic me api-keys delete abc123-def456",
    },
  ]);
}
