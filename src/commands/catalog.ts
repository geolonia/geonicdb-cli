import type { Command } from "commander";
import { withErrorHandler, createClient, getFormat, outputResponse } from "../helpers.js";
import { addExamples } from "./help.js";

export function registerCatalogCommand(program: Command): void {
  const catalog = program
    .command("catalog")
    .description("Browse the DCAT-AP data catalog for discovering and previewing datasets");

  // catalog get
  const get = catalog
    .command("get")
    .description("Get the DCAT-AP catalog metadata including title, publisher, and dataset count")
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
      description: "View catalog metadata (title, publisher, datasets summary)",
      command: "geonic catalog get",
    },
    {
      description: "Get catalog metadata in table format",
      command: "geonic catalog get --format table",
    },
  ]);

  // catalog datasets
  const datasets = catalog
    .command("datasets")
    .description("List, inspect, and preview datasets published in the catalog");

  // catalog datasets list
  const datasetsList = datasets
    .command("list")
    .description("List all datasets published in the catalog")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};
        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);

        const response = await client.rawRequest("GET", "/catalog/datasets", { params });
        outputResponse(response, format);
      }),
    );

  addExamples(datasetsList, [
    {
      description: "List all catalog datasets as JSON",
      command: "geonic catalog datasets list",
    },
    {
      description: "Browse datasets in table format",
      command: "geonic catalog datasets list --format table",
    },
    {
      description: "List with pagination",
      command: "geonic catalog datasets list --limit 50 --offset 100",
    },
  ]);

  // catalog datasets get
  const datasetsGet = datasets
    .command("get <id>")
    .description("Get a dataset's metadata including description, distributions, and license")
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
      description: "Inspect a dataset's metadata and distributions",
      command: "geonic catalog datasets get <dataset-id>",
    },
    {
      description: "View dataset details including license and publisher",
      command: "geonic catalog datasets get urn:ngsi-ld:Dataset:weather-stations",
    },
  ]);

  // catalog datasets sample
  const datasetsSample = datasets
    .command("sample <id>")
    .description("Preview sample entities from a dataset to understand its structure and content")
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
      description: "Preview sample entities from a dataset",
      command: "geonic catalog datasets sample <dataset-id>",
    },
    {
      description: "Preview data in table format to quickly assess content",
      command: "geonic catalog datasets sample <dataset-id> --format table",
    },
  ]);
}
