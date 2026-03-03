import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Mock fetch globally before importing module
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

let tempDir: string;

// Save/restore env and stdout.isTTY across tests
const envBackup: Record<string, string | undefined> = {};
const envKeys = [
  "GEONIC_CONFIG_DIR",
  "NO_UPDATE_NOTIFIER",
  "CI",
  "CONTINUOUS_INTEGRATION",
  "BUILD_NUMBER",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "JENKINS_URL",
  "HUDSON_URL",
  "TRAVIS",
  "npm_package_version",
];
let originalIsTTY: boolean | undefined;

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "geonic-update-test-"));
  for (const key of envKeys) {
    envBackup[key] = process.env[key];
    delete process.env[key];
  }
  process.env.GEONIC_CONFIG_DIR = join(tempDir, "geonic");
  originalIsTTY = process.stdout.isTTY;
  Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true, configurable: true });
  mockFetch.mockReset();
});

afterEach(() => {
  for (const key of envKeys) {
    if (envBackup[key] !== undefined) {
      process.env[key] = envBackup[key];
    } else {
      delete process.env[key];
    }
  }
  Object.defineProperty(process.stdout, "isTTY", { value: originalIsTTY, writable: true, configurable: true });
  rmSync(tempDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("compareSemver", () => {
  let compareSemver: typeof import("../src/update-notifier.js").compareSemver;

  beforeEach(async () => {
    ({ compareSemver } = await import("../src/update-notifier.js"));
  });

  it("detects major upgrade", () => {
    expect(compareSemver("1.0.0", "2.0.0")).toBe(true);
  });

  it("detects minor upgrade", () => {
    expect(compareSemver("1.0.0", "1.1.0")).toBe(true);
  });

  it("detects patch upgrade", () => {
    expect(compareSemver("1.0.0", "1.0.1")).toBe(true);
  });

  it("returns false for equal versions", () => {
    expect(compareSemver("1.2.3", "1.2.3")).toBe(false);
  });

  it("returns false for downgrade", () => {
    expect(compareSemver("2.0.0", "1.0.0")).toBe(false);
    expect(compareSemver("1.1.0", "1.0.0")).toBe(false);
    expect(compareSemver("1.0.1", "1.0.0")).toBe(false);
  });

  it("handles v-prefix", () => {
    expect(compareSemver("v1.0.0", "v2.0.0")).toBe(true);
    expect(compareSemver("v1.0.0", "1.0.0")).toBe(false);
  });
});

describe("formatUpdateBox", () => {
  let formatUpdateBox: typeof import("../src/update-notifier.js").formatUpdateBox;

  beforeEach(async () => {
    ({ formatUpdateBox } = await import("../src/update-notifier.js"));
  });

  it("produces a box with version info", () => {
    const box = formatUpdateBox("0.1.0", "1.0.0");
    expect(box).toContain("0.1.0");
    expect(box).toContain("1.0.0");
    expect(box).toContain("Update available");
    expect(box).toContain("npm i -g @geolonia/geonicdb-cli");
    expect(box).toContain("╭");
    expect(box).toContain("╰");
  });
});

describe("startUpdateCheck", () => {
  let startUpdateCheck: typeof import("../src/update-notifier.js").startUpdateCheck;

  beforeEach(async () => {
    ({ startUpdateCheck } = await import("../src/update-notifier.js"));
  });

  it("returns null when NO_UPDATE_NOTIFIER is set", async () => {
    process.env.NO_UPDATE_NOTIFIER = "1";
    const result = await startUpdateCheck();
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null when CI is set", async () => {
    process.env.CI = "true";
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("returns null when GITHUB_ACTIONS is set", async () => {
    process.env.GITHUB_ACTIONS = "true";
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("returns null when not a TTY", async () => {
    Object.defineProperty(process.stdout, "isTTY", { value: undefined, writable: true, configurable: true });
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("fetches from registry when no cache exists", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    });
    const result = await startUpdateCheck();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe("99.0.0");
  });

  it("skips fetch when cache is fresh", async () => {
    const cacheDir = join(tempDir, "geonic");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(
      join(cacheDir, "update-check.json"),
      JSON.stringify({ lastCheck: Date.now(), latestVersion: "0.0.1" }),
      "utf-8",
    );
    const result = await startUpdateCheck();
    expect(mockFetch).not.toHaveBeenCalled();
    // Current version (from package.json) should not be older than 0.0.1
    expect(result).toBeNull();
  });

  it("returns cached result when cache is fresh and update available", async () => {
    const cacheDir = join(tempDir, "geonic");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(
      join(cacheDir, "update-check.json"),
      JSON.stringify({ lastCheck: Date.now(), latestVersion: "99.0.0" }),
      "utf-8",
    );
    const result = await startUpdateCheck();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe("99.0.0");
  });

  it("fetches when cache is stale", async () => {
    const cacheDir = join(tempDir, "geonic");
    mkdirSync(cacheDir, { recursive: true });
    const staleTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    writeFileSync(
      join(cacheDir, "update-check.json"),
      JSON.stringify({ lastCheck: staleTime }),
      "utf-8",
    );
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    });
    const result = await startUpdateCheck();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });

  it("returns null when fetch fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("returns null when registry returns non-ok response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("returns null when current version is up to date", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "0.0.1" }),
    });
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("saves cache after fetch", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    });
    await startUpdateCheck();
    const cacheFile = join(tempDir, "geonic", "update-check.json");
    const cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
    expect(cache.latestVersion).toBe("99.0.0");
    expect(cache.lastCheck).toBeGreaterThan(0);
  });

  it("saves cache even when fetch fails (updates lastCheck)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("timeout"));
    await startUpdateCheck();
    const cacheFile = join(tempDir, "geonic", "update-check.json");
    const cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
    expect(cache.lastCheck).toBeGreaterThan(0);
  });

  it("returns null when registry response has no version field", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const result = await startUpdateCheck();
    expect(result).toBeNull();
  });

  it("handles corrupted cache file", async () => {
    const cacheDir = join(tempDir, "geonic");
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(join(cacheDir, "update-check.json"), "not json", "utf-8");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: "99.0.0" }),
    });
    const result = await startUpdateCheck();
    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe("99.0.0");
  });

  it("preserves latestVersion from previous cache on fetch failure", async () => {
    const cacheDir = join(tempDir, "geonic");
    mkdirSync(cacheDir, { recursive: true });
    const staleTime = Date.now() - 25 * 60 * 60 * 1000;
    writeFileSync(
      join(cacheDir, "update-check.json"),
      JSON.stringify({ lastCheck: staleTime, latestVersion: "50.0.0" }),
      "utf-8",
    );
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    await startUpdateCheck();
    const cacheFile = join(cacheDir, "update-check.json");
    const cache = JSON.parse(readFileSync(cacheFile, "utf-8"));
    expect(cache.latestVersion).toBe("50.0.0");
  });
});

