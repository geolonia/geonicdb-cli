import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { parseJsonInput } from "../input.js";
import { printSuccess } from "../output.js";

export function addAttrsSubcommands(attrs: Command): void {
  // attrs list
  attrs
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

  // attrs get
  attrs
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

  // attrs add
  attrs
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

  // attrs update
  attrs
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

  // attrs delete
  attrs
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
}

export function registerAttrsSubcommand(entitiesCmd: Command): void {
  const attrs = entitiesCmd
    .command("attrs")
    .description("Manage entity attributes");

  addAttrsSubcommands(attrs);
}
