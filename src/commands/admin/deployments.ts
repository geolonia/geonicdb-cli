import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
  parseNonNegativeInt,
  fetchPaginatedList,
} from "../../helpers.js";
import type { ClientResponse } from "../../types.js";
import { printSuccess, printWarning, printInfo } from "../../output.js";
import { isInteractive, promptConfirm } from "../../prompt.js";
import { addExamples, addNotes } from "../help.js";

/**
 * `admin deployments` — hostname → MongoDB cluster routing rows (#176,
 * server geolonia/geonicdb#1775).
 *
 * These rows decide which cluster a hostname lands on, so a wrong or missing row
 * makes every API on that host 404. The commands below are deliberately loud
 * about the three things that are easy to get quietly wrong:
 *   - the connection string is never echoed back (the API only reports whether
 *     one is configured), so nothing here prints or expects a plaintext URI;
 *   - a write converges across warm instances only after a cache TTL, which the
 *     server reports in a `notice` field / `X-Deployment-Cache-Notice` header;
 *   - a listing can be truncated at the repository scan cap, which the server
 *     flags with `X-Deployment-List-Truncated`.
 */

/** Quota plans accepted by the server (`QUOTAS.PLAN_VALUES`). */
const QUOTA_PLANS = ["FREE", "STANDARD", "PREMIUM", "ENTERPRISE", "CUSTOM"] as const;

interface CreateOptions {
  database?: string;
  plan?: string;
  secret?: string;
  mongodbUri?: string;
  rateLimitTable?: string;
  disabled?: boolean;
  metadata?: string;
}

interface UpdateOptions {
  database?: string;
  plan?: string;
  secret?: string;
  mongodbUri?: string;
  rateLimitTable?: string;
  metadata?: string;
  enable?: boolean;
  disable?: boolean;
  clearSecret?: boolean;
  clearMongodbUri?: boolean;
  clearRateLimitTable?: boolean;
  clearMetadata?: boolean;
}

/**
 * The server lowercases hostnames because routing looks up a lowercased `Host`.
 * Normalizing here too keeps the path we request identical to the row we get
 * back, so `get Tenant-A.example.com` cannot look like a missing row.
 */
function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase();
}

function deploymentPath(hostname: string): string {
  return `/admin/deployments/${encodeURIComponent(normalizeHostname(hostname))}`;
}

function parseMetadata(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("--metadata must be a JSON object.");
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--metadata must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function assertKnownPlan(plan: string): string {
  const upper = plan.toUpperCase();
  if (!(QUOTA_PLANS as readonly string[]).includes(upper)) {
    throw new Error(`--plan must be one of: ${QUOTA_PLANS.join(", ")}.`);
  }
  return upper;
}

/**
 * A plaintext connection string typed on the command line is captured by the
 * shell history and by any process listing. Say so rather than let a credential
 * leak quietly; the supported path is a Secrets Manager reference.
 */
function warnAboutPlaintextUri(): void {
  printWarning(
    "--mongodb-uri puts a database credential in your shell history and process list. " +
      "Use --secret with a Secrets Manager secret name outside throwaway environments.",
  );
}

/**
 * Surface the convergence notice the server attaches to writes. Without it a
 * successful response reads as "live everywhere now", when other warm instances
 * keep routing with the previous configuration until their cache expires.
 */
function printCacheNotice(response: ClientResponse): void {
  const data = response.data;
  const fromBody =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).notice
      : undefined;
  const notice = fromBody ?? response.headers.get("X-Deployment-Cache-Notice");
  if (typeof notice === "string" && notice) {
    printInfo(notice);
  }
}

/**
 * The server caps how many rows it reads from the store and flags a truncated
 * listing with a header. An admin checking inventory must not mistake a partial
 * list for the whole set.
 */
function warnIfTruncated(response: ClientResponse): void {
  if (response.headers.get("X-Deployment-List-Truncated") === "true") {
    printWarning(
      "The server hit its scan cap — this listing is incomplete (geonicdb#1775).",
    );
  }
}

