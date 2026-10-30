import { isDeepStrictEqual } from "node:util";
import type { Command } from "commander";
import { GdbClientError } from "../client.js";
import { withErrorHandler, createClient, getFormat, outputResponse, parseNonNegativeInt, fetchPaginatedList } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printWarning, printError, printOutput } from "../output.js";
import { addExamples } from "./help.js";

/** Shape of PATCH /custom-data-models/{type}?dryRun=true (GeonicDB #2098). */
export type ModelUpdateDryRunConformance = {
  scanned?: number;
  violating?: number;
  undetermined?: number;
  truncated?: boolean;
  maxScan?: number;
  scopeLimited?: boolean;
  samples?: unknown[];
  /** Present only when non-empty (GeonicDB #2098). */
  uniqueConstraintViolations?: string[];
};

export type ModelUpdateDryRunResponse = {
  type?: string;
  dryRun?: boolean;
  conformance?: ModelUpdateDryRunConformance;
};

/** Result values emitted by `models apply` (#238). */
export type ModelApplyResult = "created" | "updated" | "unchanged" | "would create";

/**
 * Drop `type` from a model body so the payload is valid for
 * PATCH /custom-data-models/{type} (UpdateDataModelInputSchema is .strict()).
 */
export function stripTypeFromModelBody(body: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...body };
  delete rest.type;
  return rest;
}

/**
 * True when every key in `patch` deep-equals the same key on `existing`
 * (GET response). Extra keys on `existing` are ignored — apply is idempotent
 * against a full model document when the desired fields already match.
 */
export function isModelPatchUnchanged(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
): boolean {
  for (const [key, value] of Object.entries(patch)) {
    if (!isDeepStrictEqual(existing[key], value)) {
      return false;
    }
  }
  return true;
}

function modelApplyConformanceHint(type: string): string {
  return `Hint: run \`geonic models update ${type} --api-dry-run\` to list entity impact.`;
}

/**
 * Reject path-segment lookalikes that survive encodeURIComponent unchanged
 * (`.` / `..`) and would otherwise resolve oddly in `/custom-data-models/{type}`.
 * Returns an error message, or undefined when the type is acceptable for apply.
 */
export function modelApplyTypeError(type: string): string | undefined {
  if (type === "." || type === "..") {
    return `Model type must not be "." or ".." (got ${JSON.stringify(type)}).`;
  }
  return undefined;
}

/**
 * Re-throw PATCH 400 with a one-line dry-run hint. Other statuses / errors
 * propagate unchanged (do not infer "already exists" from message text).
 */
export function rethrowModelApplyPatchError(err: unknown, type: string): never {
  if (err instanceof GdbClientError && err.status === 400) {
    throw new Error(`${err.message}\n${modelApplyConformanceHint(type)}`);
  }
  throw err;
}

/**
 * Apply dry-run side effects: warn on truncated / scopeLimited / undetermined,
 * reject responses that are not a dry-run report, and fail the process when any
 * existing entity would violate the updated model (including uniqueConstraints).
 * Returns the exit code that was set (0 or 1) for testability.
 */
export function applyModelUpdateDryRunResult(data: unknown): number {
  const body = (data ?? {}) as ModelUpdateDryRunResponse;
  const conformance = body.conformance;

  if (body.dryRun !== true || conformance == null || typeof conformance !== "object") {
    printWarning(
      "Response is not an API dry-run conformance report; the server may not support ?dryRun=true and the update may have been applied.",
    );
    process.exitCode = 1;
    return 1;
  }

  if (conformance.truncated) {
    printWarning(
      `Dry-run scan truncated at maxScan=${conformance.maxScan ?? "?"}; scanned/violating counts are lower bounds.`,
    );
  }
  if (conformance.scopeLimited) {
    printWarning(
      "Dry-run scan was limited to entities readable by the caller (scopeLimited); counts may under-report.",
    );
  }
  const undetermined = conformance.undetermined ?? 0;
  if (undetermined > 0) {
    printWarning(
      `Dry-run could not determine conformance for ${undetermined} entities; review them manually.`,
    );
  }

  const violating = conformance.violating ?? 0;
  const ucViolations = conformance.uniqueConstraintViolations;
  const hasUcViolations = Array.isArray(ucViolations) && ucViolations.length > 0;
  if (violating > 0 || hasUcViolations) {
    process.exitCode = 1;
    return 1;
  }
  return 0;
}

