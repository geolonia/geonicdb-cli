import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";

export function registerBatchCommand(program: Command): void {
  const batch = program
    .command("entityOperations")
    .alias("batch")
    .description("Perform batch operations on entities");

  // batch create
  batch
    .command("create <json>")
    .description("Batch create entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/create", data);
        outputResponse(response, format);
      }),
    );

  // batch upsert
  batch
    .command("upsert <json>")
    .description("Batch upsert entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/upsert", data);
        outputResponse(response, format);
      }),
    );

  // batch update
  batch
    .command("update <json>")
    .description("Batch update entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/update", data);
        outputResponse(response, format);
      }),
    );

  // batch delete
  batch
    .command("delete <json>")
    .description("Batch delete entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/delete", data);
        outputResponse(response, format);
      }),
    );

  // batch query
  batch
    .command("query <json>")
    .description("Batch query entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/query", data);
        outputResponse(response, format);
      }),
    );

  // batch merge
  batch
    .command("merge <json>")
    .description("Batch merge entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/merge", data);
        outputResponse(response, format);
      }),
    );
}
