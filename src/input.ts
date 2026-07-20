import JSON5 from "json5";
import { closeSync, createReadStream, openSync, readFileSync, readSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import type { Readable } from "node:stream";

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
  if (input !== undefined) {
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
 * One record produced by the streaming input readers used for bulk import.
 * `value` holds the parsed entity; `parseError` is set instead when the line
 * could not be parsed (the raw text is preserved either way).
 */
export interface EntityRecord {
  /** 1-based position: file line number for NDJSON, array index+1 for JSON arrays. */
  lineNumber: number;
  raw: string;
  value?: unknown;
  parseError?: string;
}

/** Guard against a single pathologically long line (e.g. a file with no newlines). */
const MAX_LINE_BYTES = 16 * 1024 * 1024;

/** Stream NDJSON records from a readable stream (one JSON value per line). */
export async function* streamNdjsonFrom(input: Readable): AsyncGenerator<EntityRecord> {
  const rl = createInterface({ input, crlfDelay: Infinity });
  let lineNumber = 0;
  for await (const line of rl) {
    lineNumber++;
    const trimmed = line.trim();
    if (trimmed === "") continue; // skip blank lines silently
    if (Buffer.byteLength(line) > MAX_LINE_BYTES) {
      yield { lineNumber, raw: "", parseError: `line exceeds max size (${MAX_LINE_BYTES} bytes)` };
      continue;
    }
    try {
      yield { lineNumber, raw: line, value: JSON.parse(trimmed) };
    } catch (err) {
      yield { lineNumber, raw: line, parseError: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Stream NDJSON records from a file path. */
export function streamNdjsonFile(filePath: string): AsyncGenerator<EntityRecord> {
  return streamNdjsonFrom(createReadStream(filePath, { encoding: "utf-8" }));
}

/**
 * Turn an already-parsed JSON array into EntityRecords (for `--format json`
 * inputs and small inline payloads). Not streaming: the whole array is in memory.
 */
export function recordsFromArray(data: unknown): EntityRecord[] {
  if (!Array.isArray(data)) {
    throw new Error("Expected a JSON array of entities.");
  }
  return data.map((value, i) => ({
    lineNumber: i + 1,
    raw: JSON.stringify(value),
    value,
  }));
}

/** Cheap fingerprint to detect that a resumed input file is the same file. */
export interface FileFingerprint {
  size: number;
  mtimeMs: number;
  /** sha256 of the first 64KiB — avoids a full re-read of huge files. */
  headHash: string;
}

const FINGERPRINT_HEAD_BYTES = 65536;

export function fileFingerprint(filePath: string): FileFingerprint {
  const st = statSync(filePath);
  const len = Math.min(FINGERPRINT_HEAD_BYTES, st.size);
  const buf = Buffer.alloc(len);
  const fd = openSync(filePath, "r");
  let read = 0;
  try {
    // readSync may return a short read; loop until the head is fully read so the
    // hash is deterministic (a short read would otherwise fold in zero padding).
    while (read < len) {
      const n = readSync(fd, buf, read, len - read, read);
      if (n === 0) break; // unexpected EOF
      read += n;
    }
  } finally {
    closeSync(fd);
  }
  return {
    size: st.size,
    mtimeMs: st.mtimeMs,
    headHash: createHash("sha256").update(buf.subarray(0, read)).digest("hex"),
  };
}

export function fingerprintsMatch(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.size === b.size && a.mtimeMs === b.mtimeMs && a.headHash === b.headHash;
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
  let cancelled = false;

  return new Promise<unknown>((resolve, reject) => {
    rl.on("SIGINT", () => {
      cancelled = true;
      rl.close();
    });

    rl.on("line", (line) => {
      lines.push(line);
      const result = trackDepth(line, depth, started, inBlockComment, inString, stringChar);
      depth = result.depth;
      started = result.started;
      inBlockComment = result.inBlockComment;
      inString = result.inString;
      stringChar = result.stringChar;

      if (started && depth <= 0 && !inBlockComment && !inString) {
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
      if (cancelled) {
        reject(new Error("Input cancelled."));
        return;
      }
      if (lines.length > 0 && (!started || depth > 0 || inBlockComment || inString)) {
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
