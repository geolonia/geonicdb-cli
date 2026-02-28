import { Command } from "commander";
import {
  listProfiles,
  getCurrentProfile,
  setCurrentProfile,
  createProfile,
  deleteProfile,
  loadConfig,
} from "../config.js";
import { printSuccess, printInfo, printError } from "../output.js";
import { addExamples } from "./help.js";

export function registerProfileCommands(program: Command): void {
  const profile = program.command("profile").description("Manage connection profiles");

  profile
    .command("list")
    .description("List all profiles")
    .action(() => {
      const profiles = listProfiles();
      for (const p of profiles) {
        const marker = p.active ? " *" : "";
        console.log(`${p.name}${marker}`);
      }
    });

  const use = profile
    .command("use <name>")
    .description("Switch active profile")
    .action((name: string) => {
      try {
        setCurrentProfile(name);
        printSuccess(`Switched to profile "${name}".`);
      } catch (err) {
        printError((err as Error).message);
        process.exit(1);
      }
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

  profile
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

  profile
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
        } else {
          console.log(`${key}: ${value}`);
        }
      }
    });
}
