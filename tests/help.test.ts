import { describe, it, expect, vi } from "vitest";
import stripAnsi from "strip-ansi";
import { createProgram } from "../src/cli.js";
import { formatTopLevelHelp, formatCommandDetails } from "../src/commands/help.js";

function findCommand(program: ReturnType<typeof createProgram>, ...names: string[]) {
  let current = program as { commands: { name(): string; aliases(): string[]; commands: unknown[] }[] };
  for (const name of names) {
    const found = current.commands.find(
      (c) => c.name() === name || c.aliases().includes(name),
    );
    if (!found) throw new Error(`Command not found: ${name}`);
    current = found as typeof current;
  }
  return current;
}

describe("help", () => {
  const program = createProgram();

  describe("formatTopLevelHelp", () => {
    const output = stripAnsi(formatTopLevelHelp(program));

    it("includes NAME section", () => {
      expect(output).toContain("NAME");
      expect(output).toContain("  geonic");
    });

    it("includes DESCRIPTION section from package.json", () => {
      expect(output).toContain("DESCRIPTION");
      expect(output).toContain("A CLI client for the GeonicDB");
    });

    it("includes AVAILABLE COMMANDS section", () => {
      expect(output).toContain("AVAILABLE COMMANDS");
    });

    it("lists all command groups", () => {
      const commands = [
        "auth",
        "cli",
        "entities",
        "entityOperations",
        "custom-data-models",
        "subscriptions",
        "registrations",
        "types",
        "temporal",
        "snapshots",
        "admin",
        "config",
        "profile",
        "rules",
        "me",
        "catalog",
        "health",
        "version",
        "help",
      ];
      for (const cmd of commands) {
        expect(output).toContain(cmd);
      }
    });

    it("does not list hidden backward-compat commands", () => {
      const hidden = ["attrs", "login", "logout", "whoami"];
      // These should not appear as standalone top-level commands in help
      // (they may appear as subcommands of other groups)
      const lines = output.split("\n");
      const cmdStart = lines.findIndex((l) => l.includes("AVAILABLE COMMANDS"));
      const globalStart = lines.findIndex((l) => l.includes("GLOBAL PARAMETERS"));
      const commandNames = lines
        .slice(cmdStart + 2, globalStart)
        .filter((l) => l.match(/^\s{2}\S/))
        .map((l) => l.trim().split(/\s{2,}/)[0]);
      for (const cmd of hidden) {
        expect(commandNames).not.toContain(cmd);
      }
    });

    it("includes GLOBAL PARAMETERS section", () => {
      expect(output).toContain("GLOBAL PARAMETERS");
      expect(output).toContain("--url <url>");
      expect(output).toContain("--service <name>");
      expect(output).toContain("--format <fmt>");
      expect(output).toContain("--verbose");
    });

    it("lists commands in alphabetical order", () => {
      const lines = output.split("\n");
      const cmdStart = lines.findIndex((l) => l.includes("AVAILABLE COMMANDS"));
      const globalStart = lines.findIndex((l) => l.includes("GLOBAL PARAMETERS"));
      const commandNames = lines
        .slice(cmdStart + 2, globalStart)
        .filter((l) => l.match(/^\s{2}\S/))
        .map((l) => l.trim().split(/\s{2,}/)[0]);

      const sorted = [...commandNames].sort();
      expect(commandNames).toEqual(sorted);
    });
  });

  describe("formatCommandDetails — command group", () => {
    const entities = findCommand(program, "entities");
    const output = stripAnsi(
      formatCommandDetails(program, entities as never, "geonic entities"),
    );

    it("includes NAME with command path", () => {
      expect(output).toContain("NAME");
      expect(output).toContain("  geonic entities");
    });

    it("includes DESCRIPTION", () => {
      expect(output).toContain("DESCRIPTION");
      expect(output).toContain("Manage context entities");
    });

    it("includes SYNOPSIS with <command>", () => {
      expect(output).toContain("SYNOPSIS");
      expect(output).toContain("geonic entities <command>");
    });

    it("includes SUBCOMMANDS section", () => {
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("list");
      expect(output).toContain("get");
      expect(output).toContain("create");
      expect(output).toContain("update");
      expect(output).toContain("delete");
    });

    it("does not include OPTIONS section", () => {
      expect(output).not.toContain("OPTIONS");
    });

    it("includes GLOBAL PARAMETERS", () => {
      expect(output).toContain("GLOBAL PARAMETERS");
    });
  });

  describe("formatCommandDetails — leaf command", () => {
    const entitiesList = findCommand(program, "entities", "list");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        entitiesList as never,
        "geonic entities list",
      ),
    );

    it("includes NAME with full path", () => {
      expect(output).toContain("  geonic entities list");
    });

    it("includes SYNOPSIS with options", () => {
      expect(output).toContain("SYNOPSIS");
      expect(output).toContain("[--type=<type>]");
      expect(output).toContain("[--limit=<n>]");
    });

    it("includes OPTIONS section with descriptions", () => {
      expect(output).toContain("OPTIONS");
      expect(output).toContain("--type <type>");
      expect(output).toContain("Filter by entity type");
      expect(output).toContain("--limit <n>");
      expect(output).toContain("Maximum number of entities to return");
    });

    it("shows boolean flags without value in synopsis", () => {
      expect(output).toContain("[--count]");
    });
  });

  describe("formatCommandDetails — EXAMPLES section", () => {
    const entitiesList = findCommand(program, "entities", "list");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        entitiesList as never,
        "geonic entities list",
      ),
    );

    it("includes EXAMPLES section for commands with examples", () => {
      expect(output).toContain("EXAMPLES");
    });

    it("includes example commands", () => {
      expect(output).toContain("$ geonic entities list --type Sensor");
      expect(output).toContain("$ geonic entities list --query 'temperature>30'");
    });

    it("includes example descriptions", () => {
      expect(output).toContain("Filter by entity type:");
      expect(output).toContain("Pattern match:");
    });

    it("places EXAMPLES between OPTIONS and GLOBAL PARAMETERS", () => {
      const optionsIdx = output.indexOf("OPTIONS");
      const examplesIdx = output.indexOf("EXAMPLES");
      const globalIdx = output.indexOf("GLOBAL PARAMETERS");
      expect(optionsIdx).toBeLessThan(examplesIdx);
      expect(examplesIdx).toBeLessThan(globalIdx);
    });
  });

  describe("formatCommandDetails — no EXAMPLES when none registered", () => {
    const admin = findCommand(program, "admin");
    const output = stripAnsi(
      formatCommandDetails(program, admin as never, "geonic admin"),
    );

    it("does not include EXAMPLES section", () => {
      expect(output).not.toContain("EXAMPLES");
    });
  });

  describe("formatCommandDetails — new EXAMPLES coverage", () => {
    it("health command has examples", () => {
      const health = findCommand(program, "health");
      const output = stripAnsi(
        formatCommandDetails(program, health as never, "geonic health"),
      );
      expect(output).toContain("EXAMPLES");
      expect(output).toContain("$ geonic health");
    });

    it("batch update command has examples", () => {
      const batchUpdate = findCommand(program, "batch", "update");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          batchUpdate as never,
          "geonic batch update",
        ),
      );
      expect(output).toContain("EXAMPLES");
      expect(output).toContain("$ geonic batch update");
    });

    it("admin tenants list command has examples", () => {
      const tenantsList = findCommand(program, "admin", "tenants", "list");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          tenantsList as never,
          "geonic admin tenants list",
        ),
      );
      expect(output).toContain("EXAMPLES");
      expect(output).toContain("$ geonic admin tenants list");
    });

    it("entities attrs list command has examples", () => {
      const attrsList = findCommand(program, "entities", "attrs", "list");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          attrsList as never,
          "geonic entities attrs list",
        ),
      );
      expect(output).toContain("EXAMPLES");
    });

    it("rules activate command has examples", () => {
      const rulesActivate = findCommand(program, "rules", "activate");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          rulesActivate as never,
          "geonic rules activate",
        ),
      );
      expect(output).toContain("EXAMPLES");
      expect(output).toContain("$ geonic rules activate");
    });
  });

  describe("formatCommandDetails — alias display", () => {
    const subscriptions = findCommand(program, "subscriptions");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        subscriptions as never,
        "geonic subscriptions",
      ),
    );

    it("shows alias in NAME section", () => {
      expect(output).toContain("(alias: sub)");
    });
  });

  describe("formatCommandDetails — nested commands", () => {
    const adminTenants = findCommand(program, "admin", "tenants");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        adminTenants as never,
        "geonic admin tenants",
      ),
    );

    it("shows correct path for nested command", () => {
      expect(output).toContain("  geonic admin tenants");
    });

    it("lists subcommands of nested group", () => {
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("list");
      expect(output).toContain("create");
      expect(output).toContain("delete");
    });
  });

  describe("formatCommandDetails — standalone command", () => {
    const health = findCommand(program, "health");
    const output = stripAnsi(
      formatCommandDetails(program, health as never, "geonic health"),
    );

    it("shows SYNOPSIS without <command>", () => {
      expect(output).toContain("SYNOPSIS");
      expect(output).not.toContain("<command>");
    });

    it("does not include SUBCOMMANDS section", () => {
      expect(output).not.toContain("SUBCOMMANDS");
    });
  });

  describe("formatCommandDetails — command with arguments", () => {
    const entitiesGet = findCommand(program, "entities", "get");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        entitiesGet as never,
        "geonic entities get",
      ),
    );

    it("shows required argument in synopsis", () => {
      expect(output).toContain("geonic entities get <id>");
    });
  });

  describe("entities attrs — nested subcommand", () => {
    it("entities has attrs subcommand", () => {
      const attrs = findCommand(program, "entities", "attrs");
      expect(attrs).toBeDefined();
    });

    it("entities attrs has expected subcommands", () => {
      const attrs = findCommand(program, "entities", "attrs");
      const output = stripAnsi(
        formatCommandDetails(program, attrs as never, "geonic entities attrs"),
      );
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("list");
      expect(output).toContain("get");
      expect(output).toContain("add");
      expect(output).toContain("update");
      expect(output).toContain("delete");
    });
  });

  describe("auth — command group", () => {
    it("auth has login and logout subcommands", () => {
      const auth = findCommand(program, "auth");
      const output = stripAnsi(
        formatCommandDetails(program, auth as never, "geonic auth"),
      );
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("login");
      expect(output).toContain("logout");
    });

    it("me is a top-level command", () => {
      const me = findCommand(program, "me");
      expect(me).toBeDefined();
    });
  });

  describe("entityOperations — alias display", () => {
    const entityOps = findCommand(program, "entityOperations");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        entityOps as never,
        "geonic entityOperations",
      ),
    );

    it("shows batch as alias", () => {
      expect(output).toContain("(alias: batch)");
    });

    it("has expected subcommands", () => {
      expect(output).toContain("create");
      expect(output).toContain("upsert");
      expect(output).toContain("update");
      expect(output).toContain("delete");
      expect(output).toContain("query");
      expect(output).toContain("merge");
    });

    it("is findable via batch alias", () => {
      const batch = findCommand(program, "batch");
      expect(batch).toBeDefined();
    });
  });

  describe("temporal — nested subgroups", () => {
    it("temporal has entities subgroup", () => {
      const temporalEntities = findCommand(program, "temporal", "entities");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          temporalEntities as never,
          "geonic temporal entities",
        ),
      );
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("list");
      expect(output).toContain("get");
      expect(output).toContain("create");
      expect(output).toContain("delete");
    });

    it("temporal has entityOperations subgroup", () => {
      const temporalEntityOps = findCommand(
        program,
        "temporal",
        "entityOperations",
      );
      const output = stripAnsi(
        formatCommandDetails(
          program,
          temporalEntityOps as never,
          "geonic temporal entityOperations",
        ),
      );
      expect(output).toContain("SUBCOMMANDS");
      expect(output).toContain("query");
    });

    it("temporal help only shows non-hidden subcommands", () => {
      const temporal = findCommand(program, "temporal");
      const output = stripAnsi(
        formatCommandDetails(
          program,
          temporal as never,
          "geonic temporal",
        ),
      );
      // Should show entities and entityOperations as subcommands
      const lines = output.split("\n");
      const subStart = lines.findIndex((l) => l.includes("SUBCOMMANDS"));
      const globalStart = lines.findIndex((l) => l.includes("GLOBAL PARAMETERS"));
      const subNames = lines
        .slice(subStart + 1, globalStart)
        .filter((l) => l.match(/^\s{2}\S/))
        .map((l) => l.trim().split(/\s{2,}/)[0]);
      expect(subNames).toContain("entities");
      expect(subNames).toContain("entityOperations");
      // Hidden backward-compat commands should not appear
      expect(subNames).not.toContain("list");
      expect(subNames).not.toContain("get");
      expect(subNames).not.toContain("create");
      expect(subNames).not.toContain("delete");
      expect(subNames).not.toContain("query");
    });
  });

  describe("custom-data-models — alias display", () => {
    const models = findCommand(program, "custom-data-models");
    const output = stripAnsi(
      formatCommandDetails(
        program,
        models as never,
        "geonic custom-data-models",
      ),
    );

    it("shows models as alias", () => {
      expect(output).toContain("(alias: models)");
    });

    it("has expected subcommands", () => {
      expect(output).toContain("list");
      expect(output).toContain("get");
      expect(output).toContain("create");
      expect(output).toContain("update");
      expect(output).toContain("delete");
    });

    it("is findable via models alias", () => {
      const m = findCommand(program, "models");
      expect(m).toBeDefined();
    });
  });

  describe("unknown command error", () => {
    it("prints friendly error for unknown commands", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const stderr = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await prog.parseAsync(["node", "geonic", "aaaa"]);
      } catch {
        // exitOverride throws
      }
      const output = stderr.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("geonic: 'aaaa' is not a geonic command");
      expect(output).toContain("geonic help");
      stderr.mockRestore();
    });
  });

  describe("backward-compatible hidden commands", () => {
    it("hidden attrs command is functional at top level", () => {
      const attrs = findCommand(program, "attrs");
      expect(attrs).toBeDefined();
      expect(attrs.commands.length).toBeGreaterThan(0);
    });

    it("hidden login command exists at top level", () => {
      const login = findCommand(program, "login");
      expect(login).toBeDefined();
    });

    it("hidden logout command exists at top level", () => {
      const logout = findCommand(program, "logout");
      expect(logout).toBeDefined();
    });

    it("hidden whoami command exists at top level", () => {
      const whoami = findCommand(program, "whoami");
      expect(whoami).toBeDefined();
    });
  });
});
