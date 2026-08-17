import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { GdbClientError } from "../src/client.js";
import { addAttrsSubcommands } from "../src/commands/attrs.js";

describe("attrs subcommand", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram((prog) => {
      const attrs = prog.command("attrs");
      addAttrsSubcommands(attrs);
    });
  });

  describe("list", () => {
    it("calls client.get with entity attrs path", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ temperature: {} }));
      await runCommand(program, ["attrs", "list", "urn:ngsi-ld:Sensor:001"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("get", () => {
    it("calls client.get with entity attr path", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ value: 25 }));
      await runCommand(program, ["attrs", "get", "urn:ngsi-ld:Sensor:001", "temperature"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs/${encodeURIComponent("temperature")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("add", () => {
    it("parses JSON and posts to entity attrs path", async () => {
      const attrData = { humidity: { value: 50 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["attrs", "add", "urn:ngsi-ld:Sensor:001", '{"humidity":{"value":50}}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"humidity":{"value":50}}');
      expect(mockClient.post).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Attributes added.");
    });
  });

  describe("update", () => {
    it("parses JSON and puts to entity attr path", async () => {
      const attrData = { value: 30 };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.put.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["attrs", "update", "urn:ngsi-ld:Sensor:001", "temperature", '{"value":30}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"value":30}');
      expect(mockClient.put).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs/${encodeURIComponent("temperature")}`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Attribute updated.");
    });
  });

  describe("delete", () => {
    it("deletes a specific attribute", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["attrs", "delete", "urn:ngsi-ld:Sensor:001", "temperature"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs/${encodeURIComponent("temperature")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Attribute deleted.");
    });

    it("passes datasetId query param when --dataset-id is set", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, [
        "attrs",
        "delete",
        "urn:ngsi-ld:Sensor:001",
        "temperature",
        "--dataset-id",
        "urn:ngsi-ld:Dataset:outdoor",
      ]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs/${encodeURIComponent("temperature")}`,
        { datasetId: "urn:ngsi-ld:Dataset:outdoor" },
      );
      expect(printSuccess).toHaveBeenCalledWith("Attribute deleted.");
    });

    it("passes deleteAll=true when --delete-all is set", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, [
        "attrs",
        "delete",
        "urn:ngsi-ld:Sensor:001",
        "temperature",
        "--delete-all",
      ]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs/${encodeURIComponent("temperature")}`,
        { deleteAll: "true" },
      );
      expect(printSuccess).toHaveBeenCalledWith("Attribute deleted.");
    });

    it("rejects combining --dataset-id and --delete-all before any request", async () => {
      await expect(
        runCommand(program, [
          "attrs",
          "delete",
          "urn:ngsi-ld:Sensor:001",
          "temperature",
          "--dataset-id",
          "urn:ngsi-ld:Dataset:outdoor",
          "--delete-all",
        ]),
      ).rejects.toThrow("Cannot specify both --dataset-id and --delete-all.");

      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it('rejects an empty --dataset-id before any request', async () => {
      await expect(
        runCommand(program, [
          "attrs",
          "delete",
          "urn:ngsi-ld:Sensor:001",
          "temperature",
          "--dataset-id",
          "",
        ]),
      ).rejects.toThrow("--dataset-id must not be empty.");

      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it("hints at --dataset-id / --delete-all when delete returns 404", async () => {
      mockClient.delete.mockRejectedValue(new GdbClientError("Attribute not found", 404));

      await expect(
        runCommand(program, ["attrs", "delete", "urn:ngsi-ld:Sensor:001", "temperature"]),
      ).rejects.toThrow(/--dataset-id|--delete-all/);

      expect(mockClient.delete).toHaveBeenCalled();
    });

    // near-miss: non-404 errors must not get the multi-instance hint
    it("does not rewrite non-404 delete errors with the datasetId hint", async () => {
      mockClient.delete.mockRejectedValue(new GdbClientError("Forbidden", 403));

      let caught: unknown;
      try {
        await runCommand(program, ["attrs", "delete", "urn:ngsi-ld:Sensor:001", "temperature"]);
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(GdbClientError);
      expect((caught as Error).message).toBe("Forbidden");
      expect((caught as Error).message).not.toMatch(/--dataset-id|--delete-all/);
    });
  });
});
