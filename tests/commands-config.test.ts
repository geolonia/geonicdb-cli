import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestProgram, runCommand } from "./test-helpers.js";

vi.mock("../src/config.js", () => ({
  loadConfig: vi.fn(),
  getConfigValue: vi.fn(),
  setConfigValue: vi.fn(),
  deleteConfigValue: vi.fn(),
  getConfigPath: vi.fn(() => "/fake/path/config.json"),
}));

vi.mock("../src/output.js", () => ({
  printOutput: vi.fn(),
  printSuccess: vi.fn(),
  printInfo: vi.fn(),
  printError: vi.fn(),
  printWarning: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
}));

import {
  loadConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
} from "../src/config.js";
import { printOutput, printSuccess, printInfo } from "../src/output.js";
import { registerConfigCommand } from "../src/commands/config.js";

describe("config commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeProgram() {
    return createTestProgram((prog) => registerConfigCommand(prog));
  }

  describe("config set", () => {
    it("sets a config value and prints success", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "set", "url", "http://example.com"]);
      expect(setConfigValue).toHaveBeenCalledWith("url", "http://example.com", undefined);
      expect(printSuccess).toHaveBeenCalledWith("Set url = http://example.com");
    });

    it("masks sensitive keys (token)", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "set", "token", "secret123"]);
      expect(setConfigValue).toHaveBeenCalledWith("token", "secret123", undefined);
      expect(printSuccess).toHaveBeenCalledWith("Set token = ***");
    });

    it("masks sensitive keys (refreshToken)", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "set", "refreshToken", "refresh-secret"]);
      expect(printSuccess).toHaveBeenCalledWith("Set refreshToken = ***");
    });

    it("masks sensitive keys (apiKey)", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "set", "apiKey", "my-api-key"]);
      expect(printSuccess).toHaveBeenCalledWith("Set apiKey = ***");
    });

    it("uses profile from global option", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "set", "url", "http://staging.com", "--profile", "staging"]);
      expect(setConfigValue).toHaveBeenCalledWith("url", "http://staging.com", "staging");
    });
  });

  describe("config get", () => {
    it("prints value when key exists", async () => {
      vi.mocked(getConfigValue).mockReturnValue("http://example.com");
      const program = makeProgram();
      await runCommand(program, ["config", "get", "url"]);
      expect(getConfigValue).toHaveBeenCalledWith("url", undefined);
      expect(printOutput).toHaveBeenCalledWith("http://example.com", "json");
    });

    it("prints info when key is not set", async () => {
      vi.mocked(getConfigValue).mockReturnValue(undefined);
      const program = makeProgram();
      await runCommand(program, ["config", "get", "url"]);
      expect(printInfo).toHaveBeenCalledWith('Key "url" is not set.');
    });

    it("uses profile from global option", async () => {
      vi.mocked(getConfigValue).mockReturnValue("http://staging.com");
      const program = makeProgram();
      await runCommand(program, ["config", "get", "url", "--profile", "staging"]);
      expect(getConfigValue).toHaveBeenCalledWith("url", "staging");
    });
  });

  describe("config list", () => {
    it("prints all config values when config is not empty", async () => {
      vi.mocked(loadConfig).mockReturnValue({ url: "http://example.com", service: "tenant-a" } as never);
      const program = makeProgram();
      await runCommand(program, ["config", "list"]);
      expect(loadConfig).toHaveBeenCalledWith(undefined);
      expect(printOutput).toHaveBeenCalledWith(
        { url: "http://example.com", service: "tenant-a" },
        "json",
      );
    });

    it("prints info with config path when config is empty", async () => {
      vi.mocked(loadConfig).mockReturnValue({} as never);
      const program = makeProgram();
      await runCommand(program, ["config", "list"]);
      expect(printInfo).toHaveBeenCalledWith(
        "No configuration set. Config path: /fake/path/config.json",
      );
    });

    it("uses profile from global option", async () => {
      vi.mocked(loadConfig).mockReturnValue({} as never);
      const program = makeProgram();
      await runCommand(program, ["config", "list", "--profile", "staging"]);
      expect(loadConfig).toHaveBeenCalledWith("staging");
    });
  });

  describe("config delete", () => {
    it("deletes config value and prints success", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "delete", "url"]);
      expect(deleteConfigValue).toHaveBeenCalledWith("url", undefined);
      expect(printSuccess).toHaveBeenCalledWith('Deleted key "url".');
    });

    it("uses profile from global option", async () => {
      const program = makeProgram();
      await runCommand(program, ["config", "delete", "url", "--profile", "staging"]);
      expect(deleteConfigValue).toHaveBeenCalledWith("url", "staging");
    });
  });
});
