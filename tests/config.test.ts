import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  saveConfig,
  loadConfigFile,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  listProfiles,
  getCurrentProfile,
  setCurrentProfile,
  createProfile,
  deleteProfile,
} from "../src/config.js";

describe("config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "gdb-test-"));
    process.env.GDB_CONFIG_DIR = join(tempDir, "gdb");
  });

  afterEach(() => {
    delete process.env.GDB_CONFIG_DIR;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty config when no file exists", () => {
    const config = loadConfig();
    expect(config).toEqual({});
  });

  it("saves and loads config", () => {
    saveConfig({ url: "http://localhost:3000", api: "v2" });
    const config = loadConfig();
    expect(config.url).toBe("http://localhost:3000");
    expect(config.api).toBe("v2");
  });

  it("sets individual config values", () => {
    setConfigValue("url", "http://example.com");
    expect(getConfigValue("url")).toBe("http://example.com");
  });

  it("deletes config values", () => {
    setConfigValue("url", "http://example.com");
    deleteConfigValue("url");
    expect(getConfigValue("url")).toBeUndefined();
  });

  it("writes valid v2 JSON to disk", () => {
    setConfigValue("service", "myTenant");
    const configPath = join(tempDir, "gdb", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(2);
    expect(parsed.profiles.default.service).toBe("myTenant");
  });

  describe("v1 to v2 migration", () => {
    it("migrates flat config to profiles format", () => {
      const configDir = join(tempDir, "gdb");
      mkdirSync(configDir, { recursive: true });
      const v1Config = {
        url: "http://localhost:1026",
        service: "myTenant",
        api: "v2",
        token: "old-token",
        refreshToken: "old-refresh",
        format: "json",
      };
      writeFileSync(join(configDir, "config.json"), JSON.stringify(v1Config), "utf-8");

      const config = loadConfig();
      expect(config.url).toBe("http://localhost:1026");
      expect(config.service).toBe("myTenant");
      expect(config.token).toBe("old-token");
      expect(config.refreshToken).toBe("old-refresh");

      // Verify file was rewritten in v2 format
      const raw = readFileSync(join(configDir, "config.json"), "utf-8");
      const parsed = JSON.parse(raw);
      expect(parsed.version).toBe(2);
      expect(parsed.currentProfile).toBe("default");
      expect(parsed.profiles.default.url).toBe("http://localhost:1026");
    });

    it("preserves unknown fields during migration by ignoring them", () => {
      const configDir = join(tempDir, "gdb");
      mkdirSync(configDir, { recursive: true });
      writeFileSync(
        join(configDir, "config.json"),
        JSON.stringify({ url: "http://localhost:1026", unknownField: "value" }),
        "utf-8",
      );

      const configFile = loadConfigFile();
      expect(configFile.profiles.default.url).toBe("http://localhost:1026");
      expect((configFile.profiles.default as Record<string, unknown>).unknownField).toBeUndefined();
    });
  });

  describe("profile management", () => {
    it("lists profiles with active marker", () => {
      const profiles = listProfiles();
      expect(profiles).toEqual([{ name: "default", active: true }]);
    });

    it("creates a new profile", () => {
      createProfile("staging");
      const profiles = listProfiles();
      expect(profiles).toHaveLength(2);
      expect(profiles.find((p) => p.name === "staging")).toBeDefined();
    });

    it("throws when creating duplicate profile", () => {
      createProfile("staging");
      expect(() => createProfile("staging")).toThrow('Profile "staging" already exists.');
    });

    it("switches active profile", () => {
      createProfile("production");
      setCurrentProfile("production");
      expect(getCurrentProfile()).toBe("production");
    });

    it("throws when switching to non-existent profile", () => {
      expect(() => setCurrentProfile("nonexistent")).toThrow(
        'Profile "nonexistent" does not exist.',
      );
    });

    it("deletes a profile", () => {
      createProfile("staging");
      deleteProfile("staging");
      const profiles = listProfiles();
      expect(profiles).toHaveLength(1);
    });

    it("cannot delete default profile", () => {
      expect(() => deleteProfile("default")).toThrow('Cannot delete the "default" profile.');
    });

    it("resets to default when deleting active profile", () => {
      createProfile("staging");
      setCurrentProfile("staging");
      deleteProfile("staging");
      expect(getCurrentProfile()).toBe("default");
    });

    it("saves and loads config per profile", () => {
      createProfile("staging");
      saveConfig({ url: "http://staging.example.com" }, "staging");
      saveConfig({ url: "http://default.example.com" });

      expect(loadConfig().url).toBe("http://default.example.com");
      expect(loadConfig("staging").url).toBe("http://staging.example.com");
    });

    it("sets config values per profile", () => {
      createProfile("staging");
      setConfigValue("url", "http://staging.example.com", "staging");
      expect(getConfigValue("url", "staging")).toBe("http://staging.example.com");
      expect(getConfigValue("url")).toBeUndefined();
    });
  });
});
