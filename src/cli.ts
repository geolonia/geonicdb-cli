import { createRequire } from "node:module";
import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerProfileCommands } from "./commands/profile.js";
import { registerEntitiesCommand } from "./commands/entities.js";
import { registerBatchCommand } from "./commands/batch.js";
import { registerSubscriptionsCommand } from "./commands/subscriptions.js";
import { registerRegistrationsCommand } from "./commands/registrations.js";
import { registerTypesCommand } from "./commands/types.js";
import { registerTemporalCommand } from "./commands/temporal.js";
import { registerSnapshotsCommand } from "./commands/snapshots.js";
import { registerAdminCommand } from "./commands/admin/index.js";
import { registerRulesCommand } from "./commands/rules.js";
import { registerModelsCommand } from "./commands/models.js";
import { registerCatalogCommand } from "./commands/catalog.js";
import { registerHealthCommand, registerVersionCommand } from "./commands/health.js";
import { registerHelpCommand } from "./commands/help.js";
import { registerCliCommand } from "./commands/cli.js";
import { addAttrsSubcommands } from "./commands/attrs.js";

export function createProgram(): Command {
  const require = createRequire(import.meta.url);
  const pkg = require("../package.json") as { description: string };
  const program = new Command();

  program
    .name("geonic")
    .description(pkg.description)
    .option("-u, --url <url>", "Base URL of the GeonicDB server")
    .option("-s, --service <name>", "NGSILD-Tenant header")
    .option("--token <token>", "Authentication token")
    .option("-p, --profile <name>", "Use a named profile")
    .option("--api-key <key>", "API key for authentication")
    .option("-f, --format <fmt>", "Output format: json, table, keyValues, geojson")
    .option("--no-color", "Disable color output")
    .option("-v, --verbose", "Verbose output");

  registerHelpCommand(program);
  registerConfigCommand(program);
  registerAuthCommands(program);
  registerProfileCommands(program);
  registerEntitiesCommand(program);
  registerBatchCommand(program);
  registerSubscriptionsCommand(program);
  registerRegistrationsCommand(program);
  registerTypesCommand(program);
  registerTemporalCommand(program);
  registerSnapshotsCommand(program);
  registerAdminCommand(program);
  registerRulesCommand(program);
  registerModelsCommand(program);
  registerCatalogCommand(program);
  registerHealthCommand(program);
  registerVersionCommand(program);
  registerCliCommand(program);

  // Backward-compatible hidden 'attrs' command at top level
  const hiddenAttrs = new Command("attrs")
    .description("Manage entity attributes");
  addAttrsSubcommands(hiddenAttrs);
  program.addCommand(hiddenAttrs, { hidden: true });

  return program;
}
