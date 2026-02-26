import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";

export function registerCatalogCommand(program: Command): void {
  const catalog = program
    .command("catalog")
    .description("DCAT-AP catalog");

  // catalog get
  catalog
    .command("get")
    .description("Get the catalog")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/catalog");
        outputResponse(response, format);
      }),
    );

  // catalog datasets
  const datasets = catalog
    .command("datasets")
    .description("Manage catalog datasets");

  // catalog datasets list
  datasets
    .command("list")
    .description("List all datasets")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest("GET", "/catalog/datasets");
        outputResponse(response, format);
      }),
    );

  // catalog datasets get
  datasets
    .command("get <id>")
    .description("Get a dataset by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/catalog/datasets/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  // catalog datasets sample
  datasets
    .command("sample <id>")
    .description("Get sample data for a dataset")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const response = await client.rawRequest(
          "GET",
          `/catalog/datasets/${encodeURIComponent(String(id))}/sample`,
        );
        outputResponse(response, format);
      }),
    );
}