function buildCreateBody(hostname: string, opts: CreateOptions): Record<string, unknown> {
  if (!opts.database) throw new Error("--database is required.");
  if (!opts.plan) throw new Error("--plan is required.");
  if (!opts.secret && !opts.mongodbUri) {
    throw new Error(
      "One of --secret or --mongodb-uri is required — a row without a connection source " +
        "routes requests to a cluster it cannot reach.",
    );
  }

  const body: Record<string, unknown> = {
    hostname: normalizeHostname(hostname),
    databaseName: opts.database,
    defaultQuotaPlan: assertKnownPlan(opts.plan),
  };
  if (opts.secret) body.mongodbUriSecretArn = opts.secret;
  if (opts.mongodbUri) body.mongodbUri = opts.mongodbUri;
  if (opts.rateLimitTable) body.rateLimitTableName = opts.rateLimitTable;
  if (opts.disabled) body.enabled = false;
  if (opts.metadata) body.metadata = parseMetadata(opts.metadata);
  return body;
}

function buildUpdateBody(opts: UpdateOptions): Record<string, unknown> {
  if (opts.enable && opts.disable) {
    throw new Error("Cannot specify both --enable and --disable.");
  }
  // Setting and clearing the same field in one request is a contradiction; the
  // server would silently apply whichever won the object literal.
  const conflicts: [string, unknown, unknown][] = [
    ["--secret", opts.secret, opts.clearSecret],
    ["--mongodb-uri", opts.mongodbUri, opts.clearMongodbUri],
    ["--rate-limit-table", opts.rateLimitTable, opts.clearRateLimitTable],
    ["--metadata", opts.metadata, opts.clearMetadata],
  ];
  for (const [flag, value, cleared] of conflicts) {
    if (value !== undefined && cleared) {
      throw new Error(`Cannot specify both ${flag} and --clear-${flag.slice(2)}.`);
    }
  }

  const body: Record<string, unknown> = {};
  if (opts.database) body.databaseName = opts.database;
  if (opts.plan) body.defaultQuotaPlan = assertKnownPlan(opts.plan);
  if (opts.enable) body.enabled = true;
  if (opts.disable) body.enabled = false;

  // `null` is the server's explicit "remove this field" signal.
  if (opts.secret) body.mongodbUriSecretArn = opts.secret;
  if (opts.clearSecret) body.mongodbUriSecretArn = null;
  if (opts.mongodbUri) body.mongodbUri = opts.mongodbUri;
  if (opts.clearMongodbUri) body.mongodbUri = null;
  if (opts.rateLimitTable) body.rateLimitTableName = opts.rateLimitTable;
  if (opts.clearRateLimitTable) body.rateLimitTableName = null;
  if (opts.metadata) body.metadata = parseMetadata(opts.metadata);
  if (opts.clearMetadata) body.metadata = null;

  if (Object.keys(body).length === 0) {
    throw new Error("Nothing to update — specify at least one field to change.");
  }
  return body;
}

