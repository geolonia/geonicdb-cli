import JSON5 from "json5";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

/**
 * Parse JSON input from a string, file (@path), stdin (-), pipe, or interactive mode.
 *
 * Resolution order:
 * 1. Explicit input provided → parse directly (inline, @file, or - for stdin)
 * 2. No input + piped stdin (non-TTY) → auto-read stdin
 * 3. No input + TTY stdin → interactive mode with brace-balanced auto-submit
 *
 * Supports JSON5 syntax (unquoted keys, single quotes, trailing commas).
 */
export async function parseJsonInput(input?: string): Promise<unknown> {
  // 1. Explicit input
  if (input !== undefined && input !== "") {
    if (input === "-") return parseData(readFileSync(0, "utf-8"));
    if (input.startsWith("@")) return parseData(readFileSync(input.slice(1), "utf-8"));
    return parseData(input);
  }

  // 2. Piped stdin (non-TTY)
  if (!process.stdin.isTTY) {
    return parseData(readFileSync(0, "utf-8"));
  }

  // 3. Interactive mode (TTY)
  return readInteractiveJson();
}

function parseData(text: string): unknown {
  return JSON5.parse(text.trim());
}

/**
 * Read JSON interactively from TTY with brace-balance auto-submit.
 * Tracks depth of {}/[] while respecting string literals.
 * When depth returns to 0, automatically parses and returns.
 */
async function readInteractiveJson(): Promise<unknown> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    prompt: "json> ",
  });

  process.stderr.write("Enter JSON (auto-submits when braces close, Ctrl+C to cancel):\n");
  rl.prompt();

  const lines: string[] = [];
  let depth = 0;
  let started = false;
  let inBlockComment = false;
  let inString = false;
  let stringChar = "";

  return new Promise<unknown>((resolve, reject) => {
    rl.on("line", (line) => {
      lines.push(line);
      const result = trackDepth(line, depth, started, inBlockComment, inString, stringChar);
      depth = result.depth;
      started = result.started;
      inBlockComment = result.inBlockComment;
      inString = result.inString;
      stringChar = result.stringChar;

      if (started && depth <= 0) {
        rl.close();
        try {
          resolve(parseData(lines.join("\n")));
        } catch (err) {
          reject(err);
        }
      } else {
        rl.setPrompt("...  ");
        rl.prompt();
      }
    });

    rl.on("close", () => {
      if (lines.length > 0 && (!started || depth > 0)) {
        // EOF before balanced — attempt to parse what we have
        try {
          resolve(parseData(lines.join("\n")));
        } catch (err) {
          reject(err);
        }
      } else if (lines.length === 0) {
        reject(new Error("No input provided."));
      }
    });
  });
}

/**
 * Track brace/bracket depth for a line, respecting string literals and JSON5 comments.
 * String and block-comment state is passed in and returned to handle multi-line constructs.
 */
function trackDepth(
  line: string,
  depth: number,
  started: boolean,
  inBlockComment: boolean,
  inString: boolean,
  stringChar: string,
): { depth: number; started: boolean; inBlockComment: boolean; inString: boolean; stringChar: string } {

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = i + 1 < line.length ? line[i + 1] : "";

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      if (ch === "\\" && i + 1 < line.length) {
        i++; // skip escaped character
      } else if (ch === stringChar) {
        inString = false;
      }
      continue;
    }

    // Line comment — skip rest of line
    if (ch === "/" && next === "/") break;
    // Block comment start
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringChar = ch;
    } else if (ch === "{" || ch === "[") {
      depth++;
      started = true;
    } else if (ch === "}" || ch === "]") {
      depth--;
    }
  }

  return { depth, started, inBlockComment, inString, stringChar };
}
