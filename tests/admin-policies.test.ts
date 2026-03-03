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
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerPoliciesCommand } from "../src/commands/admin/policies.js";

describe("admin policies commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      const admin = prog.command("admin");
      registerPoliciesCommand(admin);
    });
  }

  describe("policies list", () => {
    it("calls rawRequest GET /admin/policies", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ id: "p1" }]));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/policies");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("policies get", () => {
    it("calls rawRequest GET /admin/policies/{id}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "p1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "get", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/policies/p1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "urn:p:1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "get", "urn:p:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/policies/urn%3Ap%3A1");
    });
  });

  describe("policies create", () => {
    it("posts body and prints success", async () => {
      const body = { name: "new-policy" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "p2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "create", '{"name":"new-policy"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/policies", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Policy created.");
    });
  });

  describe("policies update", () => {
    it("patches body and prints success", async () => {
      const body = { name: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "p1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "update", "p1", '{"name":"updated"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/policies/p1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Policy updated.");
    });
  });

  describe("policies delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "delete", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/policies/p1");
      expect(printSuccess).toHaveBeenCalledWith("Policy deleted.");
    });
  });

  describe("policies activate", () => {
    it("calls POST activate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "activate", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/policies/p1/activate");
      expect(printSuccess).toHaveBeenCalledWith("Policy activated.");
    });
  });

  describe("policies deactivate", () => {
    it("calls POST deactivate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "policies", "deactivate", "p1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/policies/p1/deactivate");
      expect(printSuccess).toHaveBeenCalledWith("Policy deactivated.");
    });
  });
});
