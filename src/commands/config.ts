import type { Command } from "commander";
import {
  loadConfig,
  getConfigValue,
  setConfigValue,
  deleteConfigValue,
  getConfigPath,
} from "../config.js";
import { printOutput, printSuccess, printInfo } from "../output.js";

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage CLI configuration");

  config
    .command("set")
    .description("Save a config value")
    .argument("<key>", "Configuration key")
    .argument("<value>", "Configuration value")
    .action((...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const key = args[0] as string;
      const value = args[1] as string;
      const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;
      setConfigValue(key, value, profile);
      printSuccess(`Set ${key} = ${value}`);
    });

  config
    .command("get")
    .description("Get a config value")
    .argument("<key>", "Configuration key")
    .action((...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const key = args[0] as string;
      const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;
      const value = getConfigValue(key, profile);
      if (value === undefined) {
        printInfo(`Key "${key}" is not set.`);
      } else {
        printOutput(value, "json");
      }
    });

  config
    .command("list")
    .description("List all config values")
    .action((...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;
      const all = loadConfig(profile);
      if (Object.keys(all).length === 0) {
        printInfo(`No configuration set. Config path: ${getConfigPath()}`);
      } else {
        printOutput(all, "json");
      }
    });

  config
    .command("delete")
    .description("Delete a config value")
    .argument("<key>", "Configuration key")
    .action((...args: unknown[]) => {
      const cmd = args[args.length - 1] as Command;
      const key = args[0] as string;
      const profile = (cmd.optsWithGlobals() as { profile?: string }).profile;
      deleteConfigValue(key, profile);
      printSuccess(`Deleted key "${key}".`);
    });
}