describe("printUpdateNotification", () => {
  let printUpdateNotification: typeof import("../src/update-notifier.js").printUpdateNotification;

  beforeEach(async () => {
    ({ printUpdateNotification } = await import("../src/update-notifier.js"));
  });

  it("writes box to stderr when result is provided", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    printUpdateNotification({ currentVersion: "0.1.0", latestVersion: "1.0.0" });
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const output = writeSpy.mock.calls[0][0] as string;
    expect(output).toContain("0.1.0");
    expect(output).toContain("1.0.0");
  });

  it("does nothing when result is null", () => {
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    printUpdateNotification(null);
    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe("CI environment variables", () => {
  let startUpdateCheck: typeof import("../src/update-notifier.js").startUpdateCheck;

  beforeEach(async () => {
    ({ startUpdateCheck } = await import("../src/update-notifier.js"));
  });

  const ciVars = [
    "CONTINUOUS_INTEGRATION",
    "BUILD_NUMBER",
    "GITLAB_CI",
    "CIRCLECI",
    "JENKINS_URL",
    "HUDSON_URL",
    "TRAVIS",
  ];

  for (const envVar of ciVars) {
    it(`returns null when ${envVar} is set`, async () => {
      process.env[envVar] = "true";
      const result = await startUpdateCheck();
      expect(result).toBeNull();
    });
  }
});
