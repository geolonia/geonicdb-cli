import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GdbConfig } from "./types.js";

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

export function loadConfig(): GdbConfig {
  try {
    const data = readFileSync(getConfigFile(), "utf-8");
    return JSON.parse(data) as GdbConfig;
  } catch {
    return {};
  }
}

export function saveConfig(config: GdbConfig): void {
  ensureConfigDir();
  writeFileSync(getConfigFile(), JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function getConfigValue(key: string): unknown {
  const config = loadConfig();
  return config[key as keyof GdbConfig];
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();
  (config as Record<string, unknown>)[key] = value;
  saveConfig(config);
}

export function deleteConfigValue(key: string): void {
  const config = loadConfig();
  delete (config as Record<string, unknown>)[key];
  saveConfig(config);
}

export function getConfigPath(): string {
  return getConfigFile();
}
