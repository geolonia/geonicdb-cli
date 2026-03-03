import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
}));

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
}));

vi.mock("../src/commands/attrs.js", () => ({
  registerAttrsSubcommand: vi.fn(),
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerEntitiesCommand } from "../src/commands/entities.js";

describe("entities command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerEntitiesCommand);
  });

  describe("list", () => {
    it("calls client.get with no params when no options given", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list"]);

      expect(createClient).toHaveBeenCalled();
      expect(mockClient.get).toHaveBeenCalledWith("/entities", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", false);
    });

    it("passes type option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--type", "Sensor"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ type: "Sensor" }));
    });

    it("passes idPattern option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--id-pattern", "urn:.*"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ idPattern: "urn:.*" }));
    });

    it("passes query option as q", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--query", "temperature>30"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ q: "temperature>30" }));
    });

    it("passes attrs option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--attrs", "temperature,humidity"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ attrs: "temperature,humidity" }));
    });

    it("passes geo-query options", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, [
        "entities", "list",
        "--georel", "near;maxDistance==1000",
        "--geometry", "Point",
        "--coords", "[139.7,35.6]",
      ]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({
        georel: "near;maxDistance==1000",
        geometry: "Point",
        coordinates: "[139.7,35.6]",
      }));
    });

    it("passes spatialId option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--spatial-id", "15/0/29101/12903"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ spatialId: "15/0/29101/12903" }));
    });

    it("passes limit and offset options", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--limit", "10", "--offset", "20"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({
        limit: "10",
        offset: "20",
      }));
    });

    it("passes orderBy option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--order-by", "temperature"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ orderBy: "temperature" }));
    });

    it("passes count option and sets showCount to true", async () => {
      mockClient.get.mockResolvedValue(mockResponse([], 200, 42));
      await runCommand(program, ["entities", "list", "--count"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ count: "true" }));
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", true);
    });

    it("passes keyValues option as options=keyValues", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--key-values"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ options: "keyValues" }));
    });
  });

  describe("get", () => {
    it("calls client.get with encoded entity ID", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "urn:ngsi-ld:Sensor:001" }));
      await runCommand(program, ["entities", "get", "urn:ngsi-ld:Sensor:001"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
        {},
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("passes keyValues option", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "e1" }));
      await runCommand(program, ["entities", "get", "e1", "--key-values"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("e1")}`,
        { options: "keyValues" },
      );
    });
  });

  describe("create", () => {
    it("parses JSON input and posts to /entities", async () => {
      const entityData = { id: "urn:ngsi-ld:Sensor:001", type: "Sensor" };
      vi.mocked(parseJsonInput).mockResolvedValue(entityData);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 201));

      await runCommand(program, ["entities", "create", '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"}');
      expect(mockClient.post).toHaveBeenCalledWith("/entities", entityData);
      expect(printSuccess).toHaveBeenCalledWith("Entity created.");
    });
  });

  describe("update", () => {
    it("parses JSON input and patches entity attrs", async () => {
      const attrData = { temperature: { value: 25 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "update", "urn:ngsi-ld:Sensor:001", '{"temperature":{"value":25}}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"temperature":{"value":25}}');
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity updated.");
    });
  });

  describe("replace", () => {
    it("parses JSON input and puts entity attrs", async () => {
      const attrData = { temperature: { value: 30 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.put.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "replace", "urn:ngsi-ld:Sensor:001", '{"temperature":{"value":30}}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"temperature":{"value":30}}');
      expect(mockClient.put).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity replaced.");
    });
  });

  describe("upsert", () => {
    it("parses JSON input and posts to /entityOperations/upsert", async () => {
      const entities = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(entities);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "upsert", '[{"id":"e1","type":"T"}]']);

      expect(parseJsonInput).toHaveBeenCalledWith('[{"id":"e1","type":"T"}]');
      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/upsert", entities);
      expect(printSuccess).toHaveBeenCalledWith("Entity upserted.");
    });
  });

  describe("delete", () => {
    it("deletes entity by ID", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "delete", "urn:ngsi-ld:Sensor:001"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity deleted.");
    });
  });
});
