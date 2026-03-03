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

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
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
  });
});
