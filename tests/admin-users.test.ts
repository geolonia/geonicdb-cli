import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn(),
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
  // Single-request passthrough; the real page-following logic is unit-tested
  // in tests/helpers.test.ts against the unmocked implementation.
  fetchPaginatedList: async (
    client: { rawRequest: (method: string, path: string, options?: unknown) => Promise<unknown> },
    path: string,
    opts: { limit?: number; offset?: number },
    extraParams: Record<string, string> = {},
  ): Promise<unknown> => {
    const params: Record<string, string> = { ...extraParams };
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return client.rawRequest("GET", path, { params });
  },
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
  printTemporaryPasswordBox: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
  addNotes: vi.fn(),
}));

import type { Command } from "commander";
import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess, printTemporaryPasswordBox } from "../src/output.js";
import { addExamples } from "../src/commands/help.js";
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
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/users", { params: {} });
      expect(outputResponse).toHaveBeenCalled();
    });

    it("forwards --limit and --offset", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "list", "--limit", "10", "--offset", "5"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/users", {
        params: { limit: "10", offset: "5" },
      });
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

  const resetPayload = {
    userId: "u2",
    temporaryPassword: "Tmp-Passw0rd-xyz",
    expiresAt: "2026-08-04T00:00:00.000Z",
    passwordResetRequired: true,
    message: "Temporary password issued. The user must set a new password on next login.",
  };

  describe("users create (default)", () => {
    it("posts body as-is and prints success (non-breaking)", async () => {
      const body = { email: "user@example.com", password: "SecurePass12345!" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "create", '{"email":"user@example.com","password":"SecurePass12345!"}']);
      expect(client.rawRequest).toHaveBeenCalledTimes(1);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("User created.");
      expect(printTemporaryPasswordBox).not.toHaveBeenCalled();
    });
  });

  describe("users create --force-reset (invite)", () => {
    it("injects passwordResetRequired and shows the temporary password", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ email: "user@example.com", role: "user" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u2", ...resetPayload }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin", "users", "create", "--force-reset",
        '{"email":"user@example.com","role":"user"}',
      ]);

      // Single POST to /admin/users with passwordResetRequired: true and no password.
      expect(client.rawRequest).toHaveBeenCalledTimes(1);
      const [method, path, opts] = client.rawRequest.mock.calls[0];
      expect(method).toBe("POST");
      expect(path).toBe("/admin/users");
      const createBody = (opts as { body: Record<string, unknown> }).body;
      expect(createBody.passwordResetRequired).toBe(true);
      expect(createBody.password).toBeUndefined();

      expect(printSuccess).toHaveBeenCalledWith("User created (forced password reset).");
      expect(printTemporaryPasswordBox).toHaveBeenCalledWith(
        resetPayload.temporaryPassword,
        resetPayload.expiresAt,
      );
    });

    it("rejects a JSON password field before sending the request", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ email: "user@example.com", password: "ChosenPass12345!" });
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "admin", "users", "create", "--force-reset",
          '{"email":"user@example.com","password":"ChosenPass12345!"}',
        ]),
      ).rejects.toThrow(/do not include a 'password' field/);
      // No request must be sent when the input is contradictory.
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("rejects a non-object JSON payload before sending the request", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(["user@example.com"]);
      const program = makeProgram();
      await expect(
        runCommand(program, ["admin", "users", "create", "--force-reset", '["user@example.com"]']),
      ).rejects.toThrow(/must be an object/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("errors (without printing success) when the server returns no temporary password", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ email: "user@example.com", role: "user" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "u2" }, 201)); // no temporaryPassword
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "admin", "users", "create", "--force-reset",
          '{"email":"user@example.com","role":"user"}',
        ]),
      ).rejects.toThrow(/did not return a temporary password/);
      expect(printSuccess).not.toHaveBeenCalled();
      expect(printTemporaryPasswordBox).not.toHaveBeenCalled();
    });
  });

  describe("users create (metadata)", () => {

    // #118: server schema accepts only `primaryTenantId`. Help and examples must reflect that.
    it("references primaryTenantId (not legacy tenantId) in description", () => {
      const program = makeProgram();
      const createCmd = program.commands
        .find((c) => c.name() === "admin")!
        .commands.find((c) => c.name() === "users")!
        .commands.find((c) => c.name() === "create")!;
      const desc = createCmd.description();
      expect(desc).toContain('"primaryTenantId":');
      expect(desc).toContain("primaryTenantId is required");
      expect(desc).not.toContain('"tenantId":');
      expect(desc).not.toContain("tenantId is required");
    });

    it("uses primaryTenantId in registered example payloads", () => {
      makeProgram();
      const addExamplesMock = vi.mocked(addExamples);
      const createCalls = addExamplesMock.mock.calls.filter(
        ([cmd]) => (cmd as Command).name() === "create",
      );
      expect(createCalls.length).toBeGreaterThan(0);
      const examples = createCalls.flatMap(
        ([, exs]) => exs as ReadonlyArray<{ description: string; command: string }>,
      );
      const roleSpecificExamples = examples.filter(
        (e) => e.command.includes('"role":"tenant_admin"') || e.command.includes('"role":"user"'),
      );
      expect(roleSpecificExamples.length).toBeGreaterThan(0);
      for (const ex of roleSpecificExamples) {
        expect(ex.command).toContain('"primaryTenantId":');
        expect(ex.command).not.toContain('"tenantId":');
      }
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

  describe("users reset-password", () => {
    it("posts reset-password and shows the temporary password", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(resetPayload));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "reset-password", "u2"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/users/u2/reset-password");
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Temporary password issued.");
      expect(printTemporaryPasswordBox).toHaveBeenCalledWith(
        resetPayload.temporaryPassword,
        resetPayload.expiresAt,
      );
    });

    it("URL-encodes the user id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(resetPayload));
      const program = makeProgram();
      await runCommand(program, ["admin", "users", "reset-password", "urn:user:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith(
        "POST",
        "/admin/users/urn%3Auser%3A1/reset-password",
      );
    });
  });
});
