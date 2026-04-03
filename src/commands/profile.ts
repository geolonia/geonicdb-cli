import { Command } from "commander";
import {
  listProfiles,
  getCurrentProfile,
  setCurrentProfile,
  createProfile,
  deleteProfile,
  loadConfig,
  saveConfig,
  validateUrl,
} from "../config.js";
import { printSuccess, printInfo, printError, printWarning } from "../output.js";
import { getTokenStatus } from "../token.js";
import { addExamples } from "./help.js";

export function registerProfileCommands(program: Command): void {
  const profile = program.command("profile").description("Manage connection profiles");

  const list = profile
    .command("list")
    .description("List all profiles")
    .action(() => {
      const profiles = listProfiles();
      for (const p of profiles) {
        const marker = p.active ? " *" : "";
        console.log(`${p.name}${marker}`);
      }
    });

  addExamples(list, [
    {
      description: "List all profiles (active profile marked with *)",
      command: "geonic profile list",
    },
  ]);

  const use = profile
    .command("use <name>")
    .description("Switch active profile (auto-refreshes expired tokens)")
    .action(async (name: string) => {
      try {
        setCurrentProfile(name);
      } catch (err) {
        printError((err as Error).message);
        process.exit(1);
      }

      const config = loadConfig(name);
      const tenantLabel = config.tenantId
        ? ` (tenant: ${config.availableTenants?.find((t) => t.tenantId === config.tenantId)?.name ?? config.tenantId})`
        : "";

      // Auto-refresh expired token if refreshToken is available
      if (config.token && config.refreshToken && config.url) {
        const status = getTokenStatus(config.token);
        if (status.isExpired || status.isExpiringSoon) {
          try {
            const baseUrl = validateUrl(config.url);
            const url = new URL("/auth/refresh", baseUrl).toString();
            const response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken: config.refreshToken }),
            });
            if (response.ok) {
              const data = (await response.json()) as Record<string, unknown>;
              const newToken = (data.accessToken ?? data.token) as string | undefined;
              const newRefreshToken = data.refreshToken as string | undefined;
              if (newToken) {
                config.token = newToken;
                if (newRefreshToken) config.refreshToken = newRefreshToken;
                saveConfig(config, name);
                printSuccess(`Switched to profile "${name}"${tenantLabel}. Token refreshed.`);
                return;
              }
            }
            printWarning("Token refresh failed. You may need to re-login.");
          } catch {
            printWarning("Token refresh failed. You may need to re-login.");
          }
        }
      }

      printSuccess(`Switched to profile "${name}"${tenantLabel}.`);
    });

  addExamples(use, [
    {
      description: "Switch to staging profile",
      command: "geonic profile use staging",
    },
  ]);

  const profileCreate = profile
    .command("create <name>")
    .description("Create a new profile")
    .action((name: string) => {
      try {
        createProfile(name);
        printSuccess(`Profile "${name}" created.`);
      } catch (err) {
        printError((err as Error).message);
        process.exit(1);
      }
    });

  addExamples(profileCreate, [
    {
      description: "Create a new profile for staging",
      command: "geonic profile create staging",
    },
  ]);

  const del = profile
    .command("delete <name>")
    .description("Delete a profile")
    .action((name: string) => {
      try {
        deleteProfile(name);
        printSuccess(`Profile "${name}" deleted.`);
      } catch (err) {
        printError((err as Error).message);
        process.exit(1);
      }
    });

  addExamples(del, [
    {
      description: "Delete a profile",
      command: "geonic profile delete staging",
    },
  ]);

  const show = profile
    .command("show [name]")
    .description("Show profile settings")
    .action((name?: string) => {
      const profileName = name ?? getCurrentProfile();
      const config = loadConfig(profileName);
      const entries = Object.entries(config).filter(([, v]) => v !== undefined);
      if (entries.length === 0) {
        printInfo(`Profile "${profileName}" has no settings.`);
        return;
      }
      for (const [key, value] of entries) {
        if (
          (key === "token" || key === "refreshToken" || key === "apiKey") &&
          typeof value === "string"
        ) {
          console.log(`${key}: ***`);
        } else if (key === "availableTenants" && Array.isArray(value)) {
          console.log(`${key}:`);
          for (const t of value as { tenantId: string; name?: string; role: string }[]) {
            const label = t.name ? `${t.name} (${t.tenantId})` : t.tenantId;
            const current = t.tenantId === config.tenantId ? " ← current" : "";
            console.log(`  - ${label} [${t.role}]${current}`);
          }
        } else {
          console.log(`${key}: ${value}`);
        }
      }
    });

  addExamples(show, [
    {
      description: "Show current profile settings",
      command: "geonic profile show",
    },
    {
      description: "Show settings for a specific profile",
      command: "geonic profile show production",
    },
  ]);
}
