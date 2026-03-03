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
import { registerSubscriptionsCommand } from "../src/commands/subscriptions.js";

describe("subscriptions command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerSubscriptionsCommand);
  });

  describe("list", () => {
    it("calls client.get with no params when no options given", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["subscriptions", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/subscriptions", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", false);
    });

    it("passes limit and offset params", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["subscriptions", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.get).toHaveBeenCalledWith("/subscriptions", {
        limit: "10",
        offset: "5",
      });
    });

    it("passes count param and sets showCount to true", async () => {
      mockClient.get.mockResolvedValue(mockResponse([], 200, 7));
      await runCommand(program, ["subscriptions", "list", "--count"]);

      expect(mockClient.get).toHaveBeenCalledWith("/subscriptions", { count: "true" });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", true);
    });
  });

  describe("get", () => {
    it("calls client.get with encoded subscription ID", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "sub1" }));
      await runCommand(program, ["subscriptions", "get", "urn:ngsi-ld:Sub:001"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/subscriptions/${encodeURIComponent("urn:ngsi-ld:Sub:001")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("parses JSON input and posts to /subscriptions", async () => {
      const subData = { type: "Subscription", entities: [{ type: "Sensor" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(subData);
      mockClient.post.mockResolvedValue(mockResponse({ id: "sub1" }, 201));

      await runCommand(program, ["subscriptions", "create", '{"type":"Subscription"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"type":"Subscription"}');
      expect(mockClient.post).toHaveBeenCalledWith("/subscriptions", subData);
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Subscription created.");
    });
  });

  describe("update", () => {
    it("parses JSON input and patches subscription", async () => {
      const patchData = { description: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["subscriptions", "update", "sub1", '{"description":"updated"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"description":"updated"}');
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/subscriptions/${encodeURIComponent("sub1")}`,
        patchData,
      );
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Subscription updated.");
    });
  });

  describe("delete", () => {
    it("deletes subscription by ID", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["subscriptions", "delete", "urn:ngsi-ld:Sub:001"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/subscriptions/${encodeURIComponent("urn:ngsi-ld:Sub:001")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Subscription deleted.");
    });
  });
});
