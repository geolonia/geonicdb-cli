import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { getConfigDir, ensureConfigDir } from "./config.js";

const PACKAGE_NAME = "@geolonia/geonicdb-cli";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const FETCH_TIMEOUT_MS = 5000;

interface UpdateCache {
  lastCheck: number;
  latestVersion?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
}

const CI_ENV_VARS = [
  "CI",
  "CONTINUOUS_INTEGRATION",
  "BUILD_NUMBER",
  "GITHUB_ACTIONS",
  "GITLAB_CI",
  "CIRCLECI",
  "JENKINS_URL",
  "HUDSON_URL",
  "TRAVIS",
];

function getCacheFile(): string {
  return join(getConfigDir(), "update-check.json");
}

function isCheckDisabled(): boolean {
  if (process.env.NO_UPDATE_NOTIFIER) return true;
  if (!process.stdout.isTTY) return true;
  for (const envVar of CI_ENV_VARS) {
    if (process.env[envVar]) return true;
  }
  return false;
}

function loadCache(): UpdateCache | null {
  try {
    const raw = readFileSync(getCacheFile(), "utf-8");
    return JSON.parse(raw) as UpdateCache;
  } catch {
    return null;
  }
}

function saveCache(cache: UpdateCache): void {
  try {
    ensureConfigDir();
    writeFileSync(getCacheFile(), JSON.stringify(cache), "utf-8");
  } catch {
    /* v8 ignore next -- defensive: write errors silently ignored */
  }
}

function shouldCheck(cache: UpdateCache | null): boolean {
  if (!cache) return true;
  return Date.now() - cache.lastCheck >= CHECK_INTERVAL_MS;
}

export function compareSemver(current: string, latest: string): boolean {
  const parse = (v: string) =>
    v.replace(/^v/, "").split(".").map(Number) as [number, number, number];
  const [cMajor, cMinor, cPatch] = parse(current);
  const [lMajor, lMinor, lPatch] = parse(latest);
  if (lMajor !== cMajor) return lMajor > cMajor;
  if (lMinor !== cMinor) return lMinor > cMinor;
  return lPatch > cPatch;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(REGISTRY_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/* v8 ignore next 3 -- fallback for bundled builds where package.json is unavailable */
function getCurrentVersion(): string {
  return process.env.npm_package_version ?? "0.0.0";
}

export function formatUpdateBox(current: string, latest: string): string {
  const message = `Update available: ${current} → ${latest}`;
  const install = `Run ${chalk.cyan(`npm i -g ${PACKAGE_NAME}`)} to update`;
  const lines = [message, install];
  const maxLen = Math.max(
    ...lines.map((l) => stripAnsi(l).length),
  );
  const pad = (line: string) => {
    const visible = stripAnsi(line).length;
    return line + " ".repeat(maxLen - visible);
  };
  const empty = " ".repeat(maxLen);
  const top = `╭${"─".repeat(maxLen + 4)}╮`;
  const bottom = `╰${"─".repeat(maxLen + 4)}╯`;
  const boxLines = [
    top,
    `│  ${empty}  │`,
    ...lines.map((l) => `│  ${pad(l)}  │`),
    `│  ${empty}  │`,
    bottom,
  ];
  return chalk.yellow(boxLines.join("\n"));
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

export async function startUpdateCheck(): Promise<UpdateCheckResult | null> {
  if (isCheckDisabled()) return null;

  let currentVersion: string;
  try {
    const pkgPath = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version: string;
    };
    currentVersion = pkg.version;
  /* v8 ignore start -- fallback for bundled builds */
  } catch {
    currentVersion = getCurrentVersion();
  }
  /* v8 ignore stop */

  const cache = loadCache();

  if (!shouldCheck(cache)) {
    if (cache?.latestVersion && compareSemver(currentVersion, cache.latestVersion)) {
      return { currentVersion, latestVersion: cache.latestVersion };
    }
    return null;
  }

  const latestVersion = await fetchLatestVersion();

  saveCache({
    lastCheck: Date.now(),
    latestVersion: latestVersion ?? cache?.latestVersion,
  });

  if (latestVersion && compareSemver(currentVersion, latestVersion)) {
    return { currentVersion, latestVersion };
  }

  return null;
}

export function printUpdateNotification(result: UpdateCheckResult | null): void {
  if (!result) return;
  const box = formatUpdateBox(result.currentVersion, result.latestVersion);
  process.stderr.write("\n" + box + "\n");
}
