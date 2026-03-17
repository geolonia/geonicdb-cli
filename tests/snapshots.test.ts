import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  SCOPES_HELP_NOTES: [],
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

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { printSuccess } from "../src/output.js";
import { registerSnapshotsCommand } from "../src/commands/snapshots.js";

describe("snapshots command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerSnapshotsCommand);
  });

  describe("list", () => {
    it("calls client.get with no params when no options given", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["snapshots", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/snapshots", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("passes limit and offset params", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["snapshots", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.get).toHaveBeenCalledWith("/snapshots", {
        limit: "10",
        offset: "5",
      });
    });
  });

  describe("get", () => {
    it("calls client.get with encoded snapshot ID", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "snap1" }));
      await runCommand(program, ["snapshots", "get", "snap1"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/snapshots/${encodeURIComponent("snap1")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("posts to /snapshots with no body", async () => {
      mockClient.post.mockResolvedValue(mockResponse(undefined, 201));
      await runCommand(program, ["snapshots", "create"]);

      expect(mockClient.post).toHaveBeenCalledWith("/snapshots");
      expect(printSuccess).toHaveBeenCalledWith("Snapshot created.");
    });
  });

  describe("delete", () => {
    it("deletes snapshot by ID", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["snapshots", "delete", "snap1"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/snapshots/${encodeURIComponent("snap1")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Snapshot deleted.");
    });
  });

  describe("clone", () => {
    it("outputs response when clone returns data", async () => {
      mockClient.post.mockResolvedValue(mockResponse({ id: "snap2" }, 201));
      await runCommand(program, ["snapshots", "clone", "snap1"]);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/snapshots/${encodeURIComponent("snap1")}/clone`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
      expect(printSuccess).not.toHaveBeenCalled();
    });

    it("prints success when clone returns no data", async () => {
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["snapshots", "clone", "snap1"]);

      expect(mockClient.post).toHaveBeenCalledWith(
        `/snapshots/${encodeURIComponent("snap1")}/clone`,
      );
      expect(outputResponse).not.toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Snapshot cloned.");
    });

    it("prints success when clone returns empty string", async () => {
      mockClient.post.mockResolvedValue(mockResponse("", 200));
      await runCommand(program, ["snapshots", "clone", "snap1"]);

      expect(outputResponse).not.toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Snapshot cloned.");
    });
  });
});
