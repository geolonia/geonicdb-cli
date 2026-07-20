import { Command, InvalidArgumentError } from "commander";
import { createClient, resolveOptions, withErrorHandler } from "../helpers.js";
import {
  fileFingerprint,
  parseJsonInput,
  recordsFromArray,
  streamNdjsonFile,
  streamNdjsonFrom,
} from "../input.js";
import type { EntityRecord, FileFingerprint } from "../input.js";
import { BulkImporter } from "../loader.js";
import type { ImportMode, ImporterOptions, InputFormat } from "../loader.js";
import { printError, printInfo, printSuccess, printWarning } from "../output.js";
import { addExamples } from "./help.js";

interface ImportCliOptions {
  inputFormat: InputFormat;
  mode: ImportMode;
  batchSize: number;
  maxBytes: number;
  concurrency: number;
  retries: number;
  timeout: number;
  continueOnError?: boolean;
  resume?: string;
  errorsOut?: string;
  errorsLog?: string;
  bisect?: boolean;
  bisectMax: number;
}

function parsePositiveInt(value: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new InvalidArgumentError("Must be a positive integer.");
  }
  return Number(value);
}

function parseMode(value: string): ImportMode {
  if (value !== "upsert" && value !== "replace") {
    throw new InvalidArgumentError("Must be 'upsert' or 'replace'.");
  }
  return value;
}

function parseInputFormat(value: string): InputFormat {
  if (value !== "ndjson" && value !== "json") {
    throw new InvalidArgumentError("Must be 'ndjson' or 'json'.");
  }
  return value;
}

async function* fromArray(records: EntityRecord[]): AsyncGenerator<EntityRecord> {
  for (const record of records) yield record;
}

/**
 * Resolve the input into a record stream. File paths are resume-capable (they
 * carry a fingerprint); stdin is not.
 */
async function buildSource(
  fileArg: string | undefined,
  inputFormat: InputFormat,
): Promise<{ source: AsyncIterable<EntityRecord>; fingerprint?: FileFingerprint }> {
  const isStdin = fileArg === undefined || fileArg === "-";
  const path = fileArg?.startsWith("@") ? fileArg.slice(1) : fileArg;

  if (inputFormat === "ndjson") {
    if (isStdin) return { source: streamNdjsonFrom(process.stdin) };
    return { source: streamNdjsonFile(path!), fingerprint: fileFingerprint(path!) };
  }

  // JSON array format — parsed fully into memory (not streaming).
  const data = await parseJsonInput(isStdin ? "-" : `@${path}`);
  const records = recordsFromArray(data);
  return {
    source: fromArray(records),
    fingerprint: isStdin ? undefined : fileFingerprint(path!),
  };
}

