import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  SCOPES_HELP_NOTES: [],
  API_KEY_SCOPES_HELP_NOTES: [],
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
import { registerUsersCommand } from "../src/commands/admin/users.js";

describe("admin users commands", () => {
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
      registerUsersCommand(admin);
    });
  }

  describe("users list", () => {
    it("calls rawRequest GET /admin/users", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ id: "u1" }]));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/users");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("users get", () => {
    it("calls rawRequest GET /admin/users/{id}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "get", "u1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/users/u1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "urn:u:1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "get", "urn:u:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/users/urn%3Au%3A1");
    });
  });

  describe("users create", () => {
    it("posts body and prints success", async () => {
      const body = { email: "user@example.com" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "create", '{"email":"user@example.com"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("User created.");
    });
  });

  describe("users update", () => {
    it("patches body and prints success", async () => {
      const body = { name: "Updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "update", "u1", '{"name":"Updated"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/users/u1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("User updated.");
    });
  });

  describe("users delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "delete", "u1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/users/u1");
      expect(printSuccess).toHaveBeenCalledWith("User deleted.");
    });
  });

  describe("users activate", () => {
    it("calls POST activate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "activate", "u1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users/u1/activate");
      expect(printSuccess).toHaveBeenCalledWith("User activated.");
    });
  });

  describe("users deactivate", () => {
    it("calls POST deactivate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "deactivate", "u1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users/u1/deactivate");
      expect(printSuccess).toHaveBeenCalledWith("User deactivated.");
    });
  });

  describe("users unlock", () => {
    it("calls POST unlock and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "unlock", "u1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users/u1/unlock");
      expect(printSuccess).toHaveBeenCalledWith("User unlocked.");
    });
  });
});
