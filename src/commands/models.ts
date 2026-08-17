import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse, parseNonNegativeInt, fetchPaginatedList } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess, printWarning, printError } from "../output.js";
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
        '  "uniqueConstraints": [{"name": "no-double-booking", "fields": ["room", "date", "startTime"]}]\n' +
        "  Fields must be declared in propertyDetails with a scalar valueType.\n" +
        "  Duplicate entities are rejected with 409 AlreadyExists (constraint name in the message).",
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
      description: "Create with a composite unique constraint (no double booking)",
      command: `geonic models create '{"type":"RoomReservation","domain":"building","description":"Room reservation","propertyDetails":{"room":{"ngsiType":"Property","valueType":"string","example":"R1"},"date":{"ngsiType":"Property","valueType":"string","example":"2026-07-15"},"startTime":{"ngsiType":"Property","valueType":"string","example":"10:00"}},"uniqueConstraints":[{"name":"no-double-booking","fields":["room","date","startTime"]}]}'`,
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
        "Adding a constraint fails with 400 if existing entities already violate it.\n\n" +
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
      command: `geonic models update RoomReservation '{"uniqueConstraints":[{"name":"no-double-booking","fields":["room","date","startTime"]}]}'`,
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
