import type { Command } from "commander";
import { withErrorHandler, createClient, resolveOptions, getFormat, outputResponse } from "../../helpers.js";
import { loadConfig, saveConfig } from "../../config.js";
import { parseJsonInput } from "../../input.js";
import { printApiKeyBox, printError, printWarning } from "../../output.js";
import { addExamples, addNotes } from "../help.js";

/** Strip deprecated/masked fields from API key response for cleaner display. */
function cleanApiKeyData(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(cleanApiKeyData);
  if (typeof data !== "object" || data === null) return data;
  const obj = { ...(data as Record<string, unknown>) };
  delete obj.keyPrefix;
  if (obj.key === "******") delete obj.key;
  return obj;
}

function validateOrigins(body: unknown, opts: Record<string, unknown>): void {
  // Validate origins if provided via flags
  if (opts.origins !== undefined) {
    const origins = String(opts.origins).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (origins.length === 0) {
      printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
      process.exit(1);
    }
  }
  // Also validate if provided via JSON input
  if (body && typeof body === "object" && "allowedOrigins" in (body as Record<string, unknown>)) {
    const origins = (body as Record<string, unknown>).allowedOrigins;
    if (Array.isArray(origins) && origins.filter((o: unknown) => typeof o === "string" && o.trim() !== "").length === 0) {
      printError("allowedOrigins must contain at least 1 item. Use '*' to allow all origins.");
      process.exit(1);
    }
  }
}

function buildBodyFromFlags(opts: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (opts.name) payload.name = opts.name;
  if (opts.policy) payload.policyId = opts.policy;
  if (opts.origins) payload.allowedOrigins = (opts.origins as string).split(",").map((s: string) => s.trim()).filter(Boolean);
  if (opts.rateLimit) {
    const raw = String(opts.rateLimit).trim();
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
  if (opts.dpopRequired !== undefined) payload.dpopRequired = opts.dpopRequired;
  if (opts.tenantId) payload.tenantId = opts.tenantId;
  return payload;
}

/** Save API key to profile config and print confirmation. Returns false if key missing. */
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
  const config = loadConfig(globalOpts.profile);
  config.apiKey = key;
  saveConfig(config, globalOpts.profile);
  console.error("API key saved to config. X-Api-Key header will be sent automatically.");
  return true;
}

/** Show API key value prominently, or warning if not saving. */
function showKeyResult(
  data: Record<string, unknown>,
  save: boolean,
  cmd: Command,
): void {
  if (save) {
    handleSaveKey(data, cmd);
  } else {
    const key = data.key as string | undefined;
    if (key) {
      printApiKeyBox(key);
    } else {
      printWarning("Save the API key now — it will not be shown again. Use --save to store it automatically.");
    }
  }
}

