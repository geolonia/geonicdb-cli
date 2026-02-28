import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
  resolveOptions,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";

function requireLd(cmd: Command): void {
  const opts = resolveOptions(cmd);
  if (opts.api !== "ld") {
    throw new Error("Temporal commands are only available with NGSI-LD (--api ld).");
  }
}

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
    requireLd(cmd);

    const client = createClient(cmd);
    const format = getFormat(cmd);
    const cmdOpts = cmd.opts();

    const params: Record<string, string> = {};

    if (cmdOpts.type) params["type"] = cmdOpts.type;
    if (cmdOpts.attrs) params["attrs"] = cmdOpts.attrs;
    if (cmdOpts.query) params["q"] = cmdOpts.query;
    if (cmdOpts.georel) params["georel"] = cmdOpts.georel;
    if (cmdOpts.geometry) params["geometry"] = cmdOpts.geometry;
    if (cmdOpts.coords) params["coords"] = cmdOpts.coords;
    if (cmdOpts.timeRel) params["timerel"] = cmdOpts.timeRel;
    if (cmdOpts.timeAt) params["timeAt"] = cmdOpts.timeAt;
    if (cmdOpts.endTimeAt) params["endTimeAt"] = cmdOpts.endTimeAt;
    if (cmdOpts.lastN !== undefined) params["lastN"] = String(cmdOpts.lastN);
    if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
    if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);
    if (cmdOpts.count) params["options"] = "count";

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
    requireLd(cmd);

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
    requireLd(cmd);

    const body = parseJsonInput(String(json));
    const client = createClient(cmd);

    await client.post("/temporal/entities", body);
    printSuccess("Temporal entity created.");
  });
}

function createDeleteAction() {
  return withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
    requireLd(cmd);

    const client = createClient(cmd);

    await client.delete(
      `/temporal/entities/${encodeURIComponent(String(id))}`,
    );
    printSuccess("Temporal entity deleted.");
  });
}

function createQueryAction() {
  return withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
    requireLd(cmd);

    const body = parseJsonInput(String(json));
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
    .description("NGSI-LD temporal entity operations");

  const entities = temporal
    .command("entities")
    .description("Temporal entity CRUD operations");

  const entityOperations = temporal
    .command("entityOperations")
    .description("Temporal entity batch operations");

  // temporal entities list
  addTemporalListOptions(
    entities.command("list").description("List temporal entities with optional filters"),
  ).action(createListAction());

  // temporal entities get
  addTemporalGetOptions(
    entities.command("get <id>").description("Get a temporal entity by ID"),
  ).action(createGetAction());

  // temporal entities create
  entities
    .command("create <json>")
    .description("Create a temporal entity")
    .action(createCreateAction());

  // temporal entities delete
  entities
    .command("delete <id>")
    .description("Delete a temporal entity by ID")
    .action(createDeleteAction());

  // temporal entityOperations query
  addQueryOptions(
    entityOperations.command("query <json>").description("Query temporal entities (POST)"),
  ).action(createQueryAction());

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
    .command("create <json>", { hidden: true })
    .description("Create a temporal entity (deprecated: use temporal entities create)")
    .action(createCreateAction());

  temporal
    .command("delete <id>", { hidden: true })
    .description("Delete a temporal entity (deprecated: use temporal entities delete)")
    .action(createDeleteAction());

  addQueryOptions(
    temporal
      .command("query <json>", { hidden: true })
      .description("Query temporal entities (deprecated: use temporal entityOperations query)"),
  ).action(createQueryAction());
}
