import { describe, it, expect } from "vitest";
import { createProgram } from "../src/cli.js";
import { generateCompletions } from "../src/commands/cli.js";

describe("completions", () => {
  const program = createProgram();

  function complete(line: string, point?: number): string[] {
    return generateCompletions(program, line, point ?? line.length);
  }

  describe("top-level commands", () => {
    it("lists all non-hidden commands", () => {
      const result = complete("geonic ");
      expect(result).toContain("entities");
      expect(result).toContain("subscriptions");
      expect(result).toContain("admin");
      expect(result).toContain("health");
      expect(result).toContain("config");
      expect(result).toContain("help");
    });

    it("excludes hidden commands", () => {
      const result = complete("geonic ");
      expect(result).not.toContain("attrs");
      expect(result).not.toContain("login");
      expect(result).not.toContain("logout");
      expect(result).not.toContain("whoami");
      expect(result).not.toContain("cli");
    });

    it("filters by partial input", () => {
      const result = complete("geonic e");
      expect(result).toContain("entities");
      expect(result).toContain("entityOperations");
      expect(result).not.toContain("admin");
      expect(result).not.toContain("health");
    });
  });

  describe("subcommand completion", () => {
    it("completes entities subcommands", () => {
      const result = complete("geonic entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
      expect(result).toContain("update");
      expect(result).toContain("delete");
      expect(result).toContain("attrs");
    });

    it("completes admin subcommands", () => {
      const result = complete("geonic admin ");
      expect(result).toContain("tenants");
      expect(result).toContain("users");
      expect(result).toContain("policies");
    });

    it("completes nested admin tenants subcommands", () => {
      const result = complete("geonic admin tenants ");
      expect(result).toContain("list");
      expect(result).toContain("create");
      expect(result).toContain("delete");
    });

    it("completes temporal entities subcommands", () => {
      const result = complete("geonic temporal entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
      expect(result).toContain("delete");
    });

    it("completes temporal top-level (non-hidden only)", () => {
      const result = complete("geonic temporal ");
      expect(result).toContain("entities");
      expect(result).toContain("entityOperations");
      // hidden backward-compat aliases should not appear
      expect(result).not.toContain("list");
      expect(result).not.toContain("get");
    });
  });

  describe("option completion", () => {
    it("completes options for a leaf command", () => {
      const result = complete("geonic entities list --");
      expect(result).toContain("--type");
      expect(result).toContain("--limit");
      expect(result).toContain("--count");
      expect(result).toContain("--query");
    });

    it("includes global options", () => {
      const result = complete("geonic entities list --");
      expect(result).toContain("--url");
      expect(result).toContain("--service");
      expect(result).toContain("--token");
      expect(result).toContain("--format");
      expect(result).toContain("--verbose");
    });

    it("filters options by partial input", () => {
      const result = complete("geonic entities list --t");
      expect(result).toContain("--type");
      expect(result).toContain("--token");
      expect(result).not.toContain("--url");
      expect(result).not.toContain("--limit");
    });

    it("returns global options for commands without own options", () => {
      const result = complete("geonic health --");
      expect(result).toContain("--url");
      expect(result).toContain("--format");
    });
  });

  describe("--format value completion", () => {
    it("completes format values after --format", () => {
      const result = complete("geonic entities list --format ");
      expect(result).toEqual(["json", "table", "keyValues", "geojson"]);
    });

    it("completes format values after -f", () => {
      const result = complete("geonic entities list -f ");
      expect(result).toEqual(["json", "table", "keyValues", "geojson"]);
    });

    it("filters format values by partial input", () => {
      const result = complete("geonic entities list --format j");
      expect(result).toEqual(["json"]);
    });

    it("returns all format values when partial is empty", () => {
      const result = complete("geonic entities list --format ");
      expect(result).toHaveLength(4);
    });
  });

  describe("<file> signal", () => {
    it("returns <file> for entities create argument", () => {
      const result = complete("geonic entities create ");
      expect(result).toEqual(["<file>"]);
    });

    it("returns <file> for entities update after entity ID", () => {
      const result = complete("geonic entities update some-id ");
      expect(result).toEqual(["<file>"]);
    });

    it("does not return <file> for batch create (no @file in description)", () => {
      // batch commands use .command("create <json>") without @file description
      const result = complete("geonic entityOperations create ");
      expect(result).toEqual([]);
    });
  });

  describe("alias navigation", () => {
    it("navigates via batch alias to entityOperations", () => {
      const result = complete("geonic batch ");
      expect(result).toContain("create");
      expect(result).toContain("upsert");
      expect(result).toContain("update");
      expect(result).toContain("delete");
      expect(result).toContain("query");
      expect(result).toContain("merge");
    });

    it("navigates via models alias to custom-data-models", () => {
      const result = complete("geonic models ");
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
    });
  });

  describe("option value skip in tree walk", () => {
    it("skips option value and continues tree walk", () => {
      const result = complete("geonic --url http://localhost:3000 entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
    });

    it("skips multiple options with values", () => {
      const result = complete(
        "geonic --url http://localhost:3000 --service test entities ",
      );
      expect(result).toContain("list");
    });

    it("skips boolean flag without consuming next token", () => {
      const result = complete("geonic --verbose entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
    });

    it("handles options between command levels", () => {
      const result = complete("geonic entities --verbose list --");
      expect(result).toContain("--type");
      expect(result).toContain("--limit");
    });
  });

  describe("help command completion", () => {
    it("completes top-level commands after help", () => {
      const result = complete("geonic help ");
      expect(result).toContain("entities");
      expect(result).toContain("subscriptions");
      expect(result).toContain("admin");
      expect(result).toContain("health");
      expect(result).toContain("config");
    });

    it("excludes hidden commands after help", () => {
      const result = complete("geonic help ");
      expect(result).not.toContain("cli");
      expect(result).not.toContain("attrs");
    });

    it("filters commands by partial input after help", () => {
      const result = complete("geonic help e");
      expect(result).toContain("entities");
      expect(result).toContain("entityOperations");
      expect(result).not.toContain("admin");
    });

    it("completes subcommands after help <command>", () => {
      const result = complete("geonic help entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
      expect(result).toContain("attrs");
    });

    it("completes nested subcommands after help <command> <subcommand>", () => {
      const result = complete("geonic help admin tenants ");
      expect(result).toContain("list");
      expect(result).toContain("create");
      expect(result).toContain("delete");
    });

    it("completes with alias navigation after help", () => {
      const result = complete("geonic help batch ");
      expect(result).toContain("create");
      expect(result).toContain("upsert");
    });

    it("returns empty for leaf commands after help", () => {
      const result = complete("geonic help health ");
      expect(result).toEqual([]);
    });

    it("works with global options before help", () => {
      const result = complete("geonic --verbose help entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
    });
  });

  describe("point parameter", () => {
    it("truncates line at point position", () => {
      const result = complete("geonic entities list --format json", 16);
      // point=16 → "geonic entities " → completing entities subcommands
      expect(result).toContain("list");
      expect(result).toContain("get");
    });
  });
});
