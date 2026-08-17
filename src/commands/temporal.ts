import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
  parsePositiveInt,
  surfaceNgsiWarning,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

/**
 * #181/#188: NGSI-LD temporal representation parameters, valid on the GET
 * retrieval paths (`temporal entities list` / `get`, geolonia/geonicdb#1804 /
 * #1814 / #1817) and on `temporal entityOperations query` (POST), where the
 * server accepts the same parameters in the query string as a fallback for the
 * body's `temporalQ` object (geolonia/geonicdb#1816; servers up to v0.16.0
 * silently ignore aggregation on the POST route — see README).
 *
 * `--options` maps to the NGSI-LD `options` query parameter — NOT to the CLI's
 * own `--format` (json/table output), which is why the NGSI-LD `format`
 * parameter gets no flag of its own: everything it can express is already
 * expressible through `options`, and a second, differently-named flag whose
 * server-side value silently overrides `options` (ETSI GS CIM 009 clause
 * 6.3.12) would only invite confusion.
 */
function addRepresentationOptions(cmd: Command): Command {
  return cmd
    .option(
      "--options <keywords>",
      "NGSI-LD representation (comma-separated): temporalValues (alias simplified), aggregatedValues, sysAttrs",
    )
    .option("--aggr-methods <methods>", "Aggregation methods (e.g. avg,sum,totalCount)")
    .option("--aggr-period <period>", "Aggregation period duration (ISO 8601, e.g. PT1H)");
}

/**
 * Build the representation query parameters, failing fast on the combinations
 * the server deterministically rejects with 400 (or silently ignores) — so the
 * operator sees an actionable message before a request is spent:
 *   - `temporalValues`/`simplified` and `aggregatedValues` are mutually
 *     exclusive keywords (ETSI GS CIM 009 clause 6.3.12)
 *   - `aggregatedValues` requires `aggrMethods` (Table 6.19.3.1-1)
 *   - `aggrMethods` requires `aggrPeriodDuration` (the server rejects
 *     aggregation without a period on every route)
 *   - `aggrPeriodDuration` without `aggrMethods` is a silent no-op server-side
 *     — the exact class #188 exists to eliminate
 * Everything else is passed through — the server is the authority on the
 * vocabulary, and mirroring its full validation here would just go stale.
 * Whitespace-only flag values are treated as absent, matching the server
 * (`aggrMethods.trim().length === 0` is "not specified" there).
 */
