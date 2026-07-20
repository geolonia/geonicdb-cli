import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const ctorSpy = vi.fn();
const runMock = vi.fn();
vi.mock("../src/loader.js", () => ({
  BulkImporter: class {
    run = runMock;
    constructor(client: unknown, opts: unknown) {
      ctorSpy(client, opts);
    }
  },
}));

vi.mock("../src/input.js", () => ({
  streamNdjsonFile: vi.fn(() => "FILE_SRC"),
  streamNdjsonFrom: vi.fn(() => "STDIN_SRC"),
  fileFingerprint: vi.fn(() => ({ size: 1, mtimeMs: 2, headHash: "h" })),
  parseJsonInput: vi.fn(async () => [{ id: "a" }]),
  recordsFromArray: vi.fn(() => [{ lineNumber: 1, raw: "{}", value: { id: "a" } }]),
}));

const resolveOptionsMock = vi.fn();
vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(() => ({})),
  resolveOptions: (...args: unknown[]) => resolveOptionsMock(...args),
  withErrorHandler: (fn: (...a: unknown[]) => unknown) => fn,
}));

vi.mock("../src/output.js", () => ({
  printError: vi.fn(),
  printInfo: vi.fn(),
  printSuccess: vi.fn(),
  printWarning: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({ addExamples: vi.fn() }));

import { registerImportCommand } from "../src/commands/import.js";
import { createTestProgram, runCommand } from "./test-helpers.js";
import * as output from "../src/output.js";
import { createClient } from "../src/helpers.js";

const okResult = { processed: 1, succeeded: 1, failed: 0, skipped: 0, chunks: 1, aborted: false };

describe("import command", () => {
  let program: ReturnType<typeof createTestProgram>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    vi.clearAllMocks();
    resolveOptionsMock.mockReturnValue({ dryRun: false, verbose: false });
    runMock.mockResolvedValue(okResult);
    program = createTestProgram(registerImportCommand);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    process.exitCode = undefined;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it("imports an NDJSON file and passes parsed flags to the loader", async () => {
    await runCommand(program, ["import", "data.ndjson", "--batch-size", "50", "--concurrency", "2"]);
    expect(ctorSpy).toHaveBeenCalledTimes(1);
    const opts = ctorSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(opts).toMatchObject({
      mode: "upsert",
      format: "ndjson",
      batchSize: 50,
      concurrency: 2,
      fingerprint: { size: 1, mtimeMs: 2, headHash: "h" },
    });
    expect(runMock).toHaveBeenCalledWith("FILE_SRC");
    expect(output.printSuccess).toHaveBeenCalled();
  });

  it("uses stdin (no fingerprint) for '-'", async () => {
    await runCommand(program, ["import", "-"]);
    const opts = ctorSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.fingerprint).toBeUndefined();
    expect(runMock).toHaveBeenCalledWith("STDIN_SRC");
  });

  it("parses a JSON array with --input-format json", async () => {
    await runCommand(program, ["import", "data.json", "--input-format", "json"]);
    const opts = ctorSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(opts.format).toBe("json");
  });

  it("rejects --resume with --mode replace", async () => {
    await expect(
      runCommand(program, ["import", "data.ndjson", "--resume", "ck", "--mode", "replace"]),
    ).rejects.toThrow("exit:1");
    expect(output.printError).toHaveBeenCalledWith(expect.stringContaining("upsert"));
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("rejects --resume with stdin input", async () => {
    await expect(runCommand(program, ["import", "-", "--resume", "ck"])).rejects.toThrow("exit:1");
    expect(output.printError).toHaveBeenCalledWith(expect.stringContaining("stdin"));
  });

  it("warns in replace mode", async () => {
    await runCommand(program, ["import", "data.ndjson", "--mode", "replace"]);
    expect(output.printWarning).toHaveBeenCalledWith(expect.stringContaining("replace mode"));
  });

  it("warns when --continue-on-error is used without --errors-out", async () => {
    await runCommand(program, ["import", "data.ndjson", "--continue-on-error"]);
    expect(output.printWarning).toHaveBeenCalledWith(expect.stringContaining("won't be captured"));
  });

  it("prints a dry-run plan and does not set a failing exit code", async () => {
    resolveOptionsMock.mockReturnValue({ dryRun: true, verbose: false });
    runMock.mockResolvedValue({ ...okResult, planned: 5, chunks: 2, succeeded: 0 });
    await runCommand(program, ["import", "data.ndjson"]);
    expect(output.printInfo).toHaveBeenCalledWith(expect.stringContaining("would send 5 entities"));
    expect(process.exitCode).toBeUndefined();
    // Dry-run must not require a configured client/URL.
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sets a failing exit code when entities fail", async () => {
    runMock.mockResolvedValue({ processed: 3, succeeded: 1, failed: 2, skipped: 0, chunks: 1, aborted: false });
    await runCommand(program, ["import", "data.ndjson", "--continue-on-error"]);
    expect(process.exitCode).toBe(1);
    expect(output.printWarning).toHaveBeenCalled();
  });

  it("warns and fails when the run was aborted", async () => {
    runMock.mockResolvedValue({ processed: 2, succeeded: 1, failed: 1, skipped: 0, chunks: 1, aborted: true });
    await runCommand(program, ["import", "data.ndjson"]);
    expect(process.exitCode).toBe(1);
    expect(output.printWarning).toHaveBeenCalledWith(expect.stringContaining("first failure"));
  });
});
