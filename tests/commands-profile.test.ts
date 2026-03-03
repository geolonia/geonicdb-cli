import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTestProgram, runCommand } from "./test-helpers.js";

vi.mock("../src/config.js", () => ({
  listProfiles: vi.fn(),
  getCurrentProfile: vi.fn(),
  setCurrentProfile: vi.fn(),
  createProfile: vi.fn(),
  deleteProfile: vi.fn(),
  loadConfig: vi.fn(),
}));

vi.mock("../src/output.js", () => ({
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
}));

import {
  listProfiles,
  getCurrentProfile,
  setCurrentProfile,
  createProfile,
  deleteProfile,
  loadConfig,
} from "../src/config.js";
import { printSuccess, printInfo, printError } from "../src/output.js";
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