function buildRepresentationParams(cmdOpts: {
  options?: string;
  aggrMethods?: string;
  aggrPeriod?: string;
}): Record<string, string> {
  const params: Record<string, string> = {};
  const keywords = (cmdOpts.options ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const aggrMethods = cmdOpts.aggrMethods?.trim() ?? "";
  const aggrPeriod = cmdOpts.aggrPeriod?.trim() ?? "";

  const hasAggregated = keywords.includes("aggregatedValues");
  const hasTemporal = keywords.includes("temporalValues") || keywords.includes("simplified");
  if (hasAggregated && hasTemporal) {
    throw new Error(
      "--options cannot combine temporalValues/simplified with aggregatedValues — " +
        "only one representation keyword is allowed (ETSI GS CIM 009 clause 6.3.12).",
    );
  }
  if (hasAggregated && !aggrMethods) {
    throw new Error(
      "--options aggregatedValues requires --aggr-methods " +
        "(e.g. --aggr-methods avg --aggr-period PT1H) " +
        "(ETSI GS CIM 009 clause 6.3.12, Table 6.19.3.1-1).",
    );
  }
  if (aggrMethods && !aggrPeriod) {
    throw new Error(
      "--aggr-methods requires --aggr-period (e.g. --aggr-period PT1H) — " +
        "the server rejects aggregation without a period duration.",
    );
  }
  if (aggrPeriod && !aggrMethods) {
    throw new Error(
      "--aggr-period requires --aggr-methods (e.g. --aggr-methods avg) — " +
        "a period without aggregation methods is silently ignored by the server.",
    );
  }

  if (keywords.length > 0) params["options"] = keywords.join(",");
  if (aggrMethods) params["aggrMethods"] = aggrMethods;
  if (aggrPeriod) params["aggrPeriodDuration"] = aggrPeriod;
  return params;
}

function addTemporalListOptions(cmd: Command): Command {
  return addRepresentationOptions(cmd)
    .option("--type <type>", "Filter by entity type")
    .option("--attrs <a,b>", "Comma-separated list of attributes to include")
    .option("--query <q>", "NGSI query expression")
    .option("--georel <rel>", "Geo-relationship (e.g. near;maxDistance:1000)")
    .option("--geometry <geo>", "Geometry type for geo-query (e.g. point)")
    .option("--coords <coords>", "Coordinates for geo-query")
    .option("--time-rel <rel>", "Temporal relationship (before, after, between)")
    .option("--time-at <time>", "Temporal query start time (ISO 8601)")
    .option("--end-time-at <time>", "Temporal query end time (ISO 8601)")
    .option(
      "--time-property <name>",
      "Temporal property to compare (observedAt, createdAt, modifiedAt, deletedAt; default observedAt)",
    )
    .option(
      "--last-n <n>",
      "Return last N instances per attribute (server default caps to 100; max 1000)",
      parsePositiveInt,
    )
    .option("--limit <n>", "Maximum number of entities to return", parseInt)
    .option("--offset <n>", "Skip first N entities", parseInt)
    .option(
      "--order-by <spec>",
      "Order by NGSI-LD v1.9.1 grammar (e.g. observedAt;desc). Server rejects dist-*/geo:distance, nested paths, aggrMethods combos.",
    )
    .option("--count", "Include total count in response");
}

function createListAction() {
  return withErrorHandler(async (_opts: unknown, cmd: Command) => {
    const client = createClient(cmd);
    const format = getFormat(cmd);
    const cmdOpts = cmd.opts();

    const params: Record<string, string> = {};

    if (cmdOpts.type) params["type"] = cmdOpts.type;
    if (cmdOpts.attrs) params["attrs"] = cmdOpts.attrs;
    if (cmdOpts.query) params["q"] = cmdOpts.query;
    if (cmdOpts.georel) params["georel"] = cmdOpts.georel;
    if (cmdOpts.geometry) params["geometry"] = cmdOpts.geometry;
    if (cmdOpts.coords) params["coordinates"] = cmdOpts.coords;
    if (cmdOpts.timeRel) params["timerel"] = cmdOpts.timeRel;
    if (cmdOpts.timeAt) params["timeAt"] = cmdOpts.timeAt;
    if (cmdOpts.endTimeAt) params["endTimeAt"] = cmdOpts.endTimeAt;
    // undefined only = flag absent (server default observedAt). Empty string is
    // forwarded so the server can 400 BadRequestData on unknown values (#202).
    if (cmdOpts.timeProperty !== undefined) {
      params["timeproperty"] = cmdOpts.timeProperty;
    }
    if (cmdOpts.lastN !== undefined) params["lastN"] = String(cmdOpts.lastN);
    if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
    if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);
    if (cmdOpts.orderBy) params["orderBy"] = cmdOpts.orderBy;
    if (cmdOpts.count) params["count"] = "true";
    Object.assign(params, buildRepresentationParams(cmdOpts));
    // The aggregation pipeline sorts by entityId and cannot honor orderBy; the
    // server rejects the combination with 400 — fail fast like the other
    // deterministic 400s above.
    if (params["orderBy"] && params["aggrMethods"]) {
      throw new Error(
        "--order-by cannot be combined with --aggr-methods — " +
          "the server rejects ordering on aggregated results (aggregations are sorted by entity ID).",
      );
    }

    const response = await client.get("/temporal/entities", params);
    surfaceNgsiWarning(response.headers);
    outputResponse(response, format, cmdOpts.count);
  });
}

function addTemporalGetOptions(cmd: Command): Command {
  return addRepresentationOptions(cmd)
    .option("--attrs <a,b>", "Comma-separated list of attributes to include")
    .option("--time-rel <rel>", "Temporal relationship (before, after, between)")
    .option("--time-at <time>", "Temporal query start time (ISO 8601)")
    .option("--end-time-at <time>", "Temporal query end time (ISO 8601)")
    .option(
      "--time-property <name>",
      "Temporal property to compare (observedAt, createdAt, modifiedAt, deletedAt; default observedAt)",
    )
    .option(
      "--last-n <n>",
      "Return last N instances per attribute (server default caps to 100; max 1000)",
      parsePositiveInt,
    );
}

