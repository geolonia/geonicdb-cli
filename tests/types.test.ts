import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  parseNonNegativeInt: (value: string): number => {
    if (!/^\d+$/.test(value)) throw new Error("Invalid non-negative integer");
    return Number(value);
  },
  buildPaginationParams: (opts: { limit?: number; offset?: number }): Record<string, string> => {
    const params: Record<string, string> = {};
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return params;
  },
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
import { registerTypesCommand } from "../src/commands/types.js";

describe("types command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerTypesCommand);
  });

  describe("list", () => {
    it("calls client.get on /types", async () => {
      mockClient.get.mockResolvedValue(mockResponse([{ id: "Sensor" }]));
      await runCommand(program, ["types", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/types", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("forwards --limit and --offset", async () => {
      mockClient.get.mockResolvedValue(mockResponse([{ id: "Sensor" }]));
      await runCommand(program, ["types", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.get).toHaveBeenCalledWith("/types", {
        limit: "10",
        offset: "5",
      });
    });
  });

  describe("get", () => {
    it("calls client.get with encoded type name", async () => {
      const typeName = "Sensor/Temperature#v2";
      mockClient.get.mockResolvedValue(mockResponse({ id: typeName, attrs: {} }));
      await runCommand(program, ["types", "get", typeName]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/types/${encodeURIComponent(typeName)}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });
});