export function registerImportCommand(program: Command): void {
  const cmd = program
    .command("import [file]")
    .summary("Bulk-load entities from a file, chunked with retry/resume")
    .description(
      "Bulk-load NGSI-LD entities past the 29s API Gateway limit by chunking the input\n" +
        "into batch-upsert requests with retry, resume, and per-entity error reporting.\n\n" +
        "Input: an NDJSON file (one entity per line, default) or a JSON array (--input-format json).\n" +
        "Use '-' or a pipe for stdin (resume is not available for stdin).",
    )
    .option("--input-format <fmt>", "Input format: ndjson (default) or json", parseInputFormat, "ndjson")
    .option("--mode <mode>", "upsert (merge, default) or replace", parseMode, "upsert")
    .option("--batch-size <n>", "Entities per request (default 100; must not exceed your plan's max batch size)", parsePositiveInt, 100)
    .option("--max-bytes <n>", "Max request body bytes per chunk", parsePositiveInt, 1_000_000)
    .option("--concurrency <n>", "Concurrent requests (default 1 = sequential)", parsePositiveInt, 1)
    .option("--retries <n>", "Max retries per chunk on 429/5xx/timeout", parsePositiveInt, 5)
    .option("--timeout <ms>", "Per-request timeout in ms", parsePositiveInt, 60_000)
    .option("--continue-on-error", "Keep going after failures (default: stop)")
    .option("--resume <checkpoint>", "Checkpoint file for resumable loads (upsert + file input only)")
    .option("--errors-out <file>", "Write failed entities as re-submittable NDJSON")
    .option("--errors-log <file>", "Write failure details (reason/status/line) as NDJSON")
    .option("--bisect", "On a 400/413 chunk, binary-split to isolate the offending entity")
    .option("--bisect-max <n>", "Max bisect depth", parsePositiveInt, 8)
    .action(
      withErrorHandler(async (file: string | undefined, _opts: unknown, command: Command) => {
        const cli = command.optsWithGlobals() as ImportCliOptions;
        const resolved = resolveOptions(command);
        const isStdin = file === undefined || file === "-";

        // Validate resume constraints up front, before consuming any input.
        if (cli.resume && cli.mode === "replace") {
          printError("--resume is only supported with --mode upsert (replace re-sends overwrite latest state).");
          process.exit(1);
        }
        if (cli.resume && isStdin) {
          printError("--resume requires a file input; stdin cannot be resumed.");
          process.exit(1);
        }

        const { source, fingerprint } = await buildSource(file, cli.inputFormat);

        if (cli.mode === "replace") {
          printWarning(
            "replace mode: re-sent chunks overwrite the latest server state, and retries/resume are at-least-once. Proceed with care.",
          );
        }
        if (cli.continueOnError && !cli.errorsOut) {
          printWarning(
            "--continue-on-error without --errors-out: failed entities won't be captured for re-submission.",
          );
        }

        // A dry-run only plans chunks — no client (and no configured URL) required.
        const client = resolved.dryRun ? undefined : createClient(command);
        const importerOpts: ImporterOptions = {
          mode: cli.mode,
          format: cli.inputFormat,
          batchSize: cli.batchSize,
          maxBytes: cli.maxBytes,
          concurrency: cli.concurrency,
          retries: cli.retries,
          timeoutMs: cli.timeout,
          continueOnError: cli.continueOnError ?? false,
          bisect: cli.bisect ?? false,
          bisectMax: cli.bisectMax,
          dryRun: resolved.dryRun,
          resumePath: cli.resume,
          errorsOutPath: cli.errorsOut,
          errorsLogPath: cli.errorsLog,
          fingerprint,
          onProgress: makeProgressReporter(resolved.verbose ?? false),
          onRetry: resolved.verbose
            ? (info) =>
                process.stderr.write(
                  `retry #${info.attempt} in ${Math.round(info.delayMs)}ms${info.status ? ` (status ${info.status})` : ""}\n`,
                )
            : undefined,
        };

        const importer = new BulkImporter(client, importerOpts);
        const result = await importer.run(source);

        if (resolved.dryRun) {
          printInfo(
            `dry-run: would send ${result.planned ?? 0} entities in ${result.chunks} chunk(s) ` +
              `(batch-size=${cli.batchSize}, max-bytes=${cli.maxBytes}, mode=${cli.mode}).`,
          );
          return;
        }

        finishProgressLine();
        printSummary(result, importerOpts);

        if (result.aborted) {
          printWarning("Stopped at the first failure. Use --continue-on-error to process the rest.");
        }
        if (result.failed > 0 || result.aborted) {
          process.exitCode = 1;
        }
      }),
    );

  addExamples(cmd, [
    {
      description: "Load an NDJSON file",
      command: "geonic import entities.ndjson",
    },
    {
      description: "Resumable load with error capture",
      command:
        "geonic import entities.ndjson --resume .import.ckpt --errors-out failed.ndjson --errors-log errors.log",
    },
    {
      description: "Re-submit only the failed entities",
      command: "geonic import failed.ndjson",
    },
    {
      description: "Preview the plan without sending",
      command: "geonic import entities.ndjson --dry-run",
    },
  ]);
}

function makeProgressReporter(verbose: boolean): ImporterOptions["onProgress"] {
  const isTty = process.stderr.isTTY ?? false;
  return (p) => {
    if (isTty) {
      process.stderr.write(
        `\rprocessed=${p.processed} ok=${p.succeeded} failed=${p.failed} skipped=${p.skipped} chunks=${p.chunks}`,
      );
    } else if (verbose) {
      process.stderr.write(
        `processed=${p.processed} ok=${p.succeeded} failed=${p.failed} chunks=${p.chunks}\n`,
      );
    }
  };
}

function finishProgressLine(): void {
  if (process.stderr.isTTY) process.stderr.write("\n");
}

function printSummary(
  result: { processed: number; succeeded: number; failed: number; skipped: number; chunks: number },
  opts: ImporterOptions,
): void {
  const line =
    `Imported: ${result.succeeded} succeeded, ${result.failed} failed, ` +
    `${result.skipped} skipped across ${result.chunks} chunk(s).`;
  if (result.failed === 0 && result.skipped === 0) {
    printSuccess(line);
  } else {
    printWarning(line);
    if (opts.errorsOutPath) printInfo(`Failed entities written to ${opts.errorsOutPath} (re-run to retry).`);
    if (opts.errorsLogPath) printInfo(`Failure details written to ${opts.errorsLogPath}.`);
  }
}
