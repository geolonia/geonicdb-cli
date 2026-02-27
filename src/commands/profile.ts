import type { Command } from "commander";
import { loadFullConfig, saveFullConfig } from "../config.js";
import { printOutput, printSuccess, printError } from "../output.js";

export function registerProfileCommand(program: Command): void {
  const profile = program
    .command("profile")
    .description("Manage connection profiles");

  profile
    .command("list")
    .description("List all profiles")
    .action(() => {
      const config = loadFullConfig();
      const names = Object.keys(config.profiles);
      for (const name of names) {
        const marker = name === config.activeProfile ? "* " : "  ";
        console.log(`${marker}${name}`);
      }
    });

  profile
    .command("create")
    .description("Create a new profile")
    .argument("<name>", "Profile name")
    .action((name: string) => {
      const config = loadFullConfig();
      if (config.profiles[name]) {
        printError(`Profile "${name}" already exists.`);
        process.exit(1);
      }
      config.profiles[name] = {};
      saveFullConfig(config);
      printSuccess(`Created profile "${name}".`);
    });

  profile
    .command("use")
    .description("Switch active profile")
    .argument("<name>", "Profile name")
    .action((name: string) => {
      const config = loadFullConfig();
      if (!config.profiles[name]) {
        printError(`Profile "${name}" does not exist.`);
        process.exit(1);
      }
      config.activeProfile = name;
      saveFullConfig(config);
      printSuccess(`Switched to profile "${name}".`);
    });

  profile
    .command("show")
    .description("Show profile configuration")
    .argument("<name>", "Profile name")
    .action((name: string) => {
      const config = loadFullConfig();
      if (!config.profiles[name]) {
        printError(`Profile "${name}" does not exist.`);
        process.exit(1);
      }
      printOutput(config.profiles[name], "json");
    });

  profile
    .command("delete")
    .description("Delete a profile")
    .argument("<name>", "Profile name")
    .action((name: string) => {
      const config = loadFullConfig();
      if (name === "default") {
        printError('Cannot delete the "default" profile.');
        process.exit(1);
      }
      if (!config.profiles[name]) {
        printError(`Profile "${name}" does not exist.`);
        process.exit(1);
      }
      if (name === config.activeProfile) {
        printError(
          `Cannot delete the active profile "${name}". Switch to another profile first.`,
        );
        process.exit(1);
      }
      delete config.profiles[name];
      saveFullConfig(config);
      printSuccess(`Deleted profile "${name}".`);
    });
}
