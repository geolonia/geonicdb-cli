import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
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

  it("writes valid JSON to disk", () => {
    setConfigValue("service", "myTenant");
    const configPath = join(tempDir, "gdb", "config.json");
    const raw = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.service).toBe("myTenant");
  });
});
