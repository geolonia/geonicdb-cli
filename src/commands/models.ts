import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";

export function registerModelsCommand(program: Command): void {
  const models = program
    .command("models")
    .description("Custom data model management");

  // models list
  models
    .command("list")
    .description("List all models")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/models");
        outputResponse(response, format);
      }),
    );

  // models get
  models
    .command("get <id>")
    .description("Get a model by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/models/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  // models create
  models
    .command("create <json>")
    .description("Create a new model")
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = parseJsonInput(String(json));
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/models", { body });
        outputResponse(response, format);
        printSuccess("Model created.");
      }),
    );

  // models update
  models
    .command("update <id> <json>")
    .description("Update a model")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = parseJsonInput(String(json));
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/models/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("Model updated.");
        },
      ),
    );

  // models delete
  models
    .command("delete <id>")
    .description("Delete a model")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/models/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Model deleted.");
      }),
    );
}
