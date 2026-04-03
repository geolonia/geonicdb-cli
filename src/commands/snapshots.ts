import type { Command } from "commander";
import {
  withErrorHandler,
  createClient,
  getFormat,
  outputResponse,
} from "../helpers.js";
import { printSuccess } from "../output.js";
import { addExamples } from "./help.js";

export function registerSnapshotsCommand(program: Command): void {
  const snapshots = program
    .command("snapshots")
    .description("Manage point-in-time snapshots of entity data for backup and cloning");

  // snapshots list
  const list = snapshots
    .command("list")
    .description("List all available snapshots with their IDs, timestamps, and status")
    .option("--limit <n>", "Maximum number of snapshots to return", parseInt)
    .option("--offset <n>", "Skip first N snapshots", parseInt)
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};

        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);

        const response = await client.get("/snapshots", params);
        outputResponse(response, format);
      }),
    );

  addExamples(list, [
    {
      description: "List all snapshots",
      command: "geonic snapshots list",
    },
    {
      description: "List the 10 most recent snapshots",
      command: "geonic snapshots list --limit 10",
    },
    {
      description: "Paginate through snapshots",
      command: "geonic snapshots list --limit 5 --offset 10",
    },
    {
      description: "List snapshots in table format",
      command: "geonic snapshots list --format table",
    },
  ]);

  // snapshots get
  const get = snapshots
    .command("get <id>")
    .description("Retrieve details of a specific snapshot including its status and metadata")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get(
          `/snapshots/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get details of a snapshot by its ID",
      command: "geonic snapshots get abc123",
    },
    {
      description: "Get snapshot details in table format",
      command: "geonic snapshots get abc123 --format table",
    },
  ]);

  // snapshots create
  const create = snapshots
    .command("create")
    .description("Create a point-in-time snapshot of all current entity data")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.post("/snapshots");
        printSuccess("Snapshot created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create a snapshot of the current entity data",
      command: "geonic snapshots create",
    },
    {
      description: "Create a snapshot before performing a bulk update",
      command: "geonic snapshots create && geonic batch upsert @bulk-update.json",
    },
  ]);

  // snapshots delete
  const del = snapshots
    .command("delete <id>")
    .description("Permanently delete a snapshot to free storage")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(
          `/snapshots/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Snapshot deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a snapshot by its ID",
      command: "geonic snapshots delete abc123",
    },
    {
      description: "Delete an old snapshot to reclaim storage",
      command: "geonic snapshots delete old-backup-id",
    },
  ]);

  // snapshots clone
  const clone = snapshots
    .command("clone <id>")
    .description("Clone a snapshot to create a duplicate for testing or migration")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.post(
          `/snapshots/${encodeURIComponent(String(id))}/clone`,
        );
        if (response.data !== undefined && response.data !== "") {
          outputResponse(response, format);
        } else {
          printSuccess("Snapshot cloned.");
        }
      }),
    );

  addExamples(clone, [
    {
      description: "Clone a snapshot for use in a test environment",
      command: "geonic snapshots clone abc123",
    },
    {
      description: "Clone a production snapshot to a staging profile",
      command: "geonic snapshots clone abc123 --profile staging",
    },
  ]);
}
