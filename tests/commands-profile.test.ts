import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestProgram, runCommand } from "./test-helpers.js";

vi.mock("../src/config.js", () => ({
  listProfiles: vi.fn(),
  getCurrentProfile: vi.fn(),
  setCurrentProfile: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  loadConfig: vi.fn(() => ({})),
  saveConfig: vi.fn(),
  validateUrl: vi.fn((url: string) => url.replace(/\/+$/, "") + "/"),
}));

vi.mock("../src/output.js", () => ({
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/token.js", () => ({
  getTokenStatus: vi.fn(() => ({
    expiresAt: undefined,
    isExpired: false,
    isExpiringSoon: false,
    remainingMs: undefined,
  })),
  formatDuration: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
  addNotes: vi.fn(),
}));

import {
  listProfiles,
  getCurrentProfile,
  setCurrentProfile,
  createProfile,
  deleteProfile,
  loadConfig,
  saveConfig,
} from "../src/config.js";
import { printSuccess, printInfo, printError, printWarning } from "../src/output.js";
import { getTokenStatus } from "../src/token.js";
import { registerProfileCommands } from "../src/commands/profile.js";

describe("profile commands", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  function makeProgram() {
    return createTestProgram((prog) => registerProfileCommands(prog));
  }

  describe("profile list", () => {
    it("lists profiles with active marker", async () => {
      vi.mocked(listProfiles).mockReturnValue([
        { name: "default", active: true },
        { name: "staging", active: false },
      ] as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "list"]);
      expect(consoleSpy).toHaveBeenCalledWith("default *");
      expect(consoleSpy).toHaveBeenCalledWith("staging");
    });
  });

  describe("profile use", () => {
    it("switches to a profile", async () => {
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(setCurrentProfile).toHaveBeenCalledWith("staging");
      expect(printSuccess).toHaveBeenCalledWith('Switched to profile "staging".');
    });

    it("shows tenant label when profile has tenantId", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        tenantId: "city_a",
        availableTenants: [
          { tenantId: "city_a", name: "Smart City A", role: "tenant_admin" },
        ],
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(printSuccess).toHaveBeenCalledWith(
        'Switched to profile "staging" (tenant: Smart City A).',
      );
    });

    it("shows tenantId when no name available", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        tenantId: "city_a",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(printSuccess).toHaveBeenCalledWith(
        'Switched to profile "staging" (tenant: city_a).',
      );
    });

    it("auto-refreshes expired token on profile switch", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
        tenantId: "city_a",
      } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2020-01-01"),
        isExpired: true,
        isExpiringSoon: false,
        remainingMs: 0,
      } as never);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({ accessToken: "new-token", refreshToken: "new-refresh" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/auth/refresh"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "new-token", refreshToken: "new-refresh" }),
        "staging",
      );
      expect(printSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Token refreshed"),
      );
      fetchSpy.mockRestore();
    });

    it("warns when token refresh fails", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "bad-refresh",
      } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2020-01-01"),
        isExpired: true,
        isExpiringSoon: false,
        remainingMs: 0,
      } as never);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unauthorized", { status: 401 }),
      );
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(printWarning).toHaveBeenCalledWith(
        expect.stringContaining("Token refresh failed"),
      );
      fetchSpy.mockRestore();
    });

    it("skips refresh when token is not expired", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://localhost:3000",
        token: "valid-token",
        refreshToken: "refresh",
      } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2030-01-01"),
        isExpired: false,
        isExpiringSoon: false,
        remainingMs: 86400000,
      } as never);
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const program = makeProgram();
      await runCommand(program, ["profile", "use", "staging"]);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith('Switched to profile "staging".');
      fetchSpy.mockRestore();
    });

    it("prints error and exits when profile does not exist", async () => {
      vi.mocked(setCurrentProfile).mockImplementation(() => {
        throw new Error("Profile not found");
      });
      const program = makeProgram();
      await expect(
        runCommand(program, ["profile", "use", "nonexistent"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("Profile not found");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("profile create", () => {
    it("creates a new profile", async () => {
      const program = makeProgram();
      await runCommand(program, ["profile", "create", "staging"]);
      expect(createProfile).toHaveBeenCalledWith("staging");
      expect(printSuccess).toHaveBeenCalledWith('Profile "staging" created.');
    });

    it("prints error and exits when profile already exists", async () => {
      vi.mocked(createProfile).mockImplementation(() => {
        throw new Error("Profile already exists");
      });
      const program = makeProgram();
      await expect(
        runCommand(program, ["profile", "create", "existing"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("Profile already exists");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("profile delete", () => {
    it("deletes a profile", async () => {
      const program = makeProgram();
      await runCommand(program, ["profile", "delete", "staging"]);
      expect(deleteProfile).toHaveBeenCalledWith("staging");
      expect(printSuccess).toHaveBeenCalledWith('Profile "staging" deleted.');
    });

    it("prints error and exits when cannot delete", async () => {
      vi.mocked(deleteProfile).mockImplementation(() => {
        throw new Error("Cannot delete default profile");
      });
      const program = makeProgram();
      await expect(
        runCommand(program, ["profile", "delete", "default"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("Cannot delete default profile");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe("profile show", () => {
    it("shows current profile settings when no name given", async () => {
      vi.mocked(getCurrentProfile).mockReturnValue("default");
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://example.com",
        service: "my-tenant",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show"]);
      expect(getCurrentProfile).toHaveBeenCalled();
      expect(loadConfig).toHaveBeenCalledWith("default");
      expect(consoleSpy).toHaveBeenCalledWith("url: http://example.com");
      expect(consoleSpy).toHaveBeenCalledWith("service: my-tenant");
    });

    it("shows specified profile settings", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://production.example.com",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show", "production"]);
      expect(loadConfig).toHaveBeenCalledWith("production");
      expect(consoleSpy).toHaveBeenCalledWith("url: http://production.example.com");
    });

    it("prints info when profile has no settings", async () => {
      vi.mocked(getCurrentProfile).mockReturnValue("default");
      vi.mocked(loadConfig).mockReturnValue({} as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show"]);
      expect(printInfo).toHaveBeenCalledWith('Profile "default" has no settings.');
    });

    it("masks sensitive keys (token, refreshToken, apiKey)", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://example.com",
        token: "secret-token",
        refreshToken: "secret-refresh",
        apiKey: "secret-api-key",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show", "production"]);
      expect(consoleSpy).toHaveBeenCalledWith("url: http://example.com");
      expect(consoleSpy).toHaveBeenCalledWith("token: ***");
      expect(consoleSpy).toHaveBeenCalledWith("refreshToken: ***");
      expect(consoleSpy).toHaveBeenCalledWith("apiKey: ***");
    });

    it("shows availableTenants with current marker", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://example.com",
        tenantId: "city_a",
        availableTenants: [
          { tenantId: "city_a", name: "Smart City A", role: "tenant_admin" },
          { tenantId: "city_b", role: "user" },
        ],
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show", "test"]);
      expect(consoleSpy).toHaveBeenCalledWith("availableTenants:");
      expect(consoleSpy).toHaveBeenCalledWith("  - Smart City A (city_a) [tenant_admin] ← current");
      expect(consoleSpy).toHaveBeenCalledWith("  - city_b [user]");
    });

    it("filters out undefined values", async () => {
      vi.mocked(loadConfig).mockReturnValue({
        url: "http://example.com",
        service: undefined,
      } as never);
      const program = makeProgram();
      await runCommand(program, ["profile", "show", "test"]);
      expect(consoleSpy).toHaveBeenCalledWith("url: http://example.com");
      expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("service"));
    });
  });
});
