import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  SCOPES_HELP_NOTES: [],
  resolveOptions: vi.fn(),
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

vi.mock("node:module", () => ({
  createRequire: vi.fn(() => () => ({ version: "1.0.0" })),
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { printInfo } from "../src/output.js";
import { registerHealthCommand, registerVersionCommand } from "../src/commands/health.js";

describe("health command", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  it("calls rawRequest GET /health and outputs response", async () => {
    client.rawRequest.mockResolvedValue(mockResponse({ status: "healthy" }));
    const program = createTestProgram((prog) => registerHealthCommand(prog));
    await runCommand(program, ["health"]);
    expect(client.rawRequest).toHaveBeenCalledWith("GET", "/health");
    expect(outputResponse).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "healthy" } }),
      "json",
    );
  });
});

describe("version command", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  it("prints CLI version, then fetches and outputs server version", async () => {
    client.rawRequest.mockResolvedValue(mockResponse({ version: "2.0.0" }));
    const program = createTestProgram((prog) => registerVersionCommand(prog));
    await runCommand(program, ["version"]);
    expect(printInfo).toHaveBeenCalledWith("CLI version: 1.0.0");
    expect(client.rawRequest).toHaveBeenCalledWith("GET", "/version");
    expect(printInfo).toHaveBeenCalledWith("Server version:");
    expect(outputResponse).toHaveBeenCalledWith(
      expect.objectContaining({ data: { version: "2.0.0" } }),
      "json",
    );
  });
});