function createGetAction() {
  return withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
    const client = createClient(cmd);
    const format = getFormat(cmd);
    const cmdOpts = cmd.opts();

    const params: Record<string, string> = {};

    if (cmdOpts.attrs) params["attrs"] = cmdOpts.attrs;
    if (cmdOpts.timeRel) params["timerel"] = cmdOpts.timeRel;
    if (cmdOpts.timeAt) params["timeAt"] = cmdOpts.timeAt;
    if (cmdOpts.endTimeAt) params["endTimeAt"] = cmdOpts.endTimeAt;
    // undefined only = flag absent (server default observedAt). Empty string is
    // forwarded so the server can 400 BadRequestData on unknown values (#202).
    if (cmdOpts.timeProperty !== undefined) {
      params["timeproperty"] = cmdOpts.timeProperty;
    }
    if (cmdOpts.lastN !== undefined) params["lastN"] = String(cmdOpts.lastN);
    Object.assign(params, buildRepresentationParams(cmdOpts));

    const response = await client.get(
      `/temporal/entities/${encodeURIComponent(String(id))}`,
      params,
    );
    surfaceNgsiWarning(response.headers);
    outputResponse(response, format);
  });
}

function createCreateAction() {
  return withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
    const body = await parseJsonInput(json as string | undefined);
    const client = createClient(cmd);

    await client.post("/temporal/entities", body);
    printSuccess("Temporal entity created.");
  });
}

function createDeleteAction() {
  return withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
    const client = createClient(cmd);

    await client.delete(
      `/temporal/entities/${encodeURIComponent(String(id))}`,
    );
    printSuccess("Temporal entity deleted.");
  });
}

/**
 * #188: the `--aggr-methods` / `--aggr-period` flags this command accepted
 * before v0.24.0 were a silent no-op — the server implemented no aggregation on
 * the POST route and returned a normal, un-aggregated time series.
 * geolonia/geonicdb#1816 closed that gap server-side, explicitly accepting the
 * query-string shape this CLI sends as a fallback for the spec-canonical
 * `temporalQ` body object (Table 5.2.21-1, body takes precedence), with the
 * same validation as the GET route (clause 6.24.3.1: POST mirrors 6.18.3.2).
 * The flags are therefore wired for real and share `buildRepresentationParams`
 * with the GET paths, so the same deterministic-400 combinations fail fast
 * before a request is spent. Servers up to v0.16.0 still ignore aggregation
 * here — the README documents the server-version requirement.
 */
function createQueryAction() {
  return withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
    const body = await parseJsonInput(json as string | undefined);
    const client = createClient(cmd);
    const format = getFormat(cmd);
    const params = buildRepresentationParams(cmd.opts());

    const response =
      Object.keys(params).length > 0
        ? await client.post("/temporal/entityOperations/query", body, params)
        : await client.post("/temporal/entityOperations/query", body);
    surfaceNgsiWarning(response.headers);
    outputResponse(response, format);
  });
}

