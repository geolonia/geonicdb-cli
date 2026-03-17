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

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerTenantsCommand } from "../src/commands/admin/tenants.js";

describe("admin tenants commands", () => {
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
      registerTenantsCommand(admin);
    });
  }

  describe("tenants list", () => {
    it("calls rawRequest GET /admin/tenants", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ id: "t1" }]));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("tenants get", () => {
    it("calls rawRequest GET /admin/tenants/{id}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "get", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants/t1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "urn:t:1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "get", "urn:t:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants/urn%3At%3A1");
    });
  });

  describe("tenants create", () => {
    it("posts body and prints success", async () => {
      const body = { name: "new-tenant" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "create", '{"name":"new-tenant"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Tenant created.");
    });
  });

  describe("tenants update", () => {
    it("patches body and prints success", async () => {
      const body = { name: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "update", "t1", '{"name":"updated"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Tenant updated.");
    });
  });

  describe("tenants delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "delete", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/tenants/t1");
      expect(printSuccess).toHaveBeenCalledWith("Tenant deleted.");
    });
  });

  describe("tenants activate", () => {
    it("calls POST activate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "activate", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants/t1/activate");
      expect(printSuccess).toHaveBeenCalledWith("Tenant activated.");
    });
  });

  describe("tenants deactivate", () => {
    it("calls POST deactivate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "deactivate", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants/t1/deactivate");
      expect(printSuccess).toHaveBeenCalledWith("Tenant deactivated.");
    });
  });
});
