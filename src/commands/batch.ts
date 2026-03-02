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
    .description("Batch create entities")
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
      description: "Batch create from a file",
      command: "geonic batch create @entities.json",
    },
    {
      description: "Batch create from stdin",
      command: "cat entities.json | geonic batch create",
    },
  ]);

  // batch upsert
  const upsert = batch
    .command("upsert [json]")
    .description("Batch upsert entities")
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
      description: "Batch upsert from a file",
      command: "geonic batch upsert @entities.json",
    },
    {
      description: "Batch upsert from stdin",
      command: "cat entities.json | geonic batch upsert",
    },
  ]);

  // batch update
  const update = batch
    .command("update [json]")
    .description("Batch update entity attributes")
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
    .description("Batch delete entities by ID")
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
      description: "Batch delete from a file",
      command: "geonic batch delete @entity-ids.json",
    },
    {
      description: "Batch delete from stdin",
      command: "cat entity-ids.json | geonic batch delete",
    },
  ]);

  // batch query
  const query = batch
    .command("query [json]")
    .description("Query entities by posting a query payload")
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
      description: "Query entities from a file",
      command: "geonic batch query @query.json",
    },
    {
      description: "Query entities from stdin",
      command: "cat query.json | geonic batch query",
    },
  ]);

  // batch merge
  const merge = batch
    .command("merge [json]")
    .description("Batch merge-patch entities")
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
