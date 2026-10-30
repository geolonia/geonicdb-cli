import type { Command } from "commander";
import { InvalidArgumentError } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
  resolveOptions,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printOutput, printError } from "../output.js";
import { sanitizeServerText } from "../sanitize.js";
import { addExamples } from "./help.js";

/**
 * Values accepted by `GET /jsonldContexts?kind=` (ETSI GS CIM 009 clause 5.13.3.3
 * vocabulary plus the server's lowercase aliases — see geonicdb
 * `JsonLdContextKindQuerySchema`).
 */
export const JSONLD_CONTEXT_KIND_VALUES = [
  "Cached",
  "Hosted",
  "ImplicitlyCreated",
  "cached",
  "hosted",
  "implicitlyCreated",
] as const;

export type JsonLdContextKindQuery = (typeof JSONLD_CONTEXT_KIND_VALUES)[number];

const KIND_SET = new Set<string>(JSONLD_CONTEXT_KIND_VALUES);

/** Commander parser for `--kind` — reject values the server would 400. */
export function parseJsonLdContextKind(value: string): string {
  if (!KIND_SET.has(value)) {
    throw new InvalidArgumentError(
      `kind must be one of Cached, Hosted, ImplicitlyCreated (lowercase forms also accepted)`,
    );
  }
  return value;
}

/**
 * Thrown when `Location` resolves to an origin other than the configured server.
 * A hostile or misconfigured broker must not steer `--context` at a third party.
 */
export class CrossOriginContextLocationError extends Error {
  constructor(resolvedHref: string, baseUrl: string) {
    super(
      `Refusing to print context URL: Location origin differs from the configured server (${baseUrl} → ${resolvedHref}).`,
    );
    this.name = "CrossOriginContextLocationError";
  }
}

/**
 * Turn the `Location` header from `POST /jsonldContexts` into an absolute URL
 * suitable for `--context`. The server returns a path (`/ngsi-ld/v1/jsonldContexts/...`).
 *
 * - Control characters are stripped via {@link sanitizeServerText} (same as
 *   `surfaceNgsiWarning` / helpers.ts) before resolution and again on the result.
 * - Absolute Locations whose origin ≠ the CLI base URL are rejected.
 */
export function resolveRegisteredContextUrl(location: string, baseUrl: string): string {
  const sanitized = sanitizeServerText(location);
  const resolved = new URL(sanitized, baseUrl);
  const base = new URL(baseUrl);
  if (resolved.origin !== base.origin) {
    throw new CrossOriginContextLocationError(resolved.href, baseUrl);
  }
  return sanitizeServerText(resolved.href);
}

export function registerContextsCommand(program: Command): void {
  const contexts = program
    .command("contexts")
    .alias("jsonld-contexts")
    .description(
      "Manage JSON-LD @context documents registered with the tenant (NGSI-LD /jsonldContexts)",
    );

  // contexts list
  const list = contexts
    .command("list")
    .description(
      "List registered JSON-LD @contexts\n\n" +
        "Default response is an array of URLs. Pass --details for metadata objects\n" +
        "(URL / localId / kind / createdAt). Filter with --kind Cached|Hosted|ImplicitlyCreated.",
    )
    .option("--details", "Return metadata objects instead of URL strings (details=true)")
    .option(
      "--kind <kind>",
      "Filter by kind: Cached, Hosted, or ImplicitlyCreated (lowercase forms also accepted)",
      parseJsonLdContextKind,
    )
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts() as { details?: boolean; kind?: string };

        const params: Record<string, string> = {};
        if (cmdOpts.details) params["details"] = "true";
        if (cmdOpts.kind) params["kind"] = cmdOpts.kind;

        const response = await client.get("/jsonldContexts", params);
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List registered @context URLs",
      command: "geonic contexts list",
    },
    {
      description: "List with metadata",
      command: "geonic contexts list --details",
    },
    {
      description: "List only Hosted contexts",
      command: "geonic contexts list --kind Hosted",
    },
  ]);

  // contexts get
  const get = contexts
    .command("get <id>")
    .description(
      "Get a registered JSON-LD @context by localId or (for Cached) original URL.\n" +
        "Returns the stored @context document itself.",
    )
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.get(
          `/jsonldContexts/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Fetch a Hosted @context document by localId",
      command: "geonic contexts get urn:ngsi-ld:JsonLdContext:abc123",
    },
  ]);

  // contexts create
  const create = contexts
    .command("create [json]")
    .summary("Register a JSON-LD @context")
    .description(
      "Register a JSON-LD @context (Add @context → POST /jsonldContexts).\n\n" +
        "The entry is always Hosted; do not send kind (the server rejects it with 400).\n\n" +
        "JSON payload — any of:\n" +
        '  { "@context": { "Vehicle": "https://example.org/ns#Vehicle" } }\n' +
        '  { "body": { "@context": { "Vehicle": "https://example.org/ns#Vehicle" } } }\n' +
        '  { "url": "https://example.org/vocab.jsonld", "body": { "@context": { ... } } }\n\n' +
        "On success the registered URL is printed (use it with --context).",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const opts = resolveOptions(cmd);

        const response = await client.post("/jsonldContexts", body);
        const location = response.headers.get("location");
        if (!location) {
          printError("Context created but the Location header was missing.");
          process.exitCode = 1;
          return;
        }
        if (!opts.url) {
          printError("No URL configured; cannot resolve the registered context Location.");
          process.exitCode = 1;
          return;
        }

        let url: string;
        try {
          url = resolveRegisteredContextUrl(location, opts.url);
        } catch (err) {
          if (err instanceof CrossOriginContextLocationError) {
            printError(err.message);
            process.exitCode = 1;
            return;
          }
          throw err;
        }
        // Table format shows `url` on the first line so the value is easy to copy
        // into `--context`.
        printOutput({ url }, format);
        printSuccess("Context created.");
      }),
    );

  addExamples(create, [
    {
      description: "Register an inline @context document",
      command: `geonic contexts create '{"@context":{"Vehicle":"https://example.org/ns#Vehicle","plateNumber":"https://example.org/ns#plateNumber"}}'`,
    },
    {
      description: "Register from a file",
      command: "geonic contexts create @context.json",
    },
    {
      description: "Register from stdin",
      command: "cat context.json | geonic contexts create",
    },
  ]);

  // contexts delete
  const del = contexts
    .command("delete <id>")
    .description(
      "Delete a registered JSON-LD @context by localId or original URL.\n" +
        "The core @context cannot be deleted.",
    )
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.delete(`/jsonldContexts/${encodeURIComponent(String(id))}`);
        printSuccess("Context deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a Hosted @context by localId",
      command: "geonic contexts delete urn:ngsi-ld:JsonLdContext:abc123",
    },
  ]);
}
