import { createRequire } from "node:module";
import type { Command, Option } from "commander";
import { addExamples } from "./help.js";

function findOption(
  cmd: Command,
  program: Command,
  flag: string,
): Option | undefined {
  return (
    cmd.options.find((o) => o.long === flag || o.short === flag) ||
    program.options.find((o) => o.long === flag || o.short === flag)
  );
}

function optionTakesValue(
  cmd: Command,
  program: Command,
  flag: string,
): boolean {
  const opt = findOption(cmd, program, flag);
  if (!opt) return false;
  return !!(opt.required || opt.optional);
}

function findSubcommand(cmd: Command, name: string): Command | undefined {
  return cmd.commands.find(
    (c) => c.name() === name || c.aliases().includes(name),
  );
}

export function generateCompletions(
  program: Command,
  line: string,
  point: number,
): string[] {
  const truncated = line.slice(0, point);
  const tokens = truncated.trim().split(/\s+/).filter(Boolean);
  const startingNewWord = /\s$/.test(truncated);

  // Determine partial input (what the user is currently typing)
  const partial =
    !startingNewWord && tokens.length > 1 ? tokens[tokens.length - 1] : "";

  // Tokens to walk the command tree (exclude program name and partial)
  const walkTokens = startingNewWord ? tokens.slice(1) : tokens.slice(1, -1);

  // Walk the command tree
  let currentCmd = program;
  let i = 0;

  while (i < walkTokens.length) {
    const token = walkTokens[i];

    if (token.startsWith("-")) {
      if (optionTakesValue(currentCmd, program, token)) {
        i += 2; // skip option + its value
      } else {
        i += 1;
      }
      continue;
    }

    const sub = findSubcommand(currentCmd, token);
    if (sub) {
      currentCmd = sub;
    }
    i++;
  }

  // Special handling: `help` command mirrors the main command tree for completions
  if (currentCmd.name() === "help" && currentCmd.parent === program) {
    const helpIdx = walkTokens.findIndex((t) => t === "help");
    const rawArgs = helpIdx >= 0 ? walkTokens.slice(helpIdx + 1) : [];
    const helpArgs: string[] = [];
    for (let j = 0; j < rawArgs.length; j++) {
      const t = rawArgs[j];
      if (t.startsWith("-")) {
        if (optionTakesValue(currentCmd, program, t)) {
          j++; // skip the option's value
        }
        continue;
      }
      helpArgs.push(t);
    }

    let target = program;
    for (const arg of helpArgs) {
      const sub = findSubcommand(target, arg);
      if (sub) target = sub;
      else break;
    }

    const subs = target.commands
      .filter((c) => !(c as { _hidden?: boolean })._hidden)
      .map((c) => c.name());
    return subs.filter((s) => s.startsWith(partial));
  }

  // Determine predecessor token (immediately before the completion point)
  const predecessor = startingNewWord
    ? tokens[tokens.length - 1]
    : tokens.length >= 2
      ? tokens[tokens.length - 2]
      : undefined;

  // Case 1: Previous token is a value-taking option → complete option values
  if (
    predecessor &&
    predecessor.startsWith("-") &&
    optionTakesValue(currentCmd, program, predecessor)
  ) {
    return getOptionValueCompletions(predecessor, partial);
  }

  // Case 2: Partial starts with '-' → complete options
  if (partial.startsWith("-")) {
    return getOptionCompletions(currentCmd, program, partial);
  }

  // Case 3: Current command has non-hidden subcommands → complete them
  const subcommands = currentCmd.commands
    .filter((c) => !(c as { _hidden?: boolean })._hidden)
    .map((c) => c.name());

  if (subcommands.length > 0) {
    return subcommands.filter((s) => s.startsWith(partial));
  }

  // Case 4: Command takes file arguments → signal <file>
  for (const arg of currentCmd.registeredArguments) {
    if (arg.description && arg.description.includes("@file")) {
      return ["<file>"];
    }
  }

  return [];
}

function getOptionCompletions(
  cmd: Command,
  program: Command,
  partial: string,
): string[] {
  const options = new Set<string>();

  for (const opt of cmd.options) {
    if (opt.hidden) continue;
    if (opt.long) options.add(opt.long);
  }

  for (const opt of program.options) {
    if (opt.hidden) continue;
    if (opt.long) options.add(opt.long);
  }

  return [...options].filter((o) => o.startsWith(partial));
}

function getOptionValueCompletions(
  optionFlag: string,
  partial: string,
): string[] {
  if (optionFlag === "--format" || optionFlag === "-f") {
    return ["json", "table", "geojson"].filter((v) =>
      v.startsWith(partial),
    );
  }
  return [];
}

const ZSH_SCRIPT = `_geonic_completions() {
  local completions
  completions=(\${(f)"$(geonic cli completions --line="$BUFFER" --point="$CURSOR" 2>/dev/null)"})
  if [[ "\${completions[1]}" == "<file>" ]]; then
    _files
    return
  fi
  compadd -a completions
}
compdef _geonic_completions geonic`;

const BASH_SCRIPT = `_geonic_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local completions
  completions=$(geonic cli completions --line="\${COMP_LINE}" --point="\${COMP_POINT}" 2>/dev/null)
  if [[ "$completions" == "<file>" ]]; then
    COMPREPLY=()
    return
  fi
  COMPREPLY=($(compgen -W "$completions" -- "$cur"))
}
complete -o default -F _geonic_completions geonic`;

export function registerCliCommand(program: Command): void {
  const cli = program
    .command("cli")
    .summary("Manage CLI internals")
    .description("Manage CLI internals such as shell completions.");

  const completions = cli
    .command("completions")
    .summary("Generate shell completions")
    .description("Generate shell completions for geonic CLI.")
    .option("--line <line>", "Current command line content")
    .option("--point <point>", "Cursor position in the command line")
    .action((opts: { line?: string; point?: string }) => {
      if (opts.line !== undefined && opts.point !== undefined) {
        const point = parseInt(opts.point, 10);
        const results = generateCompletions(program, opts.line, point);
        for (const r of results) {
          console.log(r);
        }
      }
    });

  const bash = completions
    .command("bash")
    .description("Output bash completion script")
    .action(() => {
      console.log(BASH_SCRIPT);
    });

  addExamples(bash, [
    {
      description: "Print the bash completion script",
      command: "geonic cli completions bash",
    },
    {
      description: "Enable in current shell session",
      command: 'eval "$(geonic cli completions bash)"',
    },
    {
      description: "Persist in ~/.bashrc",
      command:
        'echo \'eval "$(geonic cli completions bash)"\' >> ~/.bashrc',
    },
  ]);

  const zsh = completions
    .command("zsh")
    .description("Output zsh completion script")
    .action(() => {
      console.log(ZSH_SCRIPT);
    });

  addExamples(zsh, [
    {
      description: "Print the zsh completion script",
      command: "geonic cli completions zsh",
    },
    {
      description: "Enable in current shell session",
      command: 'eval "$(geonic cli completions zsh)"',
    },
    {
      description: "Persist in ~/.zshrc",
      command:
        'echo \'eval "$(geonic cli completions zsh)"\' >> ~/.zshrc',
    },
  ]);

  const version = cli
    .command("version")
    .description("Display the CLI version")
    .action(() => {
      const require = createRequire(import.meta.url);
      const pkg = require("../package.json") as { version: string };
      console.log(pkg.version);
    });

  addExamples(version, [
    {
      description: "Show CLI version",
      command: "geonic cli version",
    },
  ]);
}
