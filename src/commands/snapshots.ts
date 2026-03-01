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
    .description("Manage snapshots");

  // snapshots list
  const list = snapshots
    .command("list")
    .description("List snapshots")
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
      description: "List with a limit",
      command: "geonic snapshots list --limit 10",
    },
  ]);

  // snapshots get
  const get = snapshots
    .command("get <id>")
    .description("Get a snapshot by ID")
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
      description: "Get a specific snapshot",
      command: "geonic snapshots get <snapshot-id>",
    },
  ]);

  // snapshots create
  const create = snapshots
    .command("create")
    .description("Create a new snapshot")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.post("/snapshots");
        printSuccess("Snapshot created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create a new snapshot",
      command: "geonic snapshots create",
    },
  ]);

  // snapshots delete
  const del = snapshots
    .command("delete <id>")
    .description("Delete a snapshot by ID")
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
      description: "Delete a snapshot",
      command: "geonic snapshots delete <snapshot-id>",
    },
  ]);

  // snapshots clone
  const clone = snapshots
    .command("clone <id>")
    .description("Clone a snapshot by ID")
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
      description: "Clone a snapshot",
      command: "geonic snapshots clone <snapshot-id>",
    },
  ]);
}
