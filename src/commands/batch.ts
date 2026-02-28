import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
  resolveOptions,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printError } from "../output.js";

export function registerBatchCommand(program: Command): void {
  const batch = program
    .command("entityOperations")
    .alias("batch")
    .description("Batch operations on entities");

  // batch create
  batch
    .command("create <json>")
    .description("Batch create entities")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const opts = resolveOptions(cmd);
        const data = parseJsonInput(String(json));

        let response;
        if (opts.api === "ld") {
          response = await client.post("/entityOperations/create", data);
        } else {
          const entities = Array.isArray(data) ? data : [data];
          response = await client.post("/op/update", {
            actionType: "append",
            entities,
          });
        }

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
        const opts = resolveOptions(cmd);
        const data = parseJsonInput(String(json));

        let response;
        if (opts.api === "ld") {
          response = await client.post("/entityOperations/upsert", data);
        } else {
          const entities = Array.isArray(data) ? data : [data];
          response = await client.post("/op/update", {
            actionType: "append",
            entities,
          });
        }

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
        const opts = resolveOptions(cmd);
        const data = parseJsonInput(String(json));

        let response;
        if (opts.api === "ld") {
          response = await client.post("/entityOperations/update", data);
        } else {
          const entities = Array.isArray(data) ? data : [data];
          response = await client.post("/op/update", {
            actionType: "update",
            entities,
          });
        }

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
        const opts = resolveOptions(cmd);
        const data = parseJsonInput(String(json));

        let response;
        if (opts.api === "ld") {
          response = await client.post("/entityOperations/delete", data);
        } else {
          const entities = Array.isArray(data) ? data : [data];
          response = await client.post("/op/update", {
            actionType: "delete",
            entities,
          });
        }

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
        const opts = resolveOptions(cmd);
        const data = parseJsonInput(String(json));

        let response;
        if (opts.api === "ld") {
          response = await client.post("/entityOperations/query", data);
        } else {
          response = await client.post("/op/query", data);
        }

        outputResponse(response, format);
      }),
    );

  // batch merge (NGSI-LD only)
  batch
    .command("merge <json>")
    .description("Batch merge entities (NGSI-LD only)")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const opts = resolveOptions(cmd);

        if (opts.api !== "ld") {
          printError("Batch merge is only supported for NGSI-LD (--api ld).");
          process.exit(1);
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = parseJsonInput(String(json));

        const response = await client.post("/entityOperations/merge", data);
        outputResponse(response, format);
      }),
    );
}
