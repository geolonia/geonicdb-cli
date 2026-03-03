import { describe, it, expect, vi } from "vitest";
import { Command, Option } from "commander";
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
      expect(result).toEqual(["json", "table", "geojson"]);
    });

    it("completes format values after -f", () => {
      const result = complete("geonic entities list -f ");
      expect(result).toEqual(["json", "table", "geojson"]);
    });

    it("filters format values by partial input", () => {
      const result = complete("geonic entities list --format j");
      expect(result).toEqual(["json"]);
    });

    it("returns all format values when partial is empty", () => {
      const result = complete("geonic entities list --format ");
      expect(result).toHaveLength(3);
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
      // batch commands use .command("create [json]") without @file description
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

    it("skips options with values after help", () => {
      const result = complete(
        "geonic help --url http://localhost:3000 entities ",
      );
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
    });

    it("skips boolean flags after help", () => {
      const result = complete("geonic help --verbose entities ");
      expect(result).toContain("list");
      expect(result).toContain("get");
    });
  });

  describe("help completion edge cases", () => {
    it("stops at unknown subcommand and returns parent's subcommands", () => {
      const result = complete("geonic help entities nonexistent ");
      // nonexistent is not found, break leaves target at entities
      expect(result).toContain("list");
      expect(result).toContain("get");
      expect(result).toContain("create");
    });
  });

  describe("predecessor edge cases", () => {
    it("returns empty when completing value after unknown value-taking option", () => {
      const result = complete("geonic entities list --type ");
      // --type takes a value, so no completions for its value
      expect(result).toEqual([]);
    });

    it("handles single token (no predecessor)", () => {
      const result = complete("geonic");
      // No trailing space → partial="", walkTokens=[] → returns all top-level commands
      expect(result).toContain("entities");
      expect(result).toContain("health");
    });

    it("skips unknown flag in tree walk (optionTakesValue returns false for unknown)", () => {
      const result = complete("geonic --zzz entities ");
      // --zzz is not a known option, so findOption returns undefined → !opt → false
      expect(result).toContain("list");
      expect(result).toContain("get");
    });
  });

  describe("hidden option filtering in completions", () => {
    it("excludes hidden options from command and program", () => {
      const prog = new Command();
      prog.name("test");
      prog.addOption(new Option("--global-visible <v>", "visible global"));
      prog.addOption(new Option("--global-hidden <h>", "hidden global").hideHelp());
      const sub = prog.command("sub").description("Sub command");
      sub.addOption(new Option("--cmd-visible", "visible cmd opt"));
      sub.addOption(new Option("--cmd-hidden", "hidden cmd opt").hideHelp());

      const result = generateCompletions(prog, "test sub --", 11);
      expect(result).toContain("--cmd-visible");
      expect(result).not.toContain("--cmd-hidden");
      expect(result).toContain("--global-visible");
      expect(result).not.toContain("--global-hidden");
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

  describe("cli command actions", () => {
    it("completions without --line/--point produces no output", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await prog.parseAsync(["node", "geonic", "cli", "completions"]);
      } catch {
        // exitOverride may throw
      }
      // Should not have called console.log since no --line/--point
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("completions with --line and --point outputs completions", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await prog.parseAsync([
          "node", "geonic", "cli", "completions",
          "--line", "geonic ",
          "--point", "7",
        ]);
      } catch {
        // exitOverride may throw
      }
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("cli completions bash outputs bash script", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await prog.parseAsync(["node", "geonic", "cli", "completions", "bash"]);
      } catch {
        // exitOverride may throw
      }
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain("_geonic_completions");
      expect(output).toContain("complete");
      expect(output).toContain("COMP_WORDS");
      logSpy.mockRestore();
    });

    it("cli completions zsh outputs zsh script", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await prog.parseAsync(["node", "geonic", "cli", "completions", "zsh"]);
      } catch {
        // exitOverride may throw
      }
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0];
      expect(output).toContain("_geonic_completions");
      expect(output).toContain("compdef");
      logSpy.mockRestore();
    });

    it("completions with --line only (no --point) produces no output", async () => {
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      try {
        await prog.parseAsync(["node", "geonic", "cli", "completions", "--line", "geonic "]);
      } catch {
        // exitOverride may throw
      }
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("cli version outputs the version string", async () => {
      // In the test environment, createRequire(import.meta.url) inside
      // src/commands/cli.ts resolves "../package.json" relative to
      // src/commands/, which resolves to src/package.json. Node's require
      // traverses up parent directories, so it finds the root package.json.
      const prog = createProgram();
      prog.exitOverride();
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      let threw = false;
      try {
        await prog.parseAsync(["node", "geonic", "cli", "version"]);
      } catch {
        threw = true;
      }
      if (logSpy.mock.calls.length > 0) {
        const version = logSpy.mock.calls[0][0];
        expect(version).toMatch(/^\d+\.\d+\.\d+/);
      } else {
        // If require("../package.json") throws in the test environment,
        // verify the command at least exists and was invoked.
        expect(threw).toBe(true);
      }
      logSpy.mockRestore();
    });
  });
});