export function registerDeploymentsCommand(parent: Command): void {
  const deployments = parent
    .command("deployments")
    .description("Manage deployment routing rows (hostname to MongoDB cluster). super_admin only");

  // deployments list
  const list = deployments
    .command("list")
    .description("List deployment routing rows, including disabled ones")
    .option("--enabled", "Show only enabled rows")
    .option("--disabled", "Show only disabled rows")
    .option("--limit <n>", "Maximum number of results", parseNonNegativeInt)
    .option("--offset <n>", "Skip N results", parseNonNegativeInt)
    .action(
      withErrorHandler(async (opts: Record<string, unknown>, cmd: Command) => {
        if (opts.enabled && opts.disabled) {
          throw new Error("Cannot specify both --enabled and --disabled.");
        }
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const extraParams: Record<string, string> = {};
        if (opts.enabled) extraParams.enabled = "true";
        if (opts.disabled) extraParams.enabled = "false";

        const response = await fetchPaginatedList(
          client,
          "/admin/deployments",
          cmd.opts(),
          extraParams,
        );
        warnIfTruncated(response);
        outputResponse(response, format);
      }),
    );

  addNotes(list, [
    "Disabled rows are included unless --enabled / --disabled narrows the result.",
    "The plaintext connection string is never returned. `mongodbUriConfigured` reports",
    "  whether one is stored; `mongodbUriSecretArn` shows the Secrets Manager reference.",
  ]);

  addExamples(list, [
    { description: "List all deployment rows", command: "geonic admin deployments list" },
    {
      description: "List only disabled rows",
      command: "geonic admin deployments list --disabled",
    },
    {
      description: "List as a table",
      command: "geonic admin deployments list --format table",
    },
  ]);

  // deployments get
  const get = deployments
    .command("get <hostname>")
    .description("Get a deployment routing row by hostname")
    .action(
      withErrorHandler(async (hostname: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", deploymentPath(hostname));
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get a deployment row",
      command: "geonic admin deployments get tenant-a.geonicdb.com",
    },
  ]);

  // deployments create
  const create = deployments
    .command("create <hostname>")
    .summary("Create a deployment routing row")
    .description(
      "Create a deployment routing row\n\n" +
        "Routes requests for <hostname> to a dedicated MongoDB cluster.\n" +
        "The hostname is lowercased by the server, so the stored row may differ in case.",
    )
    .option("--database <name>", "MongoDB database name (required)")
    .option("--plan <plan>", `Default quota plan: ${QUOTA_PLANS.join(", ")} (required)`)
    .option("--secret <name-or-arn>", "Secrets Manager secret holding the connection string")
    .option("--mongodb-uri <uri>", "Plaintext connection string (non-production only)")
    .option("--rate-limit-table <name>", "Deployment-specific rate limit table")
    .option("--disabled", "Create the row disabled (no routing until enabled)")
    .option("--metadata <json>", "Free-form JSON object stored with the row")
    .action(
      withErrorHandler(async (hostname: string, opts: CreateOptions, cmd: Command) => {
        const body = buildCreateBody(hostname, opts);
        if (opts.mongodbUri) warnAboutPlaintextUri();
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/admin/deployments", { body });
        outputResponse(response, format);
        printSuccess("Deployment created.");
        printCacheNotice(response);
      }),
    );

  addNotes(create, [
    "--secret takes a Secrets Manager secret NAME or a full ARN. Prefer the name:",
    "  a full ARN pins a region, and a Lambda failing over to another region cannot",
    "  resolve it. A bare name resolves to each region's own replica.",
    "--mongodb-uri stores the credential in plaintext and is rejected outright when the",
    "  server runs with MONGODB_ENFORCE_SECRETS=true. It also lands in your shell history.",
    "A row is refused (400/409) when it could never be routed: a reserved subdomain, or a",
    "  hostname already covered by DEFAULT_DEPLOYMENT_HOSTNAMES.",
    "Other warm server instances keep the previous routing until their cache expires;",
    "  the response notice states the window.",
  ]);

  addExamples(create, [
    {
      description: "Create a row backed by a Secrets Manager secret (recommended)",
      command:
        "geonic admin deployments create tenant-a.geonicdb.com --database tenant_a --plan PREMIUM --secret geonicdb/tenant-a/mongodb-uri",
    },
    {
      description: "Create it disabled, to enable after verifying the cluster",
      command:
        "geonic admin deployments create tenant-a.geonicdb.com --database tenant_a --plan PREMIUM --secret geonicdb/tenant-a/mongodb-uri --disabled",
    },
    {
      description: "Attach a dedicated rate limit table and metadata",
      command:
        `geonic admin deployments create tenant-a.geonicdb.com --database tenant_a --plan ENTERPRISE --secret geonicdb/tenant-a/mongodb-uri --rate-limit-table geonicdb-ratelimit-tenant-a --metadata '{"owner":"sales"}'`,
    },
  ]);

  // deployments update
  const update = deployments
    .command("update <hostname>")
    .summary("Update a deployment routing row")
    .description(
      "Update a deployment routing row\n\n" +
        "Only the specified fields change. The hostname itself is immutable —\n" +
        "to rename, create the new row and delete the old one.",
    )
    .option("--database <name>", "MongoDB database name")
    .option("--plan <plan>", `Default quota plan: ${QUOTA_PLANS.join(", ")}`)
    .option("--secret <name-or-arn>", "Secrets Manager secret holding the connection string")
    .option("--mongodb-uri <uri>", "Plaintext connection string (non-production only)")
    .option("--rate-limit-table <name>", "Deployment-specific rate limit table")
    .option("--metadata <json>", "Free-form JSON object stored with the row")
    .option("--enable", "Enable routing for this hostname")
    .option("--disable", "Disable routing for this hostname")
    .option("--clear-secret", "Remove the Secrets Manager reference")
    .option("--clear-mongodb-uri", "Remove the stored plaintext connection string")
    .option("--clear-rate-limit-table", "Remove the deployment-specific rate limit table")
    .option("--clear-metadata", "Remove the stored metadata")
    .action(
      withErrorHandler(async (hostname: string, opts: UpdateOptions, cmd: Command) => {
        const body = buildUpdateBody(opts);
        if (opts.mongodbUri) warnAboutPlaintextUri();
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("PATCH", deploymentPath(hostname), { body });
        outputResponse(response, format);
        printSuccess("Deployment updated.");
        printCacheNotice(response);
      }),
    );

  addNotes(update, [
    "The hostname cannot be changed; sending one is rejected by the server.",
    "--clear-* sends an explicit null, which removes the field. A row must keep at least",
    "  one connection source, so clearing the last of --secret / --mongodb-uri is refused.",
    "Disabling the row that serves the current request is refused (409) — it would make",
    "  every API on that host, including this one, return 404. Run it from another host.",
  ]);

  addExamples(update, [
    {
      description: "Move a deployment to a different secret",
      command:
        "geonic admin deployments update tenant-a.geonicdb.com --secret geonicdb/tenant-a/mongodb-uri-v2",
    },
    {
      description: "Migrate from a plaintext URI to a Secrets Manager reference",
      command:
        "geonic admin deployments update tenant-a.geonicdb.com --secret geonicdb/tenant-a/mongodb-uri --clear-mongodb-uri",
    },
    {
      description: "Change the default quota plan",
      command: "geonic admin deployments update tenant-a.geonicdb.com --plan ENTERPRISE",
    },
    {
      description: "Enable a row created with --disabled",
      command: "geonic admin deployments update tenant-a.geonicdb.com --enable",
    },
    {
      description: "Take a hostname out of service",
      command: "geonic admin deployments update tenant-a.geonicdb.com --disable",
    },
  ]);

  // deployments delete
  const del = deployments
    .command("delete <hostname>")
    .description(
      "Delete a deployment routing row (destructive: every API on that hostname stops resolving)",
    )
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      withErrorHandler(async (hostname: string, opts: { yes?: boolean }, cmd: Command) => {
        const host = normalizeHostname(hostname);
        // Deleting a row takes an entire hostname offline, and the stored
        // connection details are gone with it. Require an explicit go-ahead the
        // same way `entities purge` does.
        if (!opts.yes) {
          if (!isInteractive()) {
            throw new Error(
              `Refusing to delete the deployment for '${host}' without confirmation. Re-run with --yes.`,
            );
          }
          const confirmed = await promptConfirm(
            `Delete the deployment row for '${host}'? Every API on that hostname will stop resolving.`,
          );
          if (!confirmed) return;
        }

        const client = createClient(cmd);
        const response = await client.rawRequest("DELETE", deploymentPath(hostname));
        printSuccess("Deployment deleted.");
        printCacheNotice(response);
      }),
    );

  addNotes(del, [
    "Deleting the row that serves the current request is refused (409) — recovery would",
    "  require the very API the deletion breaks. Run it from another hostname.",
    "The convergence notice arrives in the X-Deployment-Cache-Notice response header.",
  ]);

  addExamples(del, [
    {
      description: "Delete a deployment row",
      command: "geonic admin deployments delete tenant-a.geonicdb.com",
    },
    {
      description: "Delete without the confirmation prompt (scripts, CI)",
      command: "geonic admin deployments delete tenant-a.geonicdb.com --yes",
    },
  ]);
}
