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
  printApiKeyBox: vi.fn(),
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

vi.mock("../src/prompt.js", () => ({
  isInteractive: vi.fn().mockReturnValue(true),
  promptPassword: vi.fn(),
  promptEmail: vi.fn(),
  promptTenantSelection: vi.fn(),
}));

import { createClient } from "../src/helpers.js";
import { printSuccess, printError, printWarning } from "../src/output.js";
import { promptPassword, isInteractive } from "../src/prompt.js";
import { registerAuthCommands } from "../src/commands/auth.js";

describe("me password command", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(isInteractive).mockReturnValue(true);
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      registerAuthCommands(prog);
    });
  }

  describe("with flags", () => {
    it("calls POST /me/password with provided passwords", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, [
        "me", "password",
        "--current-password", "oldpass123456",
        "--new-password", "newpass123456",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/password", {
        body: { currentPassword: "oldpass123456", newPassword: "newpass123456" },
      });
      expect(printSuccess).toHaveBeenCalledWith("Password changed.");
      expect(printWarning).toHaveBeenCalledWith(
        "All existing tokens have been invalidated. Please log in again.",
      );
    });
  });

  describe("interactive mode", () => {
    it("prompts for current and new password with confirmation", async () => {
      vi.mocked(promptPassword)
        .mockResolvedValueOnce("oldpass123456")  // current
        .mockResolvedValueOnce("newpass123456")  // new
        .mockResolvedValueOnce("newpass123456"); // confirm
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));

      const program = makeProgram();
      await runCommand(program, ["me", "password"]);

      expect(promptPassword).toHaveBeenCalledWith("Current password");
      expect(promptPassword).toHaveBeenCalledWith("New password");
      expect(promptPassword).toHaveBeenCalledWith("Confirm new password");
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/password", {
        body: { currentPassword: "oldpass123456", newPassword: "newpass123456" },
      });
      expect(printSuccess).toHaveBeenCalledWith("Password changed.");
    });

    it("exits with error when confirmation does not match", async () => {
      vi.mocked(promptPassword)
        .mockResolvedValueOnce("oldpass123456")
        .mockResolvedValueOnce("newpass123456")
        .mockResolvedValueOnce("different12345");

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      const program = makeProgram();
      await expect(runCommand(program, ["me", "password"])).rejects.toThrow("process.exit");

      expect(printError).toHaveBeenCalledWith("Passwords do not match.");
      expect(client.rawRequest).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });

  describe("non-interactive mode", () => {
    it("exits with error when no flags and not interactive", async () => {
      vi.mocked(isInteractive).mockReturnValue(false);

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      const program = makeProgram();
      await expect(runCommand(program, ["me", "password"])).rejects.toThrow("process.exit");

      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("Interactive terminal required"),
      );
      expect(client.rawRequest).not.toHaveBeenCalled();

      exitSpy.mockRestore();
    });
  });
});
