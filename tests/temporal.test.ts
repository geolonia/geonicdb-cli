import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/helpers.js")>();
  return {
    createClient: vi.fn(),
    getFormat: vi.fn(),
    outputResponse: vi.fn(),
    withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
    resolveOptions: vi.fn(),
    // Use the real parser so the `--last-n` option wiring is genuinely exercised.
    parsePositiveInt: actual.parsePositiveInt,
    surfaceNgsiWarning: vi.fn(),
  };
});

vi.mock("../src/input.js", () => ({
  parseJsonInput: vi.fn(),
}));

vi.mock("../src/output.js", () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
  addNotes: vi.fn(),
}));

import { createClient, getFormat, outputResponse, surfaceNgsiWarning } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerTemporalCommand } from "../src/commands/temporal.js";

describe("temporal commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => registerTemporalCommand(prog));
  }

  describe("temporal entities list", () => {
    it("calls GET /temporal/entities with no params", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "list"]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {});
      expect(outputResponse).toHaveBeenCalled();
    });

    it("surfaces the NGSILD-Warning header from the response", async () => {
      const res = mockResponse([]);
      client.get.mockResolvedValue(res);
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "list"]);
      expect(surfaceNgsiWarning).toHaveBeenCalledWith(res.headers);
    });

    it("rejects a non-positive --last-n before issuing a request", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await expect(
        runCommand(program, ["temporal", "entities", "list", "--last-n", "0"]),
      ).rejects.toThrow(/positive integer/);
      expect(client.get).not.toHaveBeenCalled();
    });

    it("passes all filter options as params", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list",
        "--type", "Sensor",
        "--attrs", "temperature,humidity",
        "--query", "temperature>20",
        "--georel", "near;maxDistance:1000",
        "--geometry", "point",
        "--coords", "40.0,-3.0",
        "--time-rel", "between",
        "--time-at", "2025-01-01T00:00:00Z",
        "--end-time-at", "2025-01-31T23:59:59Z",
        "--last-n", "5",
        "--limit", "10",
        "--offset", "20",
        "--order-by", "observedAt;desc",
        "--count",
      ]);

      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        type: "Sensor",
        attrs: "temperature,humidity",
        q: "temperature>20",
        georel: "near;maxDistance:1000",
        geometry: "point",
        coordinates: "40.0,-3.0",
        timerel: "between",
        timeAt: "2025-01-01T00:00:00Z",
        endTimeAt: "2025-01-31T23:59:59Z",
        lastN: "5",
        limit: "10",
        offset: "20",
        orderBy: "observedAt;desc",
        count: "true",
      });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", true);
    });

    // #202 / geolonia/geonicdb#2267: --time-property → timeproperty query param
    it("passes --time-property createdAt as timeproperty (#202)", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list",
        "--time-rel", "after",
        "--time-at", "2025-01-01T00:00:00Z",
        "--time-property", "createdAt",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        timerel: "after",
        timeAt: "2025-01-01T00:00:00Z",
        timeproperty: "createdAt",
      });
    });

    // near-miss: without the flag the query must not invent a timeproperty key
    // (server default is observedAt only when the param is absent).
    it("omits timeproperty when --time-property is not set", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list",
        "--time-rel", "after",
        "--time-at", "2025-01-01T00:00:00Z",
      ]);
      const params = client.get.mock.calls[0]?.[1] as Record<string, string>;
      expect(params).not.toHaveProperty("timeproperty");
    });

    // Empty string is an explicit (invalid) value — forward it so the server
    // can 400, rather than treating it as "flag absent → observedAt default".
    it("forwards empty --time-property so the server can reject it", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list",
        "--time-property", "",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        timeproperty: "",
      });
    });
  });

  describe("temporal entities get", () => {
    it("calls GET /temporal/entities/{id} with no params", async () => {
      client.get.mockResolvedValue(mockResponse({ id: "urn:sensor:001" }));
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "get", "urn:sensor:001"]);
      expect(client.get).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
        {},
      );
      expect(outputResponse).toHaveBeenCalled();
    });

    it("passes attrs, timeRel, timeAt, endTimeAt, lastN", async () => {
      client.get.mockResolvedValue(mockResponse({ id: "urn:sensor:001" }));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "get", "urn:sensor:001",
        "--attrs", "temperature",
        "--time-rel", "after",
        "--time-at", "2025-06-01T00:00:00Z",
        "--end-time-at", "2025-07-01T00:00:00Z",
        "--last-n", "10",
      ]);
      expect(client.get).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
        {
          attrs: "temperature",
          timerel: "after",
          timeAt: "2025-06-01T00:00:00Z",
          endTimeAt: "2025-07-01T00:00:00Z",
          lastN: "10",
        },
      );
    });

    it("passes --time-property createdAt as timeproperty (#202)", async () => {
      client.get.mockResolvedValue(mockResponse({ id: "urn:sensor:001" }));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "get", "urn:sensor:001",
        "--time-rel", "before",
        "--time-at", "2025-06-01T00:00:00Z",
        "--time-property", "createdAt",
      ]);
      expect(client.get).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
        {
          timerel: "before",
          timeAt: "2025-06-01T00:00:00Z",
          timeproperty: "createdAt",
        },
      );
    });

    it("forwards empty --time-property so the server can reject it", async () => {
      client.get.mockResolvedValue(mockResponse({ id: "urn:sensor:001" }));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "get", "urn:sensor:001",
        "--time-property", "",
      ]);
      expect(client.get).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
        { timeproperty: "" },
      );
    });

    it("surfaces the NGSILD-Warning header from the response", async () => {
      const res = mockResponse({ id: "urn:sensor:001" });
      client.get.mockResolvedValue(res);
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "get", "urn:sensor:001"]);
      expect(surfaceNgsiWarning).toHaveBeenCalledWith(res.headers);
    });

    it("rejects a non-positive --last-n before issuing a request", async () => {
      client.get.mockResolvedValue(mockResponse({ id: "urn:sensor:001" }));
      const program = makeProgram();
      await expect(
        runCommand(program, ["temporal", "entities", "get", "urn:sensor:001", "--last-n", "0"]),
      ).rejects.toThrow(/positive integer/);
      expect(client.get).not.toHaveBeenCalled();
    });
  });

  describe("temporal entities create", () => {
    it("posts body to /temporal/entities and prints success", async () => {
      const body = { id: "urn:sensor:001", type: "Sensor" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.post.mockResolvedValue(mockResponse(undefined, 201));
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "create", '{"id":"urn:sensor:001"}']);
      expect(client.post).toHaveBeenCalledWith("/temporal/entities", body);
      expect(printSuccess).toHaveBeenCalledWith("Temporal entity created.");
    });
  });

  describe("temporal entities delete", () => {
    it("calls DELETE /temporal/entities/{id} and prints success", async () => {
      client.delete.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["temporal", "entities", "delete", "urn:sensor:001"]);
      expect(client.delete).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
      );
      expect(printSuccess).toHaveBeenCalledWith("Temporal entity deleted.");
    });
  });

  describe("temporal entityOperations query", () => {
    // #188 → geolonia/geonicdb#1816: the flags used to be a silent no-op here;
    // the server now accepts them in the query string (fallback for the body's
    // temporalQ object, clause 6.24.3.1 mirrors 6.18.3.2), so they are wired
    // for real and share the GET-path guards.
    it("passes --aggr-methods / --aggr-period as query params (#188)", async () => {
      const body = { entities: [{ type: "Sensor" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.post.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entityOperations", "query", '{}',
        "--aggr-methods", "totalCount,sum",
        "--aggr-period", "PT1H",
      ]);
      expect(client.post).toHaveBeenCalledWith(
        "/temporal/entityOperations/query",
        body,
        { aggrMethods: "totalCount,sum", aggrPeriodDuration: "PT1H" },
      );
    });

    it("passes --options through on the POST path", async () => {
      const body = { entities: [{ type: "Sensor" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.post.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entityOperations", "query", '{}',
        "--options", "temporalValues",
      ]);
      expect(client.post).toHaveBeenCalledWith(
        "/temporal/entityOperations/query",
        body,
        { options: "temporalValues" },
      );
    });

    it("rejects --aggr-methods without --aggr-period before any request", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entityOperations", "query", '{}',
          "--aggr-methods", "totalCount,sum",
        ]),
      ).rejects.toThrow(/requires --aggr-period/);
      expect(client.post).not.toHaveBeenCalled();
    });

    // A period without methods is silently ignored server-side — the exact
    // class #188 exists to eliminate, so the CLI refuses to send it.
    it("rejects --aggr-period without --aggr-methods before any request", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entityOperations", "query", '{}',
          "--aggr-period", "PT1H",
        ]),
      ).rejects.toThrow(/requires --aggr-methods/);
      expect(client.post).not.toHaveBeenCalled();
    });

    it("surfaces the NGSILD-Warning header from the response", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ entities: [{ type: "Sensor" }] });
      const res = mockResponse([]);
      client.post.mockResolvedValue(res);
      const program = makeProgram();
      await runCommand(program, ["temporal", "entityOperations", "query", "{}"]);
      expect(surfaceNgsiWarning).toHaveBeenCalledWith(res.headers);
    });

    it("posts body without aggr options", async () => {
      const body = { entities: [{ type: "Sensor" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.post.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["temporal", "entityOperations", "query", '{}']);
      expect(client.post).toHaveBeenCalledWith(
        "/temporal/entityOperations/query",
        body,
      );
    });
  });

  // #181/#188: NGSI-LD representation parameters on the GET retrieval paths.
  // https://cim.etsi.org/NGSI-LD/official/clause-6.html (clause 6.3.11 / 6.3.12)
  describe("temporal representation options (#181/#188)", () => {
    it("passes --options through as the options query parameter", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list", "--options", "temporalValues,sysAttrs",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        options: "temporalValues,sysAttrs",
      });
    });

    it("passes aggregation params on list", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list",
        "--options", "aggregatedValues",
        "--aggr-methods", "avg,sum",
        "--aggr-period", "PT1H",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        options: "aggregatedValues",
        aggrMethods: "avg,sum",
        aggrPeriodDuration: "PT1H",
      });
    });

    it("passes representation params on get", async () => {
      client.get.mockResolvedValue(mockResponse({}));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "get", "urn:sensor:001",
        "--options", "aggregatedValues", "--aggr-methods", "avg", "--aggr-period", "PT1H",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities/urn%3Asensor%3A001", {
        options: "aggregatedValues",
        aggrMethods: "avg",
        aggrPeriodDuration: "PT1H",
      });
    });

    // Table 6.19.3.1-1: aggrMethods "shall be 1 if aggregatedValues is present".
    it("rejects --options aggregatedValues without --aggr-methods before any request", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list", "--options", "aggregatedValues",
        ]),
      ).rejects.toThrow(/requires --aggr-methods/);
      expect(client.get).not.toHaveBeenCalled();
    });

    // clause 6.3.12: only one representation keyword may be present.
    it("rejects combining temporalValues with aggregatedValues before any request", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list",
          "--options", "temporalValues,aggregatedValues",
          "--aggr-methods", "avg",
        ]),
      ).rejects.toThrow(/only one representation keyword/i);
      expect(client.get).not.toHaveBeenCalled();
    });

    // near-miss: `simplified` is an alias of temporalValues and must trip the
    // same exclusivity rule.
    it("rejects combining simplified with aggregatedValues", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "get", "urn:sensor:001",
          "--options", "simplified,aggregatedValues",
          "--aggr-methods", "avg",
        ]),
      ).rejects.toThrow(/only one representation keyword/i);
      expect(client.get).not.toHaveBeenCalled();
    });

    // The server aggregates on the mere presence of aggrMethods (no --options
    // needed) but rejects aggregation without a period on every route — so the
    // pair is sendable, either half alone is not.
    it("allows --aggr-methods with --aggr-period without --options", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list", "--aggr-methods", "totalCount", "--aggr-period", "PT1H",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        aggrMethods: "totalCount",
        aggrPeriodDuration: "PT1H",
      });
    });

    it("rejects --aggr-methods without --aggr-period before any request", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list", "--aggr-methods", "totalCount",
        ]),
      ).rejects.toThrow(/requires --aggr-period/);
      expect(client.get).not.toHaveBeenCalled();
    });

    it("rejects --aggr-period without --aggr-methods before any request", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "get", "urn:sensor:001", "--aggr-period", "PT1H",
        ]),
      ).rejects.toThrow(/requires --aggr-methods/);
      expect(client.get).not.toHaveBeenCalled();
    });

    // near-miss for the token normalization: the exclusivity guard must still
    // fire when the operator writes a space after the comma.
    it("rejects 'temporalValues, aggregatedValues' with a space after the comma", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list",
          "--options", "temporalValues, aggregatedValues",
          "--aggr-methods", "avg", "--aggr-period", "PT1H",
        ]),
      ).rejects.toThrow(/only one representation keyword/i);
      expect(client.get).not.toHaveBeenCalled();
    });

    // Whitespace-only values are "not specified" server-side; the guards must
    // agree instead of letting the request through to a server 400.
    it("treats a whitespace-only --aggr-methods as absent", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list", "--options", "aggregatedValues",
          "--aggr-methods", "   ", "--aggr-period", "PT1H",
        ]),
      ).rejects.toThrow(/requires --aggr-methods/);
      expect(client.get).not.toHaveBeenCalled();
    });

    // The aggregation pipeline sorts by entityId; the server 400s on orderBy +
    // aggrMethods, so the CLI fails fast like the other deterministic 400s.
    it("rejects --order-by combined with --aggr-methods before any request", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entities", "list",
          "--order-by", "observedAt;desc",
          "--aggr-methods", "avg", "--aggr-period", "PT1H",
        ]),
      ).rejects.toThrow(/--order-by cannot be combined/);
      expect(client.get).not.toHaveBeenCalled();
    });
  });

  describe("hidden aliases", () => {
    it("temporal list works as alias for temporal entities list", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["temporal", "list", "--type", "Sensor", "--order-by", "observedAt;desc"]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        type: "Sensor",
        orderBy: "observedAt;desc",
      });
    });

    it("temporal get works as alias for temporal entities get", async () => {
      client.get.mockResolvedValue(mockResponse({}));
      const program = makeProgram();
      await runCommand(program, ["temporal", "get", "urn:sensor:001"]);
      expect(client.get).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
        {},
      );
    });

    it("temporal create works as alias for temporal entities create", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ id: "urn:s:1" });
      client.post.mockResolvedValue(mockResponse(undefined, 201));
      const program = makeProgram();
      await runCommand(program, ["temporal", "create", '{}']);
      expect(client.post).toHaveBeenCalledWith("/temporal/entities", { id: "urn:s:1" });
      expect(printSuccess).toHaveBeenCalledWith("Temporal entity created.");
    });

    it("temporal delete works as alias for temporal entities delete", async () => {
      client.delete.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["temporal", "delete", "urn:sensor:001"]);
      expect(client.delete).toHaveBeenCalledWith(
        "/temporal/entities/urn%3Asensor%3A001",
      );
    });

    it("temporal query works as alias for temporal entityOperations query", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      client.post.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["temporal", "query", '{}']);
      expect(client.post).toHaveBeenCalledWith(
        "/temporal/entityOperations/query",
        {},
      );
    });

    // Parity: the aggregation flags must reach the alias too, not just the
    // canonical command.
    it("temporal query alias carries the aggregation flags", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      client.post.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "query", '{}', "--aggr-methods", "avg", "--aggr-period", "PT1H",
      ]);
      expect(client.post).toHaveBeenCalledWith(
        "/temporal/entityOperations/query",
        {},
        { aggrMethods: "avg", aggrPeriodDuration: "PT1H" },
      );
    });
  });
});
