import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerRulesCommand } from "../src/commands/rules.js";

describe("rules command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerRulesCommand);
  });

  describe("list", () => {
    it("calls rawRequest GET /rules", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "rule1" }]));
      await runCommand(program, ["rules", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/rules");
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("get", () => {
    it("calls rawRequest GET with encoded rule ID", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "rule1" }));
      await runCommand(program, ["rules", "get", "rule1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/rules/${encodeURIComponent("rule1")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("parses JSON and posts via rawRequest", async () => {
      const ruleData = { name: "TestRule", condition: "temp>30" };
      vi.mocked(parseJsonInput).mockResolvedValue(ruleData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "rule1" }, 201));

      await runCommand(program, ["rules", "create", '{"name":"TestRule"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"TestRule"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith("POST", "/rules", { body: ruleData });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Rule created.");
    });
  });

  describe("update", () => {
    it("parses JSON and patches via rawRequest", async () => {
      const patchData = { name: "UpdatedRule" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["rules", "update", "rule1", '{"name":"UpdatedRule"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"UpdatedRule"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/rules/${encodeURIComponent("rule1")}`,
        { body: patchData },
      );
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Rule updated.");
    });
  });

  describe("delete", () => {
    it("deletes rule via rawRequest", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["rules", "delete", "rule1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "DELETE",
        `/rules/${encodeURIComponent("rule1")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Rule deleted.");
    });
  });

  describe("activate", () => {
    it("posts to activate endpoint via rawRequest", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["rules", "activate", "rule1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "POST",
        `/rules/${encodeURIComponent("rule1")}/activate`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Rule activated.");
    });
  });

  describe("deactivate", () => {
    it("posts to deactivate endpoint via rawRequest", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["rules", "deactivate", "rule1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "POST",
        `/rules/${encodeURIComponent("rule1")}/deactivate`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Rule deactivated.");
    });
  });
});
