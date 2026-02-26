import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";

export function registerTypesCommand(program: Command): void {
  const types = program
    .command("types")
    .description("Browse entity types");

  // types list
  types
    .command("list")
    .description("List available entity types")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get("/types");
        outputResponse(response, format);
      }),
    );

  // types get
  types
    .command("get <typeName>")
    .description("Get details for an entity type")
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
}
