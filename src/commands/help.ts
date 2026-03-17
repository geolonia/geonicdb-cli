import chalk from "chalk";
import type { Command, Help, Option } from "commander";

interface Example {
  description: string;
  command: string;
}

const examplesMap = new WeakMap<Command, Example[]>();
const notesMap = new WeakMap<Command, string[]>();

export function addExamples(cmd: Command, examples: Example[]): void {
  examplesMap.set(cmd, examples);
}

export function addNotes(cmd: Command, notes: string[]): void {
  notesMap.set(cmd, notes);
}

function header(title: string): string {
  return chalk.yellow.bold(title);
}

function findCommand(parent: Command, name: string): Command | undefined {
  return parent.commands.find(
    (c) => c.name() === name || c.aliases().includes(name),
  );
}

function getCommandPath(cmd: Command): string {
  const parts: string[] = [];
  let current: Command | null = cmd;
  while (current) {
    parts.unshift(current.name());
    current = current.parent;
  }
  return parts.join(" ");
}

function getRootProgram(cmd: Command): Command {
  let root = cmd;
  while (root.parent) {
    root = root.parent;
  }
  return root;
}

function formatOptionSynopsis(opt: Option): string {
  /* v8 ignore next -- Commander always sets long or short */
  const flag = opt.long || opt.short || "";
  if (opt.required) {
    const match = opt.flags.match(/<([^>]+)>/);
    const valueName = match ? match[1] : "value";
    return `[${flag}=<${valueName}>]`;
  } else if (opt.optional) {
    const match = opt.flags.match(/\[([^\]]+)\]/);
    const valueName = match ? match[1] : "value";
    return `[${flag}[=<${valueName}>]]`;
  }
  return `[${flag}]`;
}

function formatSynopsis(path: string, cmd: Command): string {
  const parts = [path];

  for (const arg of cmd.registeredArguments) {
    if (arg.required) {
      parts.push(`<${arg.name()}>`);
    } else {
      parts.push(`[<${arg.name()}>]`);
    }
  }

  for (const opt of cmd.options) {
    if (opt.hidden) continue;
    parts.push(formatOptionSynopsis(opt));
  }

  return parts.join(" ");
}

function formatOptionList(options: readonly Option[]): string[] {
  const maxLen = Math.max(...options.map((o) => o.flags.length));
  return options.map((opt) => {
    const flags = opt.flags.padEnd(maxLen + 2);
    /* v8 ignore next -- Commander always sets description to '' */
    return `  ${chalk.green(flags)}${opt.description ?? ""}`;
  });
}

function formatGlobalParameters(program: Command): string {
  const lines: string[] = [];
  lines.push(header("GLOBAL PARAMETERS"));
  lines.push("");
  lines.push(...formatOptionList(program.options));
  lines.push("");
  return lines.join("\n");
}

export function formatTopLevelHelp(program: Command): string {
  const lines: string[] = [];

  lines.push(header("NAME"));
  lines.push("");
  lines.push(`  ${program.name()}`);
  lines.push("");
  lines.push(header("DESCRIPTION"));
  lines.push("");
  lines.push(`  ${program.description()}`);
  lines.push("");
  lines.push(header("AVAILABLE COMMANDS"));
  lines.push("");

  const commands = program.commands
    .filter((c) => !(c as Command & { _hidden?: boolean })._hidden)
    .slice()
    .sort((a, b) => a.name().localeCompare(b.name()));

  const maxLen = Math.max(...commands.map((c) => c.name().length));

  for (const cmd of commands) {
    const name = cmd.name().padEnd(maxLen + 2);
    lines.push(`  ${chalk.green(name)}${cmd.summary() || cmd.description()}`);
  }

  lines.push("");
  lines.push(formatGlobalParameters(program));

  return lines.join("\n");
}

