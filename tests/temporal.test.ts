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
    // #188: the server implements no aggregation on the POST query path — these
    // flags were a silent no-op there, so they now fail loudly as unknown options.
    it("rejects --aggr-methods / --aggr-period as unknown options (#188)", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "temporal", "entityOperations", "query", '{}',
          "--aggr-methods", "totalCount,sum",
        ]),
      ).rejects.toThrow(/unknown option/i);
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
        "--options", "aggregatedValues", "--aggr-methods", "avg",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities/urn%3Asensor%3A001", {
        options: "aggregatedValues",
        aggrMethods: "avg",
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

    it("allows --aggr-methods without --options (server aggregates on its presence)", async () => {
      client.get.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, [
        "temporal", "entities", "list", "--aggr-methods", "totalCount",
      ]);
      expect(client.get).toHaveBeenCalledWith("/temporal/entities", {
        aggrMethods: "totalCount",
      });
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
  });
});