export function registerTemporalCommand(program: Command): void {
  const temporal = program
    .command("temporal")
    .description("Manage temporal entities");

  const entities = temporal
    .command("entities")
    .description("List, get, create, and delete temporal entities");

  const entityOperations = temporal
    .command("entityOperations")
    .description("Perform batch operations on temporal entities");

  // temporal entities list
  const entitiesList = addTemporalListOptions(
    entities.command("list").description("List temporal entities with optional filters"),
  );
  entitiesList.action(createListAction());

  addExamples(entitiesList, [
    {
      description: "List by type with time range",
      command:
        "geonic temporal entities list --type Sensor --time-rel between --time-at 2025-01-01T00:00:00Z --end-time-at 2025-01-31T23:59:59Z",
    },
    {
      description: "Get last 5 temporal values",
      command: "geonic temporal entities list --type Sensor --last-n 5",
    },
    {
      description: "Filter by time (after a point)",
      command:
        "geonic temporal entities list --time-rel after --time-at 2025-06-01T00:00:00Z",
    },
    {
      description: "Filter by creation time (timeproperty=createdAt)",
      command:
        "geonic temporal entities list --time-rel after --time-at 2025-06-01T00:00:00Z --time-property createdAt",
    },
    {
      description: "Order temporal entities (NGSI-LD v1.9.1 grammar)",
      command: "geonic temporal entities list --type Sensor --order-by 'observedAt;desc'",
    },
    {
      description: "Simplified time series ([value, timestamp] pairs)",
      command: "geonic temporal entities list --type Sensor --options temporalValues",
    },
    {
      description: "Hourly averages (aggregated representation)",
      command:
        "geonic temporal entities list --type Sensor --options aggregatedValues --aggr-methods avg --aggr-period PT1H",
    },
  ]);

  // temporal entities get
  const entitiesGet = addTemporalGetOptions(
    entities.command("get <id>").description("Get a temporal entity by ID"),
  );
  entitiesGet.action(createGetAction());

  addExamples(entitiesGet, [
    {
      description: "Get temporal entity with specific attributes",
      command:
        "geonic temporal entities get urn:ngsi-ld:Sensor:001 --attrs temperature,humidity",
    },
    {
      description: "Get last 10 values for an entity",
      command: "geonic temporal entities get urn:ngsi-ld:Sensor:001 --last-n 10",
    },
  ]);

  // temporal entities create
  const create = entities
    .command("create [json]")
    .summary("Create a temporal entity")
    .description(
      "Create a temporal entity\n\n" +
        "JSON payload: an NGSI-LD entity with temporal attribute instances.\n" +
        "Each attribute value is an array of {value, observedAt} objects.",
    )
    .action(createCreateAction());

  addExamples(create, [
    {
      description: "Create from a file",
      command: "geonic temporal entities create @temporal-entity.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat temporal-entity.json | geonic temporal entities create",
    },
    {
      description: "Interactive mode",
      command: "geonic temporal entities create",
    },
  ]);

  // temporal entities delete
  const del = entities
    .command("delete <id>")
    .description("Delete a temporal entity and all its historical attribute data")
    .action(createDeleteAction());

  addExamples(del, [
    {
      description: "Delete temporal data for an entity",
      command: "geonic temporal entities delete urn:ngsi-ld:Sensor:001",
    },
    {
      description: "Remove all historical records for a specific entity",
      command: "geonic temporal entities delete urn:ngsi-ld:WeatherStation:tokyo-01",
    },
  ]);

  // temporal entityOperations query
  const opsQuery = addRepresentationOptions(
    entityOperations
      .command("query [json]")
      .summary("Query temporal entities (POST)")
      .description(
        "Query temporal entities (POST)\n\n" +
          "Aggregation flags are sent in the query string (the server also accepts them in " +
          "the body's temporalQ object, which takes precedence). Requires geonicdb with " +
          "geolonia/geonicdb#1816; older servers (<= v0.16.0) silently ignore aggregation " +
          "here — use `temporal entities list --options aggregatedValues` against those.",
      ),
  );
  opsQuery.action(createQueryAction());

  addExamples(opsQuery, [
    {
      description: "Query with inline JSON",
      command: `geonic temporal entityOperations query '{"entities":[{"type":"Sensor"}],"attrs":["temperature"]}'`,
    },
    {
      description: "Query from a file",
      command: "geonic temporal entityOperations query @query.json",
    },
    {
      description: "Aggregated batch query (hourly averages)",
      command: `geonic temporal entityOperations query '{"entities":[{"type":"Sensor"}]}' --aggr-methods avg --aggr-period PT1H`,
    },
  ]);

  // Backward-compatible hidden aliases at the temporal level
  addTemporalListOptions(
    temporal
      .command("list", { hidden: true })
      .description("List temporal entities (deprecated: use temporal entities list)"),
  ).action(createListAction());

  addTemporalGetOptions(
    temporal
      .command("get <id>", { hidden: true })
      .description("Get a temporal entity (deprecated: use temporal entities get)"),
  ).action(createGetAction());

  temporal
    .command("create [json]", { hidden: true })
    .description("Create a temporal entity (deprecated: use temporal entities create)")
    .action(createCreateAction());

  temporal
    .command("delete <id>", { hidden: true })
    .description("Delete a temporal entity (deprecated: use temporal entities delete)")
    .action(createDeleteAction());

  addRepresentationOptions(
    temporal
      .command("query [json]", { hidden: true })
      .description("Query temporal entities (deprecated: use temporal entityOperations query)"),
  ).action(createQueryAction());
}
