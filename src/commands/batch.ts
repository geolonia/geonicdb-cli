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

  addExamples(create, [
    {
      description: "Batch create from a file",
      command: "geonic batch create @entities.json",
    },
    {
      description: "Batch create from stdin",
      command: "cat entities.json | geonic batch create -",
    },
  ]);

  // batch upsert
  const upsert = batch
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

  addExamples(upsert, [
    {
      description: "Batch upsert from a file",
      command: "geonic batch upsert @entities.json",
    },
    {
      description: "Batch upsert from stdin",
      command: "cat entities.json | geonic batch upsert -",
    },
  ]);

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
