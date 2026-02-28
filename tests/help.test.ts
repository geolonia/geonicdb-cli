import { describe, it, expect } from "vitest";
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

    it("includes DESCRIPTION section", () => {
      expect(output).toContain("DESCRIPTION");
      expect(output).toContain("CLI for GeonicDB");
    });

    it("includes AVAILABLE COMMANDS section", () => {
      expect(output).toContain("AVAILABLE COMMANDS");
    });

    it("lists all command groups", () => {
      const commands = [
        "entities",
        "attrs",
        "batch",
        "subscriptions",
        "registrations",
        "types",
        "temporal",
        "snapshots",
        "admin",
        "config",
        "profile",
        "rules",
        "models",
        "catalog",
        "health",
        "version",
        "help",
      ];
      for (const cmd of commands) {
        expect(output).toContain(cmd);
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
});
