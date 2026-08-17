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

export function registerRegistrationsCommand(program: Command): void {
  const registrations = program
    .command("registrations")
    .alias("reg")
    .description("Manage context registrations");

  // registrations list
  // GET /csourceRegistrations requires a selector (ETSI GS CIM 009 clause 5.10.2.4 /
  // geonicdb#2304). Without type|attrs|q|geoquery the broker returns 400 Too wide query.
  const list = registrations
    .command("list")
    .description(
      "List registrations (requires a selector: --type, --attrs, --query, or a geoquery)",
    )
    .option("--type <type>", "Filter by registered entity type")
    .option("--attrs <a,b>", "Comma-separated list of attribute names to match")
    .option("--query <q>", "NGSI-LD query expression (q)")
    .option("--georel <rel>", "Geo-relationship (e.g. near;maxDistance==1000)")
    .option("--geometry <geo>", "Geometry type for geo-query (e.g. Point)")
    .option("--coords <coords>", "Coordinates for geo-query")
    .option("--limit <n>", "Maximum number of results", parseInt)
    .option("--offset <n>", "Skip N results", parseInt)
    .option("--count", "Include total count in response")
    .action(
      withErrorHandler(async (opts: Record<string, unknown>, cmd: Command) => {
        // Mirror assertRegistrationQueryRestrictionPresent (geonicdb#2304):
        // type | attrs | q | (georel|geometry|coordinates). Pagination alone is not enough.
        // Validate before createClient so a missing URL does not mask the too-wide message.
        if (!opts.type && !opts.attrs && !opts.query && !opts.georel && !opts.geometry && !opts.coords) {
          throw new Error(
            "Too wide query (ETSI GS CIM 009 clause 5.10.2.4): specify at least one of --type, --attrs, --query, or a geoquery (--georel / --geometry / --coords).",
          );
        }

        const client = createClient(cmd);
        const format = getFormat(cmd);

        const params: Record<string, string> = {};
        if (opts.type) params.type = String(opts.type);
        if (opts.attrs) params.attrs = String(opts.attrs);
        if (opts.query) params.q = String(opts.query);
        if (opts.georel) params.georel = String(opts.georel);
        if (opts.geometry) params.geometry = String(opts.geometry);
        if (opts.coords) params.coordinates = String(opts.coords);
        if (opts.limit !== undefined) params.limit = String(opts.limit);
        if (opts.offset !== undefined) params.offset = String(opts.offset);
        if (opts.count) params.count = "true";

        const response = await client.get("/csourceRegistrations", params);
        outputResponse(response, format, !!opts.count);
      }),
    );

  addExamples(list, [
    {
      description: "List registrations for an entity type",
      command: "geonic registrations list --type WeatherStation",
    },
    {
      description: "Filter by attribute names",
      command: "geonic registrations list --attrs temperature,humidity",
    },
    {
      description: "Filter with an NGSI-LD query",
      command: "geonic registrations list --query 'temperature>20'",
    },
    {
      description: "Geo-query near a point",
      command:
        "geonic registrations list --georel 'near;maxDistance==1000' --geometry Point --coords '[139.7671,35.6812]'",
    },
    {
      description: "List with pagination",
      command: "geonic registrations list --type WeatherStation --limit 10",
    },
  ]);

  // registrations get
  const get = registrations
    .command("get <id>")
    .description("Get a registration by ID to inspect its federation endpoint and entity routing")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);

        const response = await client.get(
          `/csourceRegistrations/${encodeURIComponent(String(id))}`,
        );
        outputResponse(response, format);
      }),
    );

  addExamples(get, [
    {
      description: "Get registration details by ID",
      command:
        "geonic registrations get urn:ngsi-ld:ContextSourceRegistration:001",
    },
    {
      description: "Inspect federation config in table format",
      command:
        "geonic registrations get urn:ngsi-ld:ContextSourceRegistration:001 --format table",
    },
  ]);

  // registrations create
  const create = registrations
    .command("create [json]")
    .summary("Create a registration")
    .description(
      "Create a registration\n\n" +
        "JSON payload example:\n" +
        "  {\n" +
        '    "type": "ContextSourceRegistration",\n' +
        '    "information": [{"entities": [{"type": "Room"}]}],\n' +
        '    "endpoint": "http://localhost:4000/source"\n' +
        "  }",
    )
    .action(
      withErrorHandler(async (json: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);
        const format = getFormat(cmd);
        const data = await parseJsonInput(json as string | undefined);

        const response = await client.post("/csourceRegistrations", data);
        outputResponse(response, format);
        printSuccess("Registration created.");
      }),
    );

  addExamples(create, [
    {
      description: "Create with inline JSON",
      command: `geonic registrations create '{"type":"ContextSourceRegistration","information":[{"entities":[{"type":"Room"}]}],"endpoint":"http://localhost:4000/source"}'`,
    },
    {
      description: "Create from a file",
      command: "geonic registrations create @registration.json",
    },
    {
      description: "Create from stdin pipe",
      command: "cat registration.json | geonic registrations create",
    },
  ]);

  // registrations update
  const regUpdate = registrations
    .command("update <id> [json]")
    .description("Update a registration")
    .action(
      withErrorHandler(
        async (id: unknown, json: unknown, _opts: unknown, cmd: Command) => {
          const client = createClient(cmd);
          const format = getFormat(cmd);
          const data = await parseJsonInput(json as string | undefined);

          const response = await client.patch(
            `/csourceRegistrations/${encodeURIComponent(String(id))}`,
            data,
          );
          outputResponse(response, format);
          printSuccess("Registration updated.");
        },
      ),
    );

  addExamples(regUpdate, [
    {
      description: "Update endpoint",
      command: `geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001 '{"endpoint":"http://localhost:5000/source"}'`,
    },
    {
      description: "Update from a file",
      command: "geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001 @registration.json",
    },
    {
      description: "Update from stdin pipe",
      command: "cat registration.json | geonic registrations update urn:ngsi-ld:ContextSourceRegistration:001",
    },
  ]);

  // registrations delete
  const del = registrations
    .command("delete <id>")
    .description("Delete a registration and remove its forwarding rule")
    .action(
      withErrorHandler(async (id: unknown, _opts: unknown, cmd: Command) => {
        const client = createClient(cmd);

        await client.delete(
          `/csourceRegistrations/${encodeURIComponent(String(id))}`,
        );
        printSuccess("Registration deleted.");
      }),
    );

  addExamples(del, [
    {
      description: "Delete a registration by ID",
      command:
        "geonic registrations delete urn:ngsi-ld:ContextSourceRegistration:001",
    },
    {
      description: "Remove forwarding rule (using alias)",
      command:
        "geonic reg delete urn:ngsi-ld:ContextSourceRegistration:001",
    },
  ]);
}
