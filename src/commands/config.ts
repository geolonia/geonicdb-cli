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
    .action((key: string, value: string) => {
      setConfigValue(key, value);
      printSuccess(`Set ${key} = ${value}`);
    });

  config
    .command("get")
    .description("Get a config value")
    .argument("<key>", "Configuration key")
    .action((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        printInfo(`Key "${key}" is not set.`);
      } else {
        printOutput(value, "json");
      }
    });

  config
    .command("list")
    .description("List all config values")
    .action(() => {
      const all = loadConfig();
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
    .action((key: string) => {
      deleteConfigValue(key);
      printSuccess(`Deleted key "${key}".`);
    });
}