export function formatCommandDetails(
  program: Command,
  cmd: Command,
  path: string,
): string {
  const lines: string[] = [];

  // NAME
  lines.push(header("NAME"));
  lines.push("");
  const aliases = cmd.aliases().filter((a) => a.length > 0);
  if (aliases.length > 0) {
    lines.push(`  ${path} ${chalk.dim(`(alias: ${aliases.join(", ")})`)}`);
  } else {
    lines.push(`  ${path}`);
  }

  // DESCRIPTION
  lines.push("");
  lines.push(header("DESCRIPTION"));
  lines.push("");
  for (const descLine of cmd.description().split("\n")) {
    lines.push(`  ${descLine}`);
  }

  const subcommands = cmd.commands.filter(
    (c) => !(c as Command & { _hidden?: boolean })._hidden,
  );

  if (subcommands.length > 0) {
    // Command group with subcommands
    lines.push("");
    lines.push(header("SYNOPSIS"));
    lines.push("");
    lines.push(`  ${path} <command>`);
    lines.push("");
    lines.push(header("SUBCOMMANDS"));
    lines.push("");

    const maxLen = Math.max(...subcommands.map((c) => c.name().length));
    for (const sub of subcommands) {
      const name = sub.name().padEnd(maxLen + 2);
      lines.push(`  ${chalk.green(name)}${sub.summary() || sub.description()}`);
    }
  } else {
    // Leaf command
    lines.push("");
    lines.push(header("SYNOPSIS"));
    lines.push("");
    lines.push(`  ${formatSynopsis(path, cmd)}`);

    const options = cmd.options.filter((o) => !o.hidden);
    if (options.length > 0) {
      lines.push("");
      lines.push(header("OPTIONS"));
      lines.push("");
      lines.push(...formatOptionList(options));
    }
  }

  // EXAMPLES
  const examples = examplesMap.get(cmd);
  if (examples && examples.length > 0) {
    lines.push("");
    lines.push(header("EXAMPLES"));
    lines.push("");
    for (const ex of examples) {
      lines.push(`  ${ex.description}:`);
      lines.push(`    $ ${ex.command}`);
      lines.push("");
    }
  }

  // NOTES
  const notes = notesMap.get(cmd);
  if (notes && notes.length > 0) {
    lines.push("");
    lines.push(header("NOTES"));
    lines.push("");
    for (const note of notes) {
      lines.push(`  ${note}`);
    }
  }

  // GLOBAL PARAMETERS
  lines.push("");
  lines.push(formatGlobalParameters(program));

  return lines.join("\n");
}

function showHelp(program: Command, args: string[]): void {
  if (args.length === 0) {
    console.log(formatTopLevelHelp(program));
    return;
  }

  let current = program;
  const resolved: Command[] = [];

  for (let i = 0; i < args.length; i++) {
    const found = findCommand(current, args[i]);
    if (!found) {
      const attempted = args.slice(0, i + 1).join(" ");
      console.error(
        chalk.red(`Error: '${attempted}' is not a geonic command.`),
      );
      console.error(`\nSee 'geonic help' for available commands.`);
      process.exit(1);
    }
    resolved.push(found);
    current = found;
  }

  const target = resolved[resolved.length - 1];
  const path = [program.name(), ...resolved.map((c) => c.name())].join(" ");

  console.log(formatCommandDetails(program, target, path));
}

export function registerHelpCommand(program: Command): void {
  // Disable Commander's built-in help command
  program.addHelpCommand(false);

  // Override --help to use our wp-cli style format
  program.configureHelp({
    formatHelp: (cmd: Command, _helper: Help): string => {
      const root = getRootProgram(cmd);
      if (cmd === root) {
        return formatTopLevelHelp(root);
      }
      const path = getCommandPath(cmd);
      return formatCommandDetails(root, cmd, path);
    },
  });

  // Register the `help` command
  program
    .command("help")
    .description("Get help on a specific command")
    .argument("[args...]")
    .allowUnknownOption()
    .action((args: string[]) => {
      showHelp(program, args);
    });

  // Show help when `geonic` is run with no arguments, or show error for unknown commands
  program.argument("[command...]").action((commands: string[]) => {
    if (commands.length > 0) {
      console.error(
        `geonic: '${commands[0]}' is not a geonic command. See 'geonic help'.`,
      );
      process.exitCode = 1;
      return;
    }
    showHelp(program, []);
  });
}
