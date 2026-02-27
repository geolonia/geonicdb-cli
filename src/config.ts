import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GdbConfig, GdbConfigV2 } from "./types.js";

function getConfigDir(): string {
  return process.env.GDB_CONFIG_DIR ?? join(homedir(), ".config", "gdb");
}

function getConfigFile(): string {
  return join(getConfigDir(), "config.json");
}

function ensureConfigDir(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readRaw(): Record<string, unknown> {
  try {
    const data = readFileSync(getConfigFile(), "utf-8");
    return JSON.parse(data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function isV2(raw: Record<string, unknown>): boolean {
  return "profiles" in raw && typeof raw.profiles === "object" && raw.profiles !== null;
}

function toV2(raw: Record<string, unknown>): GdbConfigV2 {
  if (isV2(raw)) {
    const v2 = raw as unknown as GdbConfigV2;
    v2.activeProfile = v2.activeProfile ?? "default";
    return v2;
  }
  const config = { ...raw } as GdbConfig;
  return {
    version: 2,
    activeProfile: "default",
    profiles: { default: config },
  };
}

export function loadFullConfig(): GdbConfigV2 {
  return toV2(readRaw());
}

export function saveFullConfig(config: GdbConfigV2): void {
  ensureConfigDir();
  config.version = 2;
  writeFileSync(getConfigFile(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function loadConfig(profile?: string): GdbConfig {
  const raw = readRaw();
  if (profile) {
    const full = toV2(raw);
    return full.profiles[profile] ?? {};
  }
  if (isV2(raw)) {
    const full = raw as unknown as GdbConfigV2;
    return full.profiles[full.activeProfile ?? "default"] ?? {};
  }
  return raw as GdbConfig;
}

export function saveConfig(config: GdbConfig, profile?: string): void {
  if (profile) {
    const full = loadFullConfig();
    full.profiles[profile] = config;
    saveFullConfig(full);
  } else {
    const raw = readRaw();
    if (isV2(raw)) {
      const full = raw as unknown as GdbConfigV2;
      full.profiles[full.activeProfile ?? "default"] = config;
      saveFullConfig(full);
    } else {
      ensureConfigDir();
      writeFileSync(getConfigFile(), JSON.stringify(config, null, 2) + "\n", "utf-8");
    }
  }
}

export function getConfigValue(key: string, profile?: string): unknown {
  const config = loadConfig(profile);
  return config[key as keyof GdbConfig];
}

export function setConfigValue(key: string, value: string, profile?: string): void {
  const config = loadConfig(profile);
  (config as Record<string, unknown>)[key] = value;
  saveConfig(config, profile);
}

export function deleteConfigValue(key: string, profile?: string): void {
  const config = loadConfig(profile);
  delete (config as Record<string, unknown>)[key];
  saveConfig(config, profile);
}

export function getConfigPath(): string {
  return getConfigFile();
}
