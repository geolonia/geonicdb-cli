import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { registerAttrsSubcommand } from "./attrs.js";

export function registerEntitiesCommand(program: Command): void {
  const entities = program
    .command("entities")
    .description("Manage context entities");

  // entities list
  entities
    .command("list")
    .description("List entities with optional filters")
    .option("--type <type>", "Filter by entity type")
    .option("--id-pattern <pat>", "Filter by entity ID pattern (regex)")
    .option("--query <q>", "NGSI query expression")
    .option("--attrs <a,b>", "Comma-separated list of attributes to include")
    .option("--georel <rel>", "Geo-relationship (e.g. near;maxDistance:1000)")
    .option("--geometry <geo>", "Geometry type for geo-query (e.g. point)")
    .option("--coords <coords>", "Coordinates for geo-query")
    .option("--spatial-id <zfxy>", "Spatial ID filter (ZFXY tile)")
    .option("--limit <n>", "Maximum number of entities to return", parseInt)
    .option("--offset <n>", "Skip first N entities", parseInt)
    .option("--order-by <field>", "Order results by field")
    .option("--count", "Include total count in response")
    .action(
      withErrorHandler(async (opts: Record<string, unknown>, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const params: Record<string, string> = {};

        if (opts.type) params.type = String(opts.type);
        if (opts.idPattern) params.idPattern = String(opts.idPattern);
        if (opts.query) params.q = String(opts.query);
        if (opts.attrs) params.attrs = String(opts.attrs);
        if (opts.georel) params.georel = String(opts.georel);
        if (opts.geometry) params.geometry = String(opts.geometry);
        if (opts.coords) params.coords = String(opts.coords);
        if (opts.spatialId) params.spatialId = String(opts.spatialId);
        if (opts.limit !== undefined) params.limit = String(opts.limit);
        if (opts.offset !== undefined) params.offset = String(opts.offset);
        if (opts.orderBy) params.orderBy = String(opts.orderBy);
        if (opts.count) params.options = "count";

        if (format === "keyValues") {
          params.options = params.options
            ? `${params.options},keyValues`
            : "keyValues";
        }

        const response = await client.get("/entities", params);
        outputResponse(response, format, !!opts.count);
      }),
    );

  // entities get
  entities
    .command("get")
    .description("Get a single entity by ID")
    .argument("<id>", "Entity ID")
    .action(
      withErrorHandler(async (id: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const params: Record<string, string> = {};
        if (format === "keyValues") {
          params.options = "keyValues";
        }

        const response = await client.get(
          `/entities/${encodeURIComponent(id)}`,
          params,
        );
        outputResponse(response, format);
      }),
    );

  // entities create
  entities
    .command("create")
    .description("Create a new entity")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(async (json: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const data = parseJsonInput(json);

        await client.post("/entities", data);
        printSuccess("Entity created.");
      }),
    );

  // entities update
  entities
    .command("update")
    .description("Update attributes of an entity (PATCH)")
    .argument("<id>", "Entity ID")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(
        async (id: string, json: string, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const data = parseJsonInput(json);

          await client.patch(
            `/entities/${encodeURIComponent(id)}/attrs`,
            data,
          );
          printSuccess("Entity updated.");
        },
      ),
    );

  // entities replace
  entities
    .command("replace")
    .description("Replace all attributes of an entity (PUT)")
    .argument("<id>", "Entity ID")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(
        async (id: string, json: string, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const data = parseJsonInput(json);

          await client.put(
            `/entities/${encodeURIComponent(id)}/attrs`,
            data,
          );
          printSuccess("Entity replaced.");
        },
      ),
    );

  // entities upsert
  entities
    .command("upsert")
    .description("Create or update entities")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(async (json: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const data = parseJsonInput(json);

        await client.post("/entityOperations/upsert", data);
        printSuccess("Entity upserted.");
      }),
    );

  // entities delete
  entities
    .command("delete")
    .description("Delete an entity by ID")
    .argument("<id>", "Entity ID")
    .action(
      withErrorHandler(async (id: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(`/entities/${encodeURIComponent(id)}`);
        printSuccess("Entity deleted.");
      }),
    );

  // Register attrs as a subcommand of entities
  registerAttrsSubcommand(entities);
}