export function registerModelsCommand(program: Command): void {
  const models = program
    .command("custom-data-models")
    .alias("models")
    .description("Manage custom data models that define entity type schemas and property constraints");

  // models list
  const list = models
    .command("list")
    .description("List all registered data models for the current tenant")
    .option("--limit <n>", "Maximum number of results", parseNonNegativeInt)
    .option("--offset <n>", "Skip N results", parseNonNegativeInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await fetchPaginatedList(client, "/custom-data-models", cmd.opts());
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all data models as JSON",
      command: "geonic models list",
    },
    {
      description: "Browse available data models in table format",
      command: "geonic models list --format table",
    },
    {
      description: "List with pagination",
      command: "geonic models list --limit 50 --offset 100",
    },
  ]);

  // models get
  const get = models
    .command("get <id>")
    .description("Get a data model's full schema including property definitions, validation rules, and unique constraints")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/custom-data-models/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Inspect a model's property definitions",
      command: "geonic models get <model-id>",
    },
    {
      description: "View the schema for a Sensor data model",
      command: "geonic models get urn:ngsi-ld:DataModel:Sensor",
    },
  ]);

  // models missing-types — GET /custom-data-models/missing-types (GeonicDB #3477 / CLI #244)
  const missingTypes = models
    .command("missing-types")
    .summary("List entity types with no active data model")
    .description(
      "List live entity types that have no active custom data model (GeonicDB extension).\n\n" +
        "Calls GET /custom-data-models/missing-types. Different axis from `types list`\n" +
        "(types that exist): this returns types whose model is missing or inactive\n" +
        "(useful before enabling settings.requireDataModel). No pagination; the server may\n" +
        "set truncated: true when the type cap is hit. type is the stored string (not compacted).\n" +
        "If scopeLimited or truncated is true, types may be incomplete even when empty —\n" +
        "do not treat that alone as proof that requireDataModel is safe to enable.",
    )
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/custom-data-models/missing-types");
        outputResponse(response, format);
      }),
    );

  addExamples(missingTypes, [
    {
      description: "List types without an active data model (JSON)",
      command: "geonic models missing-types",
    },
    {
      description: "Same report in table format",
      command: "geonic models missing-types --format table",
    },
  ]);

  // models create
  const create = models
    .command("create [json]")
    .summary("Create a new model")
    .description(
      "Create a new model\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "type": "Sensor",\n' +
        '    "domain": "iot",\n' +
        '    "description": "IoT Sensor",\n' +
        '    "propertyDetails": {\n' +
        '      "temperature": {"ngsiType": "Property", "valueType": "Number", "example": 25}\n' +
        "    }\n" +
        "  }\n\n" +
        "Optional uniqueConstraints (composite unique, enforced server-side):\n" +
        '  "uniqueConstraints": [{"name": "one-booking-per-slot", "fields": ["room", "date", "startTime"]}]\n' +
        "  Fields must be declared in propertyDetails with a scalar valueType.\n" +
        "  Duplicate entities are rejected with 409 AlreadyExists (constraint name in the message).\n" +
        "  A composite constraint matches an exact tuple: it rejects duplicate values, not overlapping\n" +
        "  ranges (e.g. a 10:00-11:00 booking does not block a 10:30-11:30 booking on the same room/date).\n" +
        "Optional typeIri (HTTP(S) URL): entity type IRI in the auto-generated @context (fixed at create; not combinable with contextUrl).\n" +
        "Optional contextUrl: external JSON-LD @context URL (not combinable with typeIri).",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/custom-data-models", { body });
        outputResponse(response, format);
        printSuccess("Model created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic models create '{"type":"Sensor","domain":"iot","description":"IoT Sensor","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25}}}'`,
    },
    {
      description: "Create from a file",
      command: "geonic models create @model.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat model.json | geonic models create",
    },
    {
      description: "Create with a composite unique constraint (one booking per slot)",
      command: `geonic models create '{"type":"RoomReservation","domain":"building","description":"Room reservation","propertyDetails":{"room":{"ngsiType":"Property","valueType":"string","example":"R1"},"date":{"ngsiType":"Property","valueType":"string","example":"2026-07-15"},"startTime":{"ngsiType":"Property","valueType":"string","example":"10:00"}},"uniqueConstraints":[{"name":"one-booking-per-slot","fields":["room","date","startTime"]}]}'`,
    },
  ]);

  // models update
  const update = models
    .command("update <id> [json]")
    .summary("Update a model")
    .description(
      "Update a model\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"description": "Updated model"}\n\n' +
        "uniqueConstraints replaces the whole constraint list (send [] to remove all).\n" +
        "Adding a constraint fails with 400 if existing entities already violate it.\n" +
        "typeIri cannot be changed after create (same value ok; omit to keep).\n" +
        "contextUrl cannot be set on a model that has typeIri.\n\n" +
        "--api-dry-run sends PATCH ?dryRun=true (GeonicDB extension): the update is NOT\n" +
        "applied; the response is a conformance report for existing entities. Exit code is\n" +
        "non-zero when conformance.violating > 0. Distinct from the global --dry-run (curl).",
    )
    .option(
      "--api-dry-run",
      "Preview update without applying it (PATCH ?dryRun=true); report entity conformance",
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, opts: { apiDryRun?: boolean }, cmd: Command) => {
          const apiDryRun = !!opts.apiDryRun;
          const globalDryRun = !!(cmd.optsWithGlobals() as { dryRun?: boolean }).dryRun;
          if (apiDryRun && globalDryRun) {
            printError(
              "Cannot combine --api-dry-run with global --dry-run; omit --dry-run to run the API conformance check.",
            );
            process.exitCode = 1;
            return;
          }
          const body = await parseJsonInput(json as string | undefined);
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/custom-data-models/${encodeURIComponent(String(id))}`,
            apiDryRun ? { body, params: { dryRun: "true" } } : { body },
          );
          outputResponse(response, format);
          if (apiDryRun) {
            applyModelUpdateDryRunResult(response.data);
            return;
          }
          printSuccess("Model updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic models update <model-id> '{"description":"Updated description"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic models update <model-id> @model.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat model.json | geonic models update <model-id>",
    },
    {
      description: "Replace unique constraints",
      command: `geonic models update RoomReservation '{"uniqueConstraints":[{"name":"one-booking-per-slot","fields":["room","date","startTime"]}]}'`,
    },
    {
      description: "Remove all unique constraints",
      command: `geonic models update RoomReservation '{"uniqueConstraints":[]}'`,
    },
    {
      description: "Preview a tightening update without applying it (API dry-run)",
      command: `geonic models update TemperatureSensor '{"propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","validation":{"maximum":30}}}}' --api-dry-run`,
    },
  ]);

  // models apply — upsert by type (#238)
  const apply = models
    .command("apply [json]")
    .summary("Create or update a model by type")
    .description(
      "Create a model if missing, or update it if present (idempotent upsert by type).\n\n" +
        "Looks up GET /custom-data-models/{type} first (does not infer existence from\n" +
        "create error messages). Missing → POST with the body as-is. Present → strips\n" +
        "`type` and PATCHes; when every field already matches the stored model, skips\n" +
        "PATCH and reports unchanged.\n\n" +
        "Stdout is a machine-readable result:\n" +
        '  {"type":"<type>","result":"created"|"updated"|"unchanged"|"would create"}\n\n' +
        "--api-dry-run: if missing, prints result \"would create\" without POSTing;\n" +
        "if present and changed, sends PATCH ?dryRun=true (same as update --api-dry-run).\n" +
        "Distinct from the global --dry-run (curl).",
    )
    .option(
      "--api-dry-run",
      "Preview without writing: would-create when missing, or PATCH ?dryRun=true when updating",
    )
    .action(
      withErrorHandler(async (json: unknown, opts: { apiDryRun?: boolean }, cmd: Command) => {
        const apiDryRun = !!opts.apiDryRun;
        const globalDryRun = !!(cmd.optsWithGlobals() as { dryRun?: boolean }).dryRun;
        if (apiDryRun && globalDryRun) {
          printError(
            "Cannot combine --api-dry-run with global --dry-run; omit --dry-run to run the API conformance check.",
          );
          process.exitCode = 1;
          return;
        }

        const parsed = await parseJsonInput(json as string | undefined);
        if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
          printError("Model body must be a JSON object with a string \"type\" field.");
          process.exitCode = 1;
          return;
        }
        const body = parsed as Record<string, unknown>;
        const type = body.type;
        if (typeof type !== "string" || type.length === 0) {
          printError('Model body must include a non-empty string "type" field.');
          process.exitCode = 1;
          return;
        }
        const typeErr = modelApplyTypeError(type);
        if (typeErr) {
          printError(typeErr);
          process.exitCode = 1;
          return;
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const encodedPath = `/custom-data-models/${encodeURIComponent(type)}`;
        const patchBody = stripTypeFromModelBody(body);

        let existing: Record<string, unknown> | undefined;
        try {
          const getResponse = await client.rawRequest("GET", encodedPath);
          existing = (getResponse.data ?? {}) as Record<string, unknown>;
        } catch (err: unknown) {
          if (!(err instanceof GdbClientError) || err.status !== 404) {
            throw err;
          }
        }

        if (existing === undefined) {
          if (apiDryRun) {
            printOutput({ type, result: "would create" satisfies ModelApplyResult }, format);
            return;
          }
          try {
            await client.rawRequest("POST", "/custom-data-models", { body });
          } catch (err: unknown) {
            // Concurrent create: GET raced. Retry once with PATCH; do not
            // treat other 4xx (e.g. 400 already-exists wording) as success.
            if (!(err instanceof GdbClientError) || err.status !== 409) {
              throw err;
            }
            try {
              await client.rawRequest("PATCH", encodedPath, { body: patchBody });
            } catch (patchErr: unknown) {
              rethrowModelApplyPatchError(patchErr, type);
            }
            printOutput({ type, result: "updated" satisfies ModelApplyResult }, format);
            return;
          }
          printOutput({ type, result: "created" satisfies ModelApplyResult }, format);
          return;
        }

        if (isModelPatchUnchanged(existing, patchBody)) {
          printOutput({ type, result: "unchanged" satisfies ModelApplyResult }, format);
          return;
        }

        try {
          const response = await client.rawRequest(
            "PATCH",
            encodedPath,
            apiDryRun ? { body: patchBody, params: { dryRun: "true" } } : { body: patchBody },
          );
          if (apiDryRun) {
            outputResponse(response, format);
            applyModelUpdateDryRunResult(response.data);
            return;
          }
        } catch (err: unknown) {
          rethrowModelApplyPatchError(err, type);
        }
        printOutput({ type, result: "updated" satisfies ModelApplyResult }, format);
      }),
    );

  addExamples(apply, [
    {
      description: "Create or update from a datamodels.jp definition (type included)",
      command: "geonic models apply @model.json",
    },
    {
      description: "Idempotent apply from stdin",
      command: "cat model.json | geonic models apply",
    },
    {
      description: "Preview entity impact before updating an existing model",
      command: "geonic models apply @model.json --api-dry-run",
    },
  ]);

  // models delete
  const del = models
    .command("delete <id>")
    .description("Delete a data model definition (does not affect existing entities)")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/custom-data-models/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Model deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a data model by ID",
      command: "geonic models delete <model-id>",
    },
    {
      description: "Remove a deprecated model definition",
      command: "geonic models delete urn:ngsi-ld:DataModel:LegacySensor",
    },
  ]);
}