export function registerApiKeysCommand(parent: Command): void {
  const apiKeys = parent
    .command("api-keys")
    .description("Manage API keys");

  // api-keys list
  const list = apiKeys
    .command("list")
    .description("List all API keys")
    .option("--tenant-id <id>", "Filter by tenant ID")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as { tenantId?: string };
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const params: Record<string, string> = {};
        if (opts.tenantId) params.tenantId = opts.tenantId;
        const response = await client.rawRequest("GET", "/admin/api-keys", {
          params,
        });
        response.data = cleanApiKeyData(response.data);
        outputResponse(response, format);
        console.error("※ API キー値は作成時 (create) またはリフレッシュ時 (refresh) にのみ表示されます。");
      }),
    );

  addExamples(list, [
    {
      description: "List all API keys",
      command: "geonic admin api-keys list",
    },
    {
      description: "List API keys for a specific tenant",
      command: "geonic admin api-keys list --tenant-id <tenant-id>",
    },
  ]);

  // api-keys get
  const get = apiKeys
    .command("get <keyId>")
    .description("Get an API key by ID")
    .action(
      withErrorHandler(async (keyId: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/admin/api-keys/${encodeURIComponent(String(keyId))}`,
        );
        response.data = cleanApiKeyData(response.data);
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get an API key by ID",
      command: "geonic admin api-keys get <key-id>",
    },
  ]);

  // api-keys create
  const create = apiKeys
    .command("create [json]")
    .description("Create a new API key")
    .option("--name <name>", "Key name")
    .option("--policy <policyId>", "Policy ID to attach")
    .option("--origins <origins>", "Comma-separated origins")
    .option("--rate-limit <n>", "Rate limit per minute")
    .option("--dpop-required", "Require DPoP token binding")
    .option("--tenant-id <id>", "Tenant ID")
    .option("--save", "Save the API key to profile config")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as {
          name?: string;
          policy?: string;
          origins?: string;
          rateLimit?: string;
          dpopRequired?: boolean;
          tenantId?: string;
          save?: boolean;
        };

        validateOrigins(undefined, opts);

        let body: unknown;
        if (json) {
          body = await parseJsonInput(json as string | undefined);
        } else if (opts.name || opts.policy || opts.origins || opts.rateLimit || opts.dpopRequired !== undefined || opts.tenantId) {
          body = buildBodyFromFlags(opts);
        } else {
          body = await parseJsonInput();
        }

        validateOrigins(body, {});

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/api-keys", {
          body,
        });
        const data = response.data as Record<string, unknown>;
        showKeyResult(data, !!opts.save, cmd);

        outputResponse(response, format);
        console.error("API key created.");
      }),
    );

  addNotes(create, [
    "Use --policy to attach an existing XACML policy to the API key.",
    "Manage policies with `geonic admin policies` commands.",
  ]);

  addExamples(create, [
    {
      description: "Create an API key with a policy",
      command: "geonic admin api-keys create --name my-key --policy <policy-id> --origins '*'",
    },
    {
      description: "Create an API key with DPoP required",
      command: "geonic admin api-keys create --name my-key --dpop-required",
    },
    {
      description: "Create an API key from JSON and save to config",
      command: "geonic admin api-keys create @key.json --save",
    },
  ]);

  // api-keys refresh
  const refresh = apiKeys
    .command("refresh <keyId>")
    .description("Refresh (rotate) an API key — generates a new key value")
    .option("--save", "Save the new API key to profile config")
    .action(
      withErrorHandler(async (keyId: unknown, _opts: unknown, cmd: Command) => {
        const opts = cmd.opts() as { save?: boolean };
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "POST",
          `/admin/api-keys/${encodeURIComponent(String(keyId))}/refresh`,
        );

        const data = response.data as Record<string, unknown>;
        showKeyResult(data, !!opts.save, cmd);

        outputResponse(response, format);
        console.error("API key refreshed.");
      }),
    );

  addNotes(refresh, [
    "Refreshing generates a new key value while keeping keyId, name, and policy settings.",
    "The previous key value is immediately invalidated.",
  ]);

  addExamples(refresh, [
    {
      description: "Refresh an API key",
      command: "geonic admin api-keys refresh <key-id>",
    },
    {
      description: "Refresh and save new key to config",
      command: "geonic admin api-keys refresh <key-id> --save",
    },
  ]);

  // api-keys update
  const update = apiKeys
    .command("update <keyId> [json]")
    .description("Update an API key")
    .option("--name <name>", "Key name")
    .option("--policy <policyId>", "Policy ID to attach")
    .option("--origins <origins>", "Comma-separated origins")
    .option("--rate-limit <n>", "Rate limit per minute")
    .option("--dpop-required", "Require DPoP token binding")
    .option("--no-dpop-required", "Disable DPoP token binding")
    .action(
      withErrorHandler(
        async (keyId: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const opts = cmd.opts() as {
            name?: string;
            policy?: string;
            origins?: string;
            rateLimit?: string;
            dpopRequired?: boolean;
          };

          validateOrigins(undefined, opts);

          let body: unknown;
          if (json) {
            body = await parseJsonInput(json as string | undefined);
          } else if (opts.name || opts.policy || opts.origins || opts.rateLimit || opts.dpopRequired !== undefined) {
            body = buildBodyFromFlags(opts);
          } else {
            body = await parseJsonInput();
          }

          validateOrigins(body, {});

          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/admin/api-keys/${encodeURIComponent(String(keyId))}`,
            { body },
          );
          outputResponse(response, format);
          console.error("API key updated.");
        },
      ),
    );

  addNotes(update, [
    "Use --policy to attach an existing XACML policy to the API key.",
    "Manage policies with `geonic admin policies` commands.",
  ]);

  addExamples(update, [
    {
      description: "Update an API key name",
      command: "geonic admin api-keys update <key-id> --name new-name",
    },
    {
      description: "Attach a policy",
      command: "geonic admin api-keys update <key-id> --policy <policy-id>",
    },
    {
      description: "Enable DPoP requirement",
      command: "geonic admin api-keys update <key-id> --dpop-required",
    },
    {
      description: "Disable DPoP requirement",
      command: "geonic admin api-keys update <key-id> --no-dpop-required",
    },
    {
      description: "Update an API key from a JSON file",
      command: "geonic admin api-keys update <key-id> @key.json",
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
          `/admin/api-keys/${encodeURIComponent(String(keyId))}`,
        );
        console.error("API key deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete an API key",
      command: "geonic admin api-keys delete <key-id>",
    },
  ]);
}
