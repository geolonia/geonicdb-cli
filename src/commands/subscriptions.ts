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

export function registerSubscriptionsCommand(program: Command): void {
  const subscriptions = program
    .command("subscriptions")
    .alias("sub")
    .description("Manage context subscriptions");

  // subscriptions list
  const list = subscriptions
    .command("list")
    .description("List subscriptions")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .option("--count", "Include total count in response")
    .action(
      withErrorHandler(async (_opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const cmdOpts = cmd.opts();

        const params: Record<string, string> = {};
        if (cmdOpts.limit !== undefined) params["limit"] = String(cmdOpts.limit);
        if (cmdOpts.offset !== undefined) params["offset"] = String(cmdOpts.offset);
        if (cmdOpts.count) params["count"] = "true";

        const response = await client.get("/subscriptions", params);
        outputResponse(response, format, !!cmdOpts.count);
      }),
    );

  addExamples(list, [
    {
      description: "List all subscriptions",
      command: "geonic subscriptions list",
    },
    {
      description: "List with pagination",
      command: "geonic subscriptions list --limit 10 --offset 20",
    },
    {
      description: "List with total count",
      command: "geonic subscriptions list --count",
    },
  ]);

  // subscriptions get
  const get = subscriptions
    .command("get <id>")
    .description("Get a subscription by ID")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get(
          `/subscriptions/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get subscription by ID",
      command: "geonic subscriptions get urn:ngsi-ld:Subscription:001",
    },
  ]);

  // subscriptions create
  const create = subscriptions
    .command("create [json]")
    .description(
      "Create a subscription\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "type": "Subscription",\n' +
        '    "entities": [{"type": "Sensor"}],\n' +
        '    "watchedAttributes": ["temperature"],\n' +
        '    "notification": {"endpoint": {"uri": "http://localhost:3000/notify"}}\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/subscriptions", data);
        outputResponse(response, format);
        printSuccess("Subscription created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic subscriptions create '{"type":"Subscription","entities":[{"type":"Sensor"}],"watchedAttributes":["temperature"],"notification":{"endpoint":{"uri":"http://localhost:3000/notify"}}}'`,
    },
    {
      description: "Create from a JSON file",
      command: "geonic subscriptions create @subscription.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat subscription.json | geonic subscriptions create",
    },
    {
      description: "Interactive mode",
      command: "geonic subscriptions create",
    },
  ]);

  // subscriptions update
  const update = subscriptions
    .command("update <id> [json]")
    .description(
      "Update a subscription\n\n" +
        "JSON payload: only specified fields are updated.\n" +
        '  e.g. {"description": "Updated subscription"}',
    )
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const data = await parseJsonInput(json as string | undefined);

          const response = await client.patch(
            `/subscriptions/${encodeURIComponent(String(id))}`,
            data,
          );
          outputResponse(response, format);
          printSuccess("Subscription updated.");
        },
      ),
    );

  addExamples(update, [
    {
      description: "Update description",
      command: `geonic subscriptions update urn:ngsi-ld:Subscription:001 '{"description":"Updated subscription"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic subscriptions update urn:ngsi-ld:Subscription:001 @sub.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat sub.json | geonic subscriptions update urn:ngsi-ld:Subscription:001",
    },
  ]);

  // subscriptions delete
  const del = subscriptions
    .command("delete <id>")
    .description("Delete a subscription")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(
          `/subscriptions/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Subscription deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a subscription",
      command: "geonic subscriptions delete urn:ngsi-ld:Subscription:001",
    },
  ]);
}
