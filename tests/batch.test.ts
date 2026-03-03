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
import { registerBatchCommand } from "../src/commands/batch.js";

describe("batch (entityOperations) command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerBatchCommand);
  });

  describe("create", () => {
    it("parses JSON and posts to /entityOperations/create", async () => {
      const data = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(data);
      mockClient.post.mockResolvedValue(mockResponse(["e1"], 200));

      await runCommand(program, ["entityOperations", "create", '[{"id":"e1"}]']);

      expect(parseJsonInput).toHaveBeenCalledWith('[{"id":"e1"}]');
      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/create", data);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("upsert", () => {
    it("parses JSON and posts to /entityOperations/upsert", async () => {
      const data = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(data);
      mockClient.post.mockResolvedValue(mockResponse(["e1"], 200));

      await runCommand(program, ["entityOperations", "upsert", '[{"id":"e1"}]']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/upsert", data);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("parses JSON and posts to /entityOperations/update", async () => {
      const data = [{ id: "e1", temperature: { value: 25 } }];
      vi.mocked(parseJsonInput).mockResolvedValue(data);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entityOperations", "update", '[{"id":"e1"}]']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/update", data);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("parses JSON and posts to /entityOperations/delete", async () => {
      const data = ["urn:ngsi-ld:Entity:001"];
      vi.mocked(parseJsonInput).mockResolvedValue(data);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entityOperations", "delete", '["urn:ngsi-ld:Entity:001"]']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/delete", data);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("query", () => {
    it("parses JSON and posts to /entityOperations/query", async () => {
      const queryPayload = { entities: [{ type: "Sensor" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(queryPayload);
      mockClient.post.mockResolvedValue(mockResponse([{ id: "e1" }], 200));

      await runCommand(program, ["entityOperations", "query", '{"entities":[]}']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/query", queryPayload);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("merge", () => {
    it("parses JSON and posts to /entityOperations/merge", async () => {
      const mergeData = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(mergeData);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entityOperations", "merge", '[{"id":"e1"}]']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/merge", mergeData);
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("alias", () => {
    it("works with batch alias", async () => {
      const data = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(data);
      mockClient.post.mockResolvedValue(mockResponse(["e1"], 200));

      await runCommand(program, ["batch", "create", '[{"id":"e1"}]']);

      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/create", data);
    });
  });
});
