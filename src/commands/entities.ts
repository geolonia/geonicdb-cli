import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printCount, printSuccess } from "../output.js";
import { isInteractive, promptConfirm } from "../prompt.js";
import { registerAttrsSubcommand } from "./attrs.js";
import { addExamples } from "./help.js";

export function registerEntitiesCommand(program: Command): void {
  const entities = program
    .command("entities")
    .description("Manage context entities");

  // entities list
  const list = entities
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
    .option("--scope-q <expr>", "Filter by scope (e.g. /restaurants/#, /Japan/Tokyo, /Japan/+)")
    .option("--count-only", "Only show the total count without listing entities")
    .option("--key-values", "Request simplified key-value format")
    .option("--sys-attrs", "Include system attributes (createdAt, modifiedAt)")
    .option(
      "--local",
      "Limit to local scope (?local=true). Exempts the too-wide query check",
    )
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
        if (opts.coords) params.coordinates = String(opts.coords);
        if (opts.spatialId) params.spatialId = String(opts.spatialId);
        if (opts.limit !== undefined) params.limit = String(opts.limit);
        if (opts.offset !== undefined) params.offset = String(opts.offset);
        if (opts.orderBy) params.orderBy = String(opts.orderBy);
        if (opts.scopeQ) params.scopeQ = String(opts.scopeQ);
        if (opts.local) params.local = "true";
        if (opts.count || opts.countOnly) params.count = "true";
        if (opts.countOnly) params.limit = "0";

        const optionsList: string[] = [];
        if (opts.keyValues) optionsList.push("keyValues");
        if (opts.sysAttrs) optionsList.push("sysAttrs");
        if (optionsList.length > 0) params.options = optionsList.join(",");

        const response = await client.get("/entities", params);
        if (opts.countOnly) {
          printCount(response.count ?? 0);
        } else {
          outputResponse(response, format, !!opts.count);
        }
      }),
    );

  addExamples(list, [
    {
      description: "Filter by entity type",
      command: "geonic entities list --type Sensor",
    },
    {
      description: "Filter by entity ID pattern (regex)",
      command: "geonic entities list --id-pattern 'urn:ngsi-ld:Sensor:.*'",
    },
    {
      description: "Filter by attribute value",
      command: "geonic entities list --query 'temperature>30'",
    },
    {
      description: "AND conditions (semicolon)",
      command: "geonic entities list --query 'temperature>30;humidity<50'",
    },
    {
      description: "String match",
      command: "geonic entities list --query 'name==\"Tokyo\"'",
    },
    {
      description: "Pattern match",
      command: "geonic entities list --query 'name~=\"Tok.*\"'",
    },
    {
      description: "Check attribute existence",
      command: "geonic entities list --query 'temperature'",
    },
    {
      description: "Select specific attributes",
      command: "geonic entities list --attrs temperature,humidity",
    },
    {
      description: "Geo-query: entities near a point (within 1km)",
      command:
        "geonic entities list --georel 'near;maxDistance==1000' --geometry Point --coords '[139.7671,35.6812]'",
    },
    {
      description: "Geo-query: entities within a polygon",
      command:
        "geonic entities list --georel within --geometry Polygon --coords '[[[139.7,35.7],[139.8,35.7],[139.8,35.6],[139.7,35.6],[139.7,35.7]]]'",
    },
    {
      description: "Filter by Spatial ID (ZFXY tile)",
      command: "geonic entities list --spatial-id 15/0/29101/12903",
    },
    {
      description: "Paginate results",
      command: "geonic entities list --limit 20 --offset 40",
    },
    {
      description: "Order by attribute",
      command: "geonic entities list --order-by temperature",
    },
    {
      description: "Get total count with results",
      command: "geonic entities list --type Sensor --count",
    },
    {
      description: "Get only the total count (no entity data)",
      command: "geonic entities list --type Sensor --count-only",
    },
    {
      description: "Include system attributes (createdAt, modifiedAt)",
      command: "geonic entities list --type Sensor --sys-attrs",
    },
    {
      description: "Filter by scope (all descendants)",
      command: "geonic entities list --scope-q '/restaurants/#'",
    },
    {
      description: "Filter by scope (exact match)",
      command: "geonic entities list --scope-q '/Japan/Tokyo'",
    },
    {
      description: "Filter by scope (one level below)",
      command: "geonic entities list --scope-q '/Japan/+'",
    },
    {
      description: "List all local entities (exempts too-wide query check)",
      command: "geonic entities list --local",
    },
  ]);

  // entities purge
  const purge = entities
    .command("purge")
    .description(
      "Purge entities or attributes by selector (destructive).\n\n" +
        "Note: --attrs here selects target entities that have any of the listed attributes.\n" +
        "This differs from `entities list --attrs`, which only selects returned fields.",
    )
    .option("--type <type>", "Filter target entities by type")
    .option("--id <a,b>", "Comma-separated list of entity IDs to target")
    .option("--id-pattern <pat>", "Filter by entity ID pattern (regex)")
    .option("--query <q>", "NGSI query expression (q)")
    .option("--attrs <a,b>", "Selector: target entities that have any listed attributes")
    .option("--georel <rel>", "Geo-relationship selector")
    .option("--geometry <geo>", "Geometry type for geo-selector (e.g. Point)")
    .option("--coords <coords>", "Coordinates for geo-selector")
    .option("--scope-q <expr>", "Filter by scope (scopeQ)")
    .option("--local", "Restrict to local entities")
    .option("--keep <a,b>", "Keep only these attributes on matched entities")
    .option("--drop <a,b>", "Drop these attributes from matched entities")
    .option("-y, --yes", "Skip confirmation prompt")
    .action(
      withErrorHandler(async (opts: Record<string, unknown>, cmd: Command) => {
        const client = createClient(cmd);
        const params: Record<string, string> = {};

        if (opts.type) params.type = String(opts.type);
        if (opts.id) params.id = String(opts.id);
        if (opts.idPattern) params.idPattern = String(opts.idPattern);
        if (opts.query) params.q = String(opts.query);
        if (opts.attrs) params.attrs = String(opts.attrs);
        if (opts.georel) params.georel = String(opts.georel);
        if (opts.geometry) params.geometry = String(opts.geometry);
        if (opts.coords) params.coordinates = String(opts.coords);
        if (opts.scopeQ) params.scopeQ = String(opts.scopeQ);
        if (opts.local) params.local = "true";
        if (opts.keep) params.keep = String(opts.keep);
        if (opts.drop) params.drop = String(opts.drop);

        if (opts.keep && opts.drop) {
          throw new Error("Cannot specify both --keep and --drop.");
        }

        // Defense-in-depth: refuse an under-specified purge on the client before
        // any confirmation or server call. Mirror the server's sufficient-selector
        // set after geonicdb#2432 / ETSI 5.6.21.4:
        //   sufficient: --type / --attrs / --query / --georel / --keep / --drop / --local
        //   refinements (not sufficient alone): --id / --id-pattern / --scope-q
        // keep/drop count as attribute-name selectors (non-system attrs required server-side).
        // local=true is the local-scope exemption. A single-entity delete remains
        // `entities delete <id>`. See README "entities purge".
        if (
          !opts.type &&
          !opts.attrs &&
          !opts.query &&
          !opts.georel &&
          !opts.keep &&
          !opts.drop &&
          !opts.local
        ) {
          throw new Error(
            "Refusing to purge: specify at least one selector (--type, --attrs, --query, --georel, --keep, --drop, or --local).",
          );
        }

        if (!opts.yes) {
          if (!isInteractive()) {
            throw new Error("Refusing to purge without confirmation. Re-run with --yes.");
          }
          const confirmed = await promptConfirm(
            "This operation can permanently delete entities or attributes. Continue?",
          );
          if (!confirmed) return;
        }

        await client.delete("/entities", params);
        printSuccess("Purge completed.");
      }),
    );

  addExamples(purge, [
    {
      description: "Purge all matching entities by type (requires explicit confirmation bypass)",
      command: "geonic entities purge --type Sensor --yes",
    },
    {
      description: "Drop selected attributes from matching entities",
      command: "geonic entities purge --type Sensor --drop temperature,humidity --yes",
    },
    {
      description: "Keep only selected attributes on matching entities",
      command: "geonic entities purge --type Sensor --keep location,status --yes",
    },
  ]);

  // entities get
  const get = entities
    .command("get")
    .description("Get a single entity by ID")
    .argument("<id>", "Entity ID")
    .option("--key-values", "Request simplified key-value format")
    .option("--sys-attrs", "Include system attributes (createdAt, modifiedAt)")
    .action(
      withErrorHandler(async (id: string, opts: Record<string, unknown>, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const params: Record<string, string> = {};
        const optionsList: string[] = [];
        if (opts.keyValues) optionsList.push("keyValues");
        if (opts.sysAttrs) optionsList.push("sysAttrs");
        if (optionsList.length > 0) params.options = optionsList.join(",");

        const response = await client.get(
          `/entities/${encodeURIComponent(id)}`,
          params,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get entity by ID",
      command: "geonic entities get urn:ngsi-ld:Sensor:001",
    },
    {
      description: "Get entity in keyValues format",
      command: "geonic entities get urn:ngsi-ld:Sensor:001 --key-values",
    },
    {
      description: "Get entity with system attributes",
      command: "geonic entities get urn:ngsi-ld:Sensor:001 --sys-attrs",
    },
  ]);

  // entities create
  const create = entities
    .command("create")
    .summary("Create a new entity")
    .description(
      "Create a new entity\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "id": "urn:ngsi-ld:Sensor:001",\n' +
        '    "type": "Sensor",\n' +
        '    "scope": ["/Japan/Tokyo"],\n' +
        '    "temperature": {"type": "Property", "value": 25}\n' +
        "  }",
    )
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(async (json: string | undefined, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const data = await parseJsonInput(json);

        await client.post("/entities", data);
        printSuccess("Entity created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create from inline JSON (minimal)",
      command: `geonic entities create '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"}'`,
    },
    {
      description: "Create with attributes",
      command: `geonic entities create '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor","temperature":{"type":"Property","value":25},"location":{"type":"GeoProperty","value":{"type":"Point","coordinates":[139.77,35.68]}}}'`,
    },
    {
      description: "Create from a file",
      command: "geonic entities create @entity.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat entity.json | geonic entities create",
    },
    {
      description: "Create with scope (hierarchical membership)",
      command: `geonic entities create '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor","scope":["/Japan/Tokyo"],"temperature":{"type":"Property","value":25}}'`,
    },
    {
      description: "Interactive mode (omit JSON argument)",
      command: "geonic entities create",
    },
  ]);

  // entities update
  const update = entities
    .command("update")
    .summary("Update attributes of an entity (PATCH)")
    .description(
      "Update attributes of an entity (PATCH)\n\n" +
        "JSON payload: only specified attributes are modified.\n" +
        '  e.g. {"temperature": {"type": "Property", "value": 30}}',
    )
    .argument("<id>", "Entity ID")
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(
        async (id: string, json: string | undefined, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const data = await parseJsonInput(json);

          await client.patch(
            `/entities/${encodeURIComponent(id)}/attrs`,
            data,
          );
          printSuccess("Entity updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update a Property attribute",
      command:
        `geonic entities update urn:ngsi-ld:Sensor:001 '{"temperature":{"type":"Property","value":30}}'`,
    },
    {
      description: "Update from a file",
      command: "geonic entities update urn:ngsi-ld:Sensor:001 @attrs.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat attrs.json | geonic entities update urn:ngsi-ld:Sensor:001",
    },
  ]);

  // entities replace
  const replace = entities
    .command("replace")
    .summary("Replace all attributes of an entity (PUT)")
    .description(
      "Replace all attributes of an entity (PUT)\n\n" +
        "JSON payload: a full NGSI-LD Entity Representation (id, type, attributes).\n" +
        "  e.g. {\"id\":\"urn:ngsi-ld:Sensor:001\",\"type\":\"Sensor\"," +
        '"temperature":{"type":"Property","value":20}}\n\n' +
        "Per NGSI-LD spec 5.6.4 (Replace Entity), the body should be a complete\n" +
        "Entity Representation. Server may accept attribute-only bodies but a full\n" +
        "representation is recommended for spec compliance.",
    )
    .argument("<id>", "Entity ID")
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(
        async (id: string, json: string | undefined, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const data = await parseJsonInput(json);

          await client.put(
            `/entities/${encodeURIComponent(id)}`,
            data,
          );
          printSuccess("Entity replaced.");
        },
      ),
    );

  addExamples(replace, [
    {
      description: "Replace with full Entity Representation (recommended, spec 5.6.4)",
      command: `geonic entities replace urn:ngsi-ld:Sensor:001 '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor","temperature":{"type":"Property","value":20}}'`,
    },
    {
      description: "Replace from a file",
      command: "geonic entities replace urn:ngsi-ld:Sensor:001 @entity.json",
    },
    {
      description: "Replace from stdin pipe",
      command: "cat entity.json | geonic entities replace urn:ngsi-ld:Sensor:001",
    },
  ]);

  // entities upsert
  const upsert = entities
    .command("upsert")
    .description("Create or update entities")
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(async (json: string | undefined, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const data = await parseJsonInput(json);

        await client.post("/entityOperations/upsert", data);
        printSuccess("Entity upserted.");
      }),
    );

  addExamples(upsert, [
    {
      description: "Upsert entities from a file",
      command: "geonic entities upsert @entities.json",
    },
    {
      description: "Upsert from stdin pipe",
      command: "cat entities.json | geonic entities upsert",
    },
  ]);

  // entities delete
  const del = entities
    .command("delete")
    .description("Permanently delete an entity and all its attributes")
    .argument("<id>", "Entity ID")
    .action(
      withErrorHandler(async (id: string, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(`/entities/${encodeURIComponent(id)}`);
        printSuccess("Entity deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete an entity by ID",
      command: "geonic entities delete urn:ngsi-ld:Sensor:001",
    },
    {
      description: "Delete with explicit service tenant",
      command: "geonic entities delete urn:ngsi-ld:Sensor:001 --service my-tenant",
    },
  ]);

  // Register attrs as a subcommand of entities
  registerAttrsSubcommand(entities);
}
