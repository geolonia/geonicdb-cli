import type { Command } from "commander";
import { registerTenantsCommand } from "./tenants.js";
import { registerUsersCommand } from "./users.js";
import { registerPoliciesCommand } from "./policies.js";
import { registerOAuthClientsCommand, registerCaddeCommand } from "./oauth-clients.js";
import { registerApiKeysCommand } from "./api-keys.js";

export function registerAdminCommand(program: Command): void {
  const admin = program
    .command("admin")
    .description("Manage admin resources");

  registerTenantsCommand(admin);
  registerUsersCommand(admin);
  registerPoliciesCommand(admin);
  registerOAuthClientsCommand(admin);
  registerApiKeysCommand(admin);
  registerCaddeCommand(admin);
}
