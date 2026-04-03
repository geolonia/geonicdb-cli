import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function registerModelsCommand(program: Command): void {
  const models = program
    .command("custom-data-models")
    .alias("models")
    .description("Manage custom data models that define entity type schemas and property constraints");

  // models list
  const list = models
    .command("list")
    .description("List all registered data models for the current tenant")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/custom-data-models");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all data models as JSON",
      command: "geonic models list",
    },
    {
      description: "Browse available data models in table format",
      command: "geonic models list --format table",
    },
  ]);

  // models get
  const get = models
    .command("get <id>")
    .description("Get a data model's full schema including property definitions and constraints")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/custom-data-models/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Inspect a model's property definitions",
      command: "geonic models get <model-id>",
    },
    {
      description: "View the schema for a Sensor data model",
      command: "geonic models get urn:ngsi-ld:DataModel:Sensor",
    },
  ]);

  // models create
  const create = models
    .command("create [json]")
    .description(
      "Create a new model\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "type": "Sensor",\n' +
        '    "domain": "iot",\n' +
        '    "description": "IoT Sensor",\n' +
        '    "propertyDetails": {\n' +
        '      "temperature": {"ngsiType": "Property", "valueType": "Number", "example": 25}\n' +
        "    }\n" +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const body = await parseJsonInput(json as string | undefined);
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("POST", "/custom-data-models", { body });
        outputResponse(response, format);
        printSuccess("Model created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic models create '{"type":"Sensor","domain":"iot","description":"IoT Sensor","propertyDetails":{"temperature":{"ngsiType":"Property","valueType":"Number","example":25}}}'`,
    },
    {
      description: "Create from a file",
      command: "geonic models create @model.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat model.json | geonic models create",
    },
  ]);

  // models update
  const update = models
    .command("update <id> [json]")
    .description(
      "Update a model\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"description": "Updated model"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const body = await parseJsonInput(json as string | undefined);
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const response = await client.rawRequest(
            "PATCH",
            `/custom-data-models/${encodeURIComponent(String(id))}`,
            { body },
          );
          outputResponse(response, format);
          printSuccess("Model updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic models update <model-id> '{"description":"Updated description"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic models update <model-id> @model.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat model.json | geonic models update <model-id>",
    },
  ]);

  // models delete
  const del = models
    .command("delete <id>")
    .description("Delete a data model definition (does not affect existing entities)")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        await client.rawRequest(
          "DELETE",
          `/custom-data-models/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Model deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a data model by ID",
      command: "geonic models delete <model-id>",
    },
    {
      description: "Remove a deprecated model definition",
      command: "geonic models delete urn:ngsi-ld:DataModel:LegacySensor",
    },
  ]);
}
