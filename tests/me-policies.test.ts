import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn(),
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
  addNotes: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  loadConfig: vi.fn().mockImplementation(() => ({})),
  saveConfig: vi.fn(),
  validateUrl: vi.fn().mockImplementation((url: string) => url),
  getCurrentProfile: vi.fn().mockReturnValue("default"),
}));

vi.mock("../src/token.js", () => ({
  getTokenStatus: vi.fn().mockReturnValue({}),
  formatDuration: vi.fn(),
}));

vi.mock("../src/oauth.js", () => ({
  clientCredentialsGrant: vi.fn(),
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerAuthCommands } from "../src/commands/auth.js";

describe("me policies commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      registerAuthCommands(prog);
    });
  }

  describe("policies list", () => {
    it("calls GET /me/policies", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ policyId: "p1" }]));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me/policies");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("policies get", () => {
    it("calls GET /me/policies/{policyId}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "p1" }));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "get", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me/policies/p1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in policyId", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "urn:p:1" }));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "get", "urn:p:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me/policies/urn%3Ap%3A1");
    });
  });

  describe("policies create", () => {
    it("posts body and prints success", async () => {
      const body = {
        policyId: "my-readonly",
        target: { resources: [{ attributeId: "path", matchValue: "/v2/**", matchFunction: "glob" }] },
        rules: [{ ruleId: "allow-get", effect: "Permit" }],
      };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "my-readonly" }, 201));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "create", JSON.stringify(body)]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/policies", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Policy created.");
    });

    it("reads from stdin when no json arg and no flags", async () => {
      const body = { rules: [{ ruleId: "r1", effect: "Permit" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "stdin-policy" }, 201));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "create"]);
      expect(parseJsonInput).toHaveBeenCalledWith();
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/policies", { body });
    });

    it("builds body from --policy-id and --description flags", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(mockResponse({ policyId: "my-policy" }, 201));
        const program = makeProgram();
        await runCommand(program, [
          "me", "policies", "create",
          "--policy-id", "my-policy",
          "--description", "Read-only policy",
        ]);
        expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/policies", {
          body: { policyId: "my-policy", description: "Read-only policy" },
        });
        expect(printSuccess).toHaveBeenCalledWith("Policy created.");
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });
  });

  describe("policies update", () => {
    it("patches body and prints success", async () => {
      const body = { rules: [{ ruleId: "r1", effect: "Deny" }] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "p1" }));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "update", "p1", JSON.stringify(body)]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/policies/p1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Policy updated.");
    });

    it("builds body from --description flag", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(mockResponse({ policyId: "p1" }));
        const program = makeProgram();
        await runCommand(program, ["me", "policies", "update", "p1", "--description", "new desc"]);
        expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/policies/p1", {
          body: { description: "new desc" },
        });
        expect(printSuccess).toHaveBeenCalledWith("Policy updated.");
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("encodes special characters in policyId", async () => {
      const body = { description: "x" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ policyId: "urn:p:1" }));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "update", "urn:p:1", JSON.stringify(body)]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/policies/urn%3Ap%3A1", { body });
    });
  });

  describe("policies delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "delete", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/policies/p1");
      expect(printSuccess).toHaveBeenCalledWith("Policy deleted.");
    });

    it("encodes special characters in policyId", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "policies", "delete", "urn:p:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/policies/urn%3Ap%3A1");
    });
  });
});
