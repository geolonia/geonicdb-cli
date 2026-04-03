import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { addExamples } from "./help.js";

export function registerTypesCommand(program: Command): void {
  const types = program
    .command("types")
    .description("Discover what entity types exist in the broker and inspect their structure");

  // types list
  const list = types
    .command("list")
    .description("List all entity types currently stored in the broker")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get("/types");
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all entity types in the broker",
      command: "geonic types list",
    },
    {
      description: "List entity types in table format for a quick overview",
      command: "geonic types list --format table",
    },
  ]);

  // types get
  const get = types
    .command("get <typeName>")
    .description("Show attribute names and types for a given entity type")
    .action(
      withErrorHandler(
        async (typeName: unknown, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);

          const response = await client.get(
            `/types/${encodeURIComponent(String(typeName))}`,
          );
          outputResponse(response, format);
        },
      ),
    );

  addExamples(get, [
    {
      description: "Inspect the Sensor type to see its attributes",
      command: "geonic types get Sensor",
    },
    {
      description: "Inspect a Building type in table format",
      command: "geonic types get Building --format table",
    },
    {
      description: "Inspect a fully-qualified NGSI-LD type",
      command: "geonic types get https://uri.fiware.org/ns/data-models#AirQualityObserved",
    },
  ]);
}
