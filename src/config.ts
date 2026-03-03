import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { GdbConfig, GdbConfigFile } from "./types.js";

function getConfigDir(): string {
  return process.env.GEONIC_CONFIG_DIR ?? join(homedir(), ".config", "geonic");
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

function migrateV1ToV2(data: Record<string, unknown>): GdbConfigFile {
  const profile: GdbConfig = {};
  const knownKeys = [
    "url",
    "service",
    "token",
    "refreshToken",
    "format",
    "apiKey",
  ];
  for (const key of knownKeys) {
    if (key in data) {
      (profile as Record<string, unknown>)[key] = data[key];
    }
  }
  return {
    version: 2,
    currentProfile: "default",
    profiles: { default: profile },
  };
}

function isGdbConfigFile(value: unknown): value is GdbConfigFile {
  /* v8 ignore next -- loadConfigFile always passes an object with version key */
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 2 &&
    typeof v.currentProfile === "string" &&
    typeof v.profiles === "object" &&
    v.profiles !== null
  );
}

function defaultConfig(): GdbConfigFile {
  return { version: 2, currentProfile: "default", profiles: { default: {} } };
}

export function loadConfigFile(): GdbConfigFile {
  try {
    const raw = readFileSync(getConfigFile(), "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;

    if (!("version" in data)) {
      const migrated = migrateV1ToV2(data);
      saveConfigFile(migrated);
      return migrated;
    }

    if (!isGdbConfigFile(data)) {
      return defaultConfig();
    }

    return data;
  } catch {
    return defaultConfig();
  }
}

export function saveConfigFile(configFile: GdbConfigFile): void {
  ensureConfigDir();
  writeFileSync(getConfigFile(), JSON.stringify(configFile, null, 2) + "\n", "utf-8");
}

export function loadConfig(profileName?: string): GdbConfig {
  const configFile = loadConfigFile();
  const name = profileName ?? configFile.currentProfile;
  return configFile.profiles[name] ?? {};
}

export function saveConfig(config: GdbConfig, profileName?: string): void {
  const configFile = loadConfigFile();
  const name = profileName ?? configFile.currentProfile;
  configFile.profiles[name] = config;
  saveConfigFile(configFile);
}

export function getConfigValue(key: string, profileName?: string): unknown {
  const config = loadConfig(profileName);
  return config[key as keyof GdbConfig];
}

export function validateUrl(url: string): string {
  url = url.trim();
  if (!url) {
    throw new Error("URL must not be empty.");
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`Invalid URL: "${url}". URL must start with http:// or https://.`);
  }
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid URL: "${url}".`);
  }
  return url.replace(/\/+$/, "") + "/";
}

export function setConfigValue(key: string, value: string, profileName?: string): void {
  const config = loadConfig(profileName);
  if (key === "url") {
    value = validateUrl(value);
  }
  (config as Record<string, unknown>)[key] = value;
  saveConfig(config, profileName);
}

export function deleteConfigValue(key: string, profileName?: string): void {
  const config = loadConfig(profileName);
  delete (config as Record<string, unknown>)[key];
  saveConfig(config, profileName);
}

export function getConfigPath(): string {
  return getConfigFile();
}

export function listProfiles(): { name: string; active: boolean }[] {
  const configFile = loadConfigFile();
  return Object.keys(configFile.profiles).map((name) => ({
    name,
    active: name === configFile.currentProfile,
  }));
}

export function getCurrentProfile(): string {
  return loadConfigFile().currentProfile;
}

export function setCurrentProfile(name: string): void {
  const configFile = loadConfigFile();
  if (!(name in configFile.profiles)) {
    throw new Error(`Profile "${name}" does not exist.`);
  }
  configFile.currentProfile = name;
  saveConfigFile(configFile);
}

export function createProfile(name: string): void {
  const configFile = loadConfigFile();
  if (name in configFile.profiles) {
    throw new Error(`Profile "${name}" already exists.`);
  }
  configFile.profiles[name] = {};
  saveConfigFile(configFile);
}

export function deleteProfile(name: string): void {
  if (name === "default") {
    throw new Error('Cannot delete the "default" profile.');
  }
  const configFile = loadConfigFile();
  if (!(name in configFile.profiles)) {
    throw new Error(`Profile "${name}" does not exist.`);
  }
  delete configFile.profiles[name];
  if (configFile.currentProfile === name) {
    configFile.currentProfile = "default";
  }
  saveConfigFile(configFile);
}
