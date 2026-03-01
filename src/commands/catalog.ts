import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { addExamples } from "./help.js";

export function registerCatalogCommand(program: Command): void {
  const catalog = program
    .command("catalog")
    .description("Browse DCAT-AP catalog");

  // catalog get
  const get = catalog
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

  addExamples(get, [
    {
      description: "Get the DCAT-AP catalog",
      command: "geonic catalog get",
    },
  ]);

  // catalog datasets
  const datasets = catalog
    .command("datasets")
    .description("Manage catalog datasets");

  // catalog datasets list
  const datasetsList = datasets
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

  addExamples(datasetsList, [
    {
      description: "List all catalog datasets",
      command: "geonic catalog datasets list",
    },
  ]);

  // catalog datasets get
  const datasetsGet = datasets
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

  addExamples(datasetsGet, [
    {
      description: "Get a specific dataset",
      command: "geonic catalog datasets get <dataset-id>",
    },
  ]);

  // catalog datasets sample
  const datasetsSample = datasets
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

  addExamples(datasetsSample, [
    {
      description: "Get sample data for a dataset",
      command: "geonic catalog datasets sample <dataset-id>",
    },
  ]);
}
