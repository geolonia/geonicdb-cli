import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { addExamples } from "./help.js";

export function registerBatchCommand(program: Command): void {
  const batch = program
    .command("entityOperations")
    .alias("batch")
    .description("Perform batch operations on entities");

  // batch create
  const create = batch
    .command("create [json]")
    .description(
      "Batch create entities\n\n" +
        "JSON payload: an array of NGSI-LD entities.\n" +
        '  e.g. [{"id": "urn:ngsi-ld:Sensor:001", "type": "Sensor"}, ...]',
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/create", data);
        outputResponse(response, format);
      }),
    );

  addExamples(create, [
    {
      description: "Batch create with inline JSON",
      command: `geonic batch create '[{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"},{"id":"urn:ngsi-ld:Sensor:002","type":"Sensor"}]'`,
    },
    {
      description: "Batch create from a file",
      command: "geonic batch create @entities.json",
    },
    {
      description: "Batch create from stdin pipe",
      command: "cat entities.json | geonic batch create",
    },
  ]);

  // batch upsert
  const upsert = batch
    .command("upsert [json]")
    .description(
      "Batch upsert entities\n\n" +
        "JSON payload: an array of NGSI-LD entities.\n" +
        "Creates entities that don't exist, updates those that do.",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/upsert", data);
        outputResponse(response, format);
      }),
    );

  addExamples(upsert, [
    {
      description: "Batch upsert with inline JSON",
      command: `geonic batch upsert '[{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor","temperature":{"type":"Property","value":25}}]'`,
    },
    {
      description: "Batch upsert from a file",
      command: "geonic batch upsert @entities.json",
    },
    {
      description: "Batch upsert from stdin pipe",
      command: "cat entities.json | geonic batch upsert",
    },
  ]);

  // batch update
  const update = batch
    .command("update [json]")
    .description(
      "Batch update entity attributes\n\n" +
        "JSON payload: an array of NGSI-LD entities with attributes to update.\n" +
        "Each entity must include id and type; only specified attributes are modified.",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/update", data);
        outputResponse(response, format);
      }),
    );

  addExamples(update, [
    {
      description: "Batch update from a file",
      command: "geonic batch update @updates.json",
    },
    {
      description: "Batch update from stdin",
      command: "cat updates.json | geonic batch update",
    },
  ]);

  // batch delete
  const del = batch
    .command("delete [json]")
    .description(
      "Batch delete entities by ID\n\n" +
        'JSON payload: an array of entity ID strings.\n' +
        '  e.g. ["urn:ngsi-ld:Sensor:001","urn:ngsi-ld:Sensor:002"]',
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/delete", data);
        outputResponse(response, format);
      }),
    );

  addExamples(del, [
    {
      description: "Batch delete with inline JSON",
      command: `geonic batch delete '["urn:ngsi-ld:Sensor:001","urn:ngsi-ld:Sensor:002"]'`,
    },
    {
      description: "Batch delete from a file",
      command: "geonic batch delete @entity-ids.json",
    },
    {
      description: "Batch delete from stdin pipe",
      command: "cat entity-ids.json | geonic batch delete",
    },
  ]);

  // batch query
  const query = batch
    .command("query [json]")
    .description(
      "Query entities by posting a query payload\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "entities": [{"type": "Sensor"}],\n' +
        '    "attrs": ["temperature"],\n' +
        '    "q": "temperature>30"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/query", data);
        outputResponse(response, format);
      }),
    );

  addExamples(query, [
    {
      description: "Query with inline JSON",
      command: `geonic batch query '{"entities":[{"type":"Sensor"}],"attrs":["temperature"]}'`,
    },
    {
      description: "Query from a file",
      command: "geonic batch query @query.json",
    },
    {
      description: "Query from stdin pipe",
      command: "cat query.json | geonic batch query",
    },
  ]);

  // batch merge
  const merge = batch
    .command("merge [json]")
    .description(
      "Batch merge-patch entities\n\n" +
        "JSON payload: an array of NGSI-LD entities.\n" +
        "Each entity must include id and type; attributes are merge-patched.",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/entityOperations/merge", data);
        outputResponse(response, format);
      }),
    );

  addExamples(merge, [
    {
      description: "Batch merge-patch from a file",
      command: "geonic batch merge @patches.json",
    },
    {
      description: "Batch merge-patch from stdin",
      command: "cat patches.json | geonic batch merge",
    },
  ]);
}
