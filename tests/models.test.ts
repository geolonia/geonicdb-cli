import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerModelsCommand } from "../src/commands/models.js";

describe("models (custom-data-models) command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerModelsCommand);
  });

  describe("list", () => {
    it("calls rawRequest GET /custom-data-models", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "model1" }]));
      await runCommand(program, ["custom-data-models", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", { params: {} });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("works with models alias", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["models", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", { params: {} });
    });

    it("forwards --limit and --offset", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["models", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", {
        params: { limit: "10", offset: "5" },
      });
    });
  });

  describe("get", () => {
    it("calls rawRequest GET with encoded model ID", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "model1" }));
      await runCommand(program, ["custom-data-models", "get", "model1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/custom-data-models/${encodeURIComponent("model1")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("parses JSON and posts via rawRequest", async () => {
      const modelData = { name: "TestModel", schema: {} };
      vi.mocked(parseJsonInput).mockResolvedValue(modelData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "model1" }, 201));

      await runCommand(program, ["custom-data-models", "create", '{"name":"TestModel"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"TestModel"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith("POST", "/custom-data-models", { body: modelData });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Model created.");
    });
  });

  describe("update", () => {
    it("parses JSON and patches via rawRequest", async () => {
      const patchData = { name: "UpdatedModel" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["custom-data-models", "update", "model1", '{"name":"UpdatedModel"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"UpdatedModel"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("model1")}`,
        { body: patchData },
      );
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Model updated.");
    });
  });

  describe("delete", () => {
    it("deletes model via rawRequest", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["custom-data-models", "delete", "model1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "DELETE",
        `/custom-data-models/${encodeURIComponent("model1")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Model deleted.");
    });
  });
});
