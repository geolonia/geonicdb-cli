import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

function addTemporalListOptions(cmd: Command): Command {
  return cmd
    .option("--type <type>", "Filter by entity type")
    .option("--attrs <a,b>", "Comma-separated list of attributes to include")
    .option("--query <q>", "NGSI query expression")
    .option("--georel <rel>", "Geo-relationship (e.g. near;maxDistance:1000)")
    .option("--geometry <geo>", "Geometry type for geo-query (e.g. point)")
    .option("--coords <coords>", "Coordinates for geo-query")
    .option("--time-rel <rel>", "Temporal relationship (before, after, between)")
    .option("--time-at <time>", "Temporal query start time (ISO 8601)")
    .option("--end-time-at <time>", "Temporal query end time (ISO 8601)")
    .option("--last-n <n>", "Return last N temporal values", parseInt)
    .option("--limit <n>", "Maximum number of entities to return", parseInt)
    .option("--offset <n>", "Skip first N entities", parseInt)
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
    if (cmdOpts.lastN !== undefined) params["lastN"] = String(cmdOpts.lastN);
    if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
    if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);
    if (cmdOpts.count) params["count"] = "true";

    const response = await client.get("/temporal/entities", params);
    outputResponse(response, format, cmdOpts.count);
  });
}

function addTemporalGetOptions(cmd: Command): Command {
  return cmd
    .option("--attrs <a,b>", "Comma-separated list of attributes to include")
    .option("--time-rel <rel>", "Temporal relationship (before, after, between)")
    .option("--time-at <time>", "Temporal query start time (ISO 8601)")
    .option("--end-time-at <time>", "Temporal query end time (ISO 8601)")
    .option("--last-n <n>", "Return last N temporal values", parseInt);
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
    if (cmdOpts.lastN !== undefined) params["lastN"] = String(cmdOpts.lastN);

    const response = await client.get(
      `/temporal/entities/${encodeURIComponent(String(id))}`,
      params,
    );
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

function createQueryAction() {
  return withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
    const body = await parseJsonInput(json as string | undefined);
    const client = createClient(cmd);
    const format = getFormat(cmd);
    const cmdOpts = cmd.opts();

    const params: Record<string, string> = {};

    if (cmdOpts.aggrMethods) params["aggrMethods"] = cmdOpts.aggrMethods;
    if (cmdOpts.aggrPeriod) params["aggrPeriodDuration"] = cmdOpts.aggrPeriod;

    const response = await client.post(
      "/temporal/entityOperations/query",
      body,
      params,
    );
    outputResponse(response, format);
  });
}

function addQueryOptions(cmd: Command): Command {
  return cmd
    .option("--aggr-methods <methods>", "Aggregation methods (e.g. totalCount,sum)")
    .option("--aggr-period <period>", "Aggregation period (e.g. PT1H)");
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
    .description("Delete a temporal entity by ID")
    .action(createDeleteAction());

  addExamples(del, [
    {
      description: "Delete temporal data for an entity",
      command: "geonic temporal entities delete urn:ngsi-ld:Sensor:001",
    },
  ]);

  // temporal entityOperations query
  const opsQuery = addQueryOptions(
    entityOperations.command("query [json]").description("Query temporal entities (POST)"),
  );
  opsQuery.action(createQueryAction());

  addExamples(opsQuery, [
    {
      description: "Query with inline JSON",
      command: `geonic temporal entityOperations query '{"entities":[{"type":"Sensor"}],"attrs":["temperature"]}'`,
    },
    {
      description: "Query with aggregation (hourly count)",
      command:
        "geonic temporal entityOperations query @query.json --aggr-methods totalCount --aggr-period PT1H",
    },
    {
      description: "Query from a file",
      command: "geonic temporal entityOperations query @query.json",
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

  addQueryOptions(
    temporal
      .command("query [json]", { hidden: true })
      .description("Query temporal entities (deprecated: use temporal entityOperations query)"),
  ).action(createQueryAction());
}
