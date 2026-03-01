import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function addAttrsSubcommands(attrs: Command): void {
  // attrs list
  const list = attrs
    .command("list")
    .description("List all attributes of an entity")
    .argument("<entityId>", "Entity ID")
    .action(
      withErrorHandler(
        async (entityId: string, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);

          const response = await client.get(
            `/entities/${encodeURIComponent(entityId)}/attrs`,
          );
          outputResponse(response, format);
        },
      ),
    );

  addExamples(list, [
    {
      description: "List all attributes of an entity",
      command: "geonic entities attrs list urn:ngsi-ld:Sensor:001",
    },
  ]);

  // attrs get
  const get = attrs
    .command("get")
    .description("Get a specific attribute of an entity")
    .argument("<entityId>", "Entity ID")
    .argument("<attrName>", "Attribute name")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          attrName: string,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);

          const response = await client.get(
            `/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attrName)}`,
          );
          outputResponse(response, format);
        },
      ),
    );

  addExamples(get, [
    {
      description: "Get a specific attribute",
      command: "geonic entities attrs get urn:ngsi-ld:Sensor:001 temperature",
    },
  ]);

  // attrs add
  const add = attrs
    .command("add")
    .description("Add attributes to an entity")
    .argument("<entityId>", "Entity ID")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          json: string,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);
          const data = parseJsonInput(json);

          await client.post(
            `/entities/${encodeURIComponent(entityId)}/attrs`,
            data,
          );
          printSuccess("Attributes added.");
        },
      ),
    );

  addExamples(add, [
    {
      description: "Add attributes from a file",
      command: "geonic entities attrs add urn:ngsi-ld:Sensor:001 @attrs.json",
    },
  ]);

  // attrs update
  const attrUpdate = attrs
    .command("update")
    .description("Update a specific attribute of an entity")
    .argument("<entityId>", "Entity ID")
    .argument("<attrName>", "Attribute name")
    .argument("<json>", "JSON payload (inline, @file, or - for stdin)")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          attrName: string,
          json: string,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);
          const data = parseJsonInput(json);

          await client.put(
            `/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attrName)}`,
            data,
          );
          printSuccess("Attribute updated.");
        },
      ),
    );

  addExamples(attrUpdate, [
    {
      description: "Update a specific attribute",
      command:
        "geonic entities attrs update urn:ngsi-ld:Sensor:001 temperature '{\"value\":25}'",
    },
  ]);

  // attrs delete
  const del = attrs
    .command("delete")
    .description("Delete a specific attribute from an entity")
    .argument("<entityId>", "Entity ID")
    .argument("<attrName>", "Attribute name")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          attrName: string,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);

          await client.delete(
            `/entities/${encodeURIComponent(entityId)}/attrs/${encodeURIComponent(attrName)}`,
          );
          printSuccess("Attribute deleted.");
        },
      ),
    );

  addExamples(del, [
    {
      description: "Delete a specific attribute",
      command:
        "geonic entities attrs delete urn:ngsi-ld:Sensor:001 temperature",
    },
  ]);
}

export function registerAttrsSubcommand(entitiesCmd: Command): void {
  const attrs = entitiesCmd
    .command("attrs")
    .description("Manage entity attributes");

  addAttrsSubcommands(attrs);
}
