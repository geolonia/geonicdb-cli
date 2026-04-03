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
    .description("List all attributes of an entity, returning each attribute's type, value, and metadata")
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
    {
      description: "List attributes in table format",
      command: "geonic entities attrs list urn:ngsi-ld:Sensor:001 --format table",
    },
    {
      description: "List attributes with keyValues output",
      command:
        "geonic entities attrs list urn:ngsi-ld:Building:store01 --format json",
    },
  ]);

  // attrs get
  const get = attrs
    .command("get")
    .description("Get the value and metadata of a single attribute on an entity")
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
      description: "Get the temperature attribute of a sensor",
      command: "geonic entities attrs get urn:ngsi-ld:Sensor:001 temperature",
    },
    {
      description: "Get a Relationship attribute to see what it links to",
      command: "geonic entities attrs get urn:ngsi-ld:Building:store01 owner",
    },
    {
      description: "Get an attribute in table format",
      command:
        "geonic entities attrs get urn:ngsi-ld:Sensor:001 location --format table",
    },
  ]);

  // attrs add
  const add = attrs
    .command("add")
    .description(
      "Add attributes to an entity\n\n" +
        "JSON payload example:\n" +
        '  {"humidity": {"type": "Property", "value": 60}}',
    )
    .argument("<entityId>", "Entity ID")
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          json: string | undefined,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);
          const data = await parseJsonInput(json);

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
      description: "Add an attribute with inline JSON",
      command: `geonic entities attrs add urn:ngsi-ld:Sensor:001 '{"humidity":{"type":"Property","value":60}}'`,
    },
    {
      description: "Add attributes from a file",
      command: "geonic entities attrs add urn:ngsi-ld:Sensor:001 @attrs.json",
    },
    {
      description: "Add from stdin pipe",
      command: "cat attrs.json | geonic entities attrs add urn:ngsi-ld:Sensor:001",
    },
  ]);

  // attrs update
  const attrUpdate = attrs
    .command("update")
    .description(
      "Update a specific attribute of an entity\n\n" +
        "JSON payload example:\n" +
        '  {"type": "Property", "value": 25}',
    )
    .argument("<entityId>", "Entity ID")
    .argument("<attrName>", "Attribute name")
    .argument("[json]", "JSON payload (inline, @file, - for stdin, or omit for interactive/pipe)")
    .action(
      withErrorHandler(
        async (
          entityId: string,
          attrName: string,
          json: string | undefined,
          _opts: unknown,
          cmd: Command,
        ) => {
          const client = createClient(cmd);
          const data = await parseJsonInput(json);

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
      description: "Update a Property value",
      command: `geonic entities attrs update urn:ngsi-ld:Sensor:001 temperature '{"type":"Property","value":25}'`,
    },
    {
      description: "Update from a file",
      command: "geonic entities attrs update urn:ngsi-ld:Sensor:001 temperature @attr.json",
    },
  ]);

  // attrs delete
  const del = attrs
    .command("delete")
    .description("Remove an attribute from an entity permanently")
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
      description: "Remove the temperature attribute from a sensor",
      command:
        "geonic entities attrs delete urn:ngsi-ld:Sensor:001 temperature",
    },
    {
      description: "Remove a deprecated attribute from a building entity",
      command:
        "geonic entities attrs delete urn:ngsi-ld:Building:store01 legacyCode",
    },
  ]);
}

export function registerAttrsSubcommand(entitiesCmd: Command): void {
  const attrs = entitiesCmd
    .command("attrs")
    .description("Manage entity attributes");

  addAttrsSubcommands(attrs);
}
