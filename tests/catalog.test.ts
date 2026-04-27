import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { registerCatalogCommand } from "../src/commands/catalog.js";

describe("catalog command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerCatalogCommand);
  });

  describe("get", () => {
    it("calls rawRequest GET /catalog", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse({ title: "Catalog" }));
      await runCommand(program, ["catalog", "get"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/catalog");
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("datasets list", () => {
    it("calls rawRequest GET /catalog/datasets", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "ds1" }]));
      await runCommand(program, ["catalog", "datasets", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/catalog/datasets", { params: {} });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("forwards --limit and --offset", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "ds1" }]));
      await runCommand(program, ["catalog", "datasets", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/catalog/datasets", {
        params: { limit: "10", offset: "5" },
      });
    });
  });

  describe("datasets get", () => {
    it("calls rawRequest GET with encoded dataset ID", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "ds1" }));
      await runCommand(program, ["catalog", "datasets", "get", "ds1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/catalog/datasets/${encodeURIComponent("ds1")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("datasets sample", () => {
    it("calls rawRequest GET with dataset sample path", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "e1" }]));
      await runCommand(program, ["catalog", "datasets", "sample", "ds1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/catalog/datasets/${encodeURIComponent("ds1")}/sample`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });
});
