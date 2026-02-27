import { Command } from "commander";
import { registerConfigCommand } from "./commands/config.js";
import { registerAuthCommands } from "./commands/auth.js";
import { registerProfileCommand } from "./commands/profile.js";
import { registerEntitiesCommand } from "./commands/entities.js";
import { registerAttrsCommand } from "./commands/attrs.js";
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

export function createProgram(): Command {
  const program = new Command();

  program
    .name("gdb")
    .description("CLI for GeonicDB — FIWARE Orion compatible Context Broker")
    .option("-u, --url <url>", "Base URL of the GeonicDB server")
    .option("-s, --service <name>", "Fiware-Service / NGSILD-Tenant header")
    .option("--service-path <path>", "Fiware-ServicePath header")
    .option("--api <version>", "API version: v2 or ld")
    .option("--token <token>", "Authentication token")
    .option("--api-key <key>", "API key for authentication")
    .option("-p, --profile <name>", "Configuration profile to use")
    .option("-f, --format <fmt>", "Output format: json, table, keyValues, geojson")
    .option("--no-color", "Disable color output")
    .option("-v, --verbose", "Verbose output");

  registerConfigCommand(program);
  registerAuthCommands(program);
  registerProfileCommand(program);
  registerEntitiesCommand(program);
  registerAttrsCommand(program);
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

  return program;
}
