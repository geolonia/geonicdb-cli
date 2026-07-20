import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GdbClientError } from "../src/client.js";
import { BulkImporter, chunkRecords } from "../src/loader.js";
import type { ImporterOptions } from "../src/loader.js";
import type { EntityRecord, FileFingerprint } from "../src/input.js";

const noSleep = () => Promise.resolve();
const FP: FileFingerprint = { size: 100, mtimeMs: 1, headHash: "abc" };

function records(ids: string[]): EntityRecord[] {
  return ids.map((id, i) => ({ lineNumber: i + 1, raw: JSON.stringify({ id }), value: { id, type: "T" } }));
}

async function* fromArray(recs: EntityRecord[]): AsyncGenerator<EntityRecord> {
  for (const r of recs) yield r;
}

function baseOpts(overrides: Partial<ImporterOptions> = {}): ImporterOptions {
  return {
    mode: "upsert",
    format: "ndjson",
    batchSize: 100,
    maxBytes: 1_000_000,
    concurrency: 1,
    retries: 3,
    timeoutMs: 60_000,
    continueOnError: false,
    bisect: false,
    bisectMax: 8,
    sleep: noSleep,
    random: () => 0.5,
    ...overrides,
  };
}

function ok204() {
  return { status: 204, data: "" };
}

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "geonic-loader-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("chunkRecords", () => {
  async function collect(gen: AsyncGenerator<{ records: EntityRecord[]; startLine: number; endLine: number }>) {
    const out: { ids: string[]; startLine: number; endLine: number }[] = [];
    for await (const c of gen) {
      out.push({ ids: c.records.map((r) => (r.value as { id: string }).id), startLine: c.startLine, endLine: c.endLine });
    }
    return out;
  }

  it("splits by entity count", async () => {
    const chunks = await collect(
      chunkRecords(fromArray(records(["a", "b", "c", "d", "e"])), {
        batchSize: 2,
        maxBytes: 1_000_000,
        skipUntilLine: 0,
        isAborted: () => false,
        onParseError: () => {},
      }),
    );
    expect(chunks.map((c) => c.ids)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
    expect(chunks[0]).toMatchObject({ startLine: 1, endLine: 2 });
  });

  it("splits by byte size before count", async () => {
    // Each entity serializes to > maxBytes/2, so only one fits per chunk.
    const chunks = await collect(
      chunkRecords(fromArray(records(["aaaaaaaa", "bbbbbbbb", "cccccccc"])), {
        batchSize: 100,
        maxBytes: 40,
        skipUntilLine: 0,
        isAborted: () => false,
        onParseError: () => {},
      }),
    );
    expect(chunks).toHaveLength(3);
  });

  it("emits an oversize single record as its own chunk", async () => {
    const chunks = await collect(
      chunkRecords(fromArray(records(["x"])), {
        batchSize: 100,
        maxBytes: 1, // smaller than any record
        skipUntilLine: 0,
        isAborted: () => false,
        onParseError: () => {},
      }),
    );
    expect(chunks).toHaveLength(1);
    expect(chunks[0].ids).toEqual(["x"]);
  });

  it("skips records at or below skipUntilLine", async () => {
    const chunks = await collect(
      chunkRecords(fromArray(records(["a", "b", "c", "d"])), {
        batchSize: 2,
        maxBytes: 1_000_000,
        skipUntilLine: 2,
        isAborted: () => false,
        onParseError: () => {},
      }),
    );
    expect(chunks.map((c) => c.ids)).toEqual([["c", "d"]]);
  });

  it("diverts parse-error records to onParseError", async () => {
    const onParseError = vi.fn();
    const recs: EntityRecord[] = [
      { lineNumber: 1, raw: "{bad", parseError: "unexpected token" },
      { lineNumber: 2, raw: '{"id":"a"}', value: { id: "a" } },
    ];
    const chunks = await collect(
      chunkRecords(fromArray(recs), {
        batchSize: 10,
        maxBytes: 1_000_000,
        skipUntilLine: 0,
        isAborted: () => false,
        onParseError,
      }),
    );
    expect(onParseError).toHaveBeenCalledTimes(1);
    expect(chunks.map((c) => c.ids)).toEqual([["a"]]);
  });

  it("stops early when isAborted returns true", async () => {
    let aborted = false;
    const gen = chunkRecords(fromArray(records(["a", "b", "c", "d"])), {
      batchSize: 1,
      maxBytes: 1_000_000,
      skipUntilLine: 0,
      isAborted: () => aborted,
      onParseError: () => {},
    });
    const first = await gen.next();
    aborted = true;
    const second = await gen.next();
    expect(first.done).toBe(false);
    expect(second.done).toBe(true);
  });
});

describe("BulkImporter", () => {
  it("counts a fully successful load (204)", async () => {
    const client = { post: vi.fn().mockResolvedValue(ok204()) };
    const importer = new BulkImporter(client as never, baseOpts({ batchSize: 2 }));
    const result = await importer.run(fromArray(records(["a", "b", "c"])));
    expect(result).toMatchObject({ processed: 3, succeeded: 3, failed: 0, aborted: false });
    expect(client.post).toHaveBeenCalledTimes(2);
    expect(client.post).toHaveBeenCalledWith(
      "/entityOperations/upsert",
      expect.any(Array),
      undefined,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("passes options=replace for replace mode", async () => {
    const client = { post: vi.fn().mockResolvedValue(ok204()) };
    const importer = new BulkImporter(client as never, baseOpts({ mode: "replace" }));
    await importer.run(fromArray(records(["a"])));
    expect(client.post).toHaveBeenCalledWith(
      "/entityOperations/upsert",
      expect.any(Array),
      { options: "replace" },
      expect.anything(),
    );
  });

  it("classifies a 207 partial result and writes both error sinks", async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        status: 207,
        data: { created: ["a"], updated: [], errors: [{ entityId: "b", error: { detail: "dup" } }] },
      }),
    };
    const errorsOut = join(tmp, "failed.ndjson");
    const errorsLog = join(tmp, "errors.log");
    const importer = new BulkImporter(
      client as never,
      baseOpts({ continueOnError: true, errorsOutPath: errorsOut, errorsLogPath: errorsLog }),
    );
    const result = await importer.run(fromArray(records(["a", "b"])));
    expect(result).toMatchObject({ succeeded: 1, failed: 1 });
    expect(readFileSync(errorsOut, "utf-8").trim()).toBe(JSON.stringify({ id: "b", type: "T" }));
    const log = JSON.parse(readFileSync(errorsLog, "utf-8").trim());
    expect(log).toMatchObject({ entityId: "b", status: 207, reason: "dup" });
  });

  it("describes 207 errors that lack a string detail", async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        status: 207,
        data: { created: [], updated: [], errors: [{ entityId: "a", error: { code: 42 } }] },
      }),
    };
    const errorsLog = join(tmp, "errors.log");
    const importer = new BulkImporter(client as never, baseOpts({ continueOnError: true, errorsLogPath: errorsLog }));
    await importer.run(fromArray(records(["a"])));
    expect(readFileSync(errorsLog, "utf-8")).toContain("code");
  });

  it("stringifies a non-object failure reason", async () => {
    const client = { post: vi.fn().mockRejectedValue("string failure") };
    const errorsLog = join(tmp, "errors.log");
    const importer = new BulkImporter(client as never, baseOpts({ continueOnError: true, errorsLogPath: errorsLog }));
    await importer.run(fromArray(records(["a"])));
    expect(readFileSync(errorsLog, "utf-8")).toContain("string failure");
  });

  it("writes unaccounted records to errors-out when the server under-reports a 207", async () => {
    // Server returns 207 but neither confirms nor errors the entities.
    const client = { post: vi.fn().mockResolvedValue({ status: 207, data: { created: [], updated: [], errors: [] } }) };
    const errorsOut = join(tmp, "failed.ndjson");
    const importer = new BulkImporter(client as never, baseOpts({ continueOnError: true, errorsOutPath: errorsOut }));
    const result = await importer.run(fromArray(records(["a", "b"])));
    expect(result.failed).toBe(2);
    expect(readFileSync(errorsOut, "utf-8").trim().split("\n")).toHaveLength(2);
  });

  it("logs a server error whose entityId matches no input record", async () => {
    const client = {
      post: vi.fn().mockResolvedValue({
        status: 207,
        data: { created: ["a"], updated: [], errors: [{ entityId: "ghost", error: { detail: "orphan" } }] },
      }),
    };
    const errorsLog = join(tmp, "errors.log");
    const importer = new BulkImporter(client as never, baseOpts({ continueOnError: true, errorsLogPath: errorsLog }));
    const result = await importer.run(fromArray(records(["a"])));
    expect(result.succeeded).toBe(1);
    expect(readFileSync(errorsLog, "utf-8")).toContain("unmatched server error");
  });

  it("clamps a hostile Retry-After so no worker sleeps beyond the cooldown cap", async () => {
    // Fake clock so the injected sleep advances Date.now() (the cooldown loop
    // depends on time actually progressing).
    vi.useFakeTimers();
    vi.setSystemTime(0);
    try {
      const client = {
        post: vi
          .fn()
          .mockRejectedValueOnce(new GdbClientError("rate", 429, undefined, 1_000_000_000))
          .mockResolvedValue(ok204()),
      };
      const delays: number[] = [];
      const importer = new BulkImporter(
        client as never,
        baseOpts({
          batchSize: 1,
          sleep: (ms) => {
            delays.push(ms);
            vi.setSystemTime(Date.now() + ms);
            return Promise.resolve();
          },
        }),
      );
      await importer.run(fromArray(records(["a", "b"])));
      // Retry backoff clamps at 30s; shared cooldown clamps at 60s. Nothing near 1e9.
      expect(Math.max(...delays)).toBeLessThanOrEqual(60_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("records a whole 400 chunk as failed and stops by default", async () => {
    const client = { post: vi.fn().mockRejectedValue(new GdbClientError("bad", 400)) };
    const errorsOut = join(tmp, "failed.ndjson");
    const importer = new BulkImporter(client as never, baseOpts({ batchSize: 2, errorsOutPath: errorsOut }));
    const result = await importer.run(fromArray(records(["a", "b", "c", "d"])));
    expect(result.aborted).toBe(true);
    expect(result.failed).toBe(2); // only the first chunk was attempted before abort
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it("continues past failures with continueOnError", async () => {
    const client = { post: vi.fn().mockRejectedValue(new GdbClientError("bad", 400)) };
    const importer = new BulkImporter(client as never, baseOpts({ batchSize: 2, continueOnError: true }));
    const result = await importer.run(fromArray(records(["a", "b", "c", "d"])));
    expect(result.aborted).toBe(false);
    expect(result.failed).toBe(4);
    expect(client.post).toHaveBeenCalledTimes(2);
  });

  it("bisects a 400 chunk to isolate the offending entity", async () => {
    const client = {
      post: vi.fn().mockImplementation((_path, entities: { id: string }[]) => {
        if (entities.some((e) => e.id === "bad")) {
          return Promise.reject(new GdbClientError("bad", 400));
        }
        return Promise.resolve(ok204());
      }),
    };
    const errorsOut = join(tmp, "failed.ndjson");
    const importer = new BulkImporter(
      client as never,
      baseOpts({ batchSize: 4, bisect: true, continueOnError: true, errorsOutPath: errorsOut }),
    );
    const result = await importer.run(fromArray(records(["a", "b", "bad", "d"])));
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(1);
    expect(readFileSync(errorsOut, "utf-8").trim()).toBe(JSON.stringify({ id: "bad", type: "T" }));
  });

  it("stops bisecting at bisectMax depth", async () => {
    const client = { post: vi.fn().mockRejectedValue(new GdbClientError("bad", 400)) };
    const importer = new BulkImporter(
      client as never,
      baseOpts({ batchSize: 4, bisect: true, bisectMax: 0, continueOnError: true }),
    );
    const result = await importer.run(fromArray(records(["a", "b", "c", "d"])));
    // depth limit 0 → never splits → whole chunk fails once
    expect(result.failed).toBe(4);
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 then succeeds", async () => {
    const client = {
      post: vi
        .fn()
        .mockRejectedValueOnce(new GdbClientError("rate", 429, undefined, 5))
        .mockResolvedValue(ok204()),
    };
    const onRetry = vi.fn();
    const importer = new BulkImporter(client as never, baseOpts({ onRetry }));
    const result = await importer.run(fromArray(records(["a"])));
    expect(result.succeeded).toBe(1);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
  });

  it("retries a header-less 429 using the computed backoff for the shared cooldown", async () => {
    const client = {
      post: vi
        .fn()
        .mockRejectedValueOnce(new GdbClientError("rate", 429)) // no Retry-After
        .mockResolvedValue(ok204()),
    };
    const onRetry = vi.fn();
    const importer = new BulkImporter(client as never, baseOpts({ onRetry }));
    const result = await importer.run(fromArray(records(["a"])));
    expect(result.succeeded).toBe(1);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
  });

  it("records a chunk as failed when retries are exhausted", async () => {
    const client = { post: vi.fn().mockRejectedValue(new GdbClientError("boom", 503)) };
    const importer = new BulkImporter(client as never, baseOpts({ retries: 1, continueOnError: true }));
    const result = await importer.run(fromArray(records(["a"])));
    expect(result.failed).toBe(1);
    expect(client.post).toHaveBeenCalledTimes(2); // initial + 1 retry
  });

  it("handles parse-error records", async () => {
    const client = { post: vi.fn().mockResolvedValue(ok204()) };
    const errorsLog = join(tmp, "errors.log");
    const recs: EntityRecord[] = [
      { lineNumber: 1, raw: "{bad", parseError: "bad json" },
      { lineNumber: 2, raw: '{"id":"a"}', value: { id: "a", type: "T" } },
    ];
    const importer = new BulkImporter(
      client as never,
      baseOpts({ continueOnError: true, errorsLogPath: errorsLog }),
    );
    const result = await importer.run(fromArray(recs));
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(readFileSync(errorsLog, "utf-8")).toContain("parse error");
  });

  it("aborts on parse error in stop mode", async () => {
    const client = { post: vi.fn().mockResolvedValue(ok204()) };
    const recs: EntityRecord[] = [{ lineNumber: 1, raw: "{bad", parseError: "bad json" }];
    const importer = new BulkImporter(client as never, baseOpts());
    const result = await importer.run(fromArray(recs));
    expect(result.aborted).toBe(true);
    expect(client.post).not.toHaveBeenCalled();
  });

  describe("dry run", () => {
    it("plans without sending", async () => {
      const client = { post: vi.fn() };
      const importer = new BulkImporter(client as never, baseOpts({ dryRun: true, batchSize: 2 }));
      const result = await importer.run(fromArray(records(["a", "b", "c"])));
      expect(result.planned).toBe(3);
      expect(result.chunks).toBe(2);
      expect(client.post).not.toHaveBeenCalled();
    });

    it("counts parse errors as skipped in dry run", async () => {
      const client = { post: vi.fn() };
      const recs: EntityRecord[] = [
        { lineNumber: 1, raw: "{bad", parseError: "x" },
        { lineNumber: 2, raw: '{"id":"a"}', value: { id: "a" } },
      ];
      const importer = new BulkImporter(client as never, baseOpts({ dryRun: true }));
      const result = await importer.run(fromArray(recs));
      expect(result.planned).toBe(1);
      expect(result.skipped).toBe(1);
    });
  });

  describe("resume / checkpoint", () => {
    it("writes a checkpoint after each committed chunk", async () => {
      const client = { post: vi.fn().mockResolvedValue(ok204()) };
      const ckpt = join(tmp, "run.ckpt");
      const importer = new BulkImporter(
        client as never,
        baseOpts({ batchSize: 2, resumePath: ckpt, fingerprint: FP }),
      );
      await importer.run(fromArray(records(["a", "b", "c", "d"])));
      const cp = JSON.parse(readFileSync(ckpt, "utf-8"));
      expect(cp).toMatchObject({ mode: "upsert", format: "ndjson", committedLines: 4 });
      expect(cp.fingerprint).toEqual(FP);
    });

    it("skips already-committed lines on resume", async () => {
      const client = { post: vi.fn().mockResolvedValue(ok204()) };
      const ckpt = join(tmp, "run.ckpt");
      writeFileSync(
        ckpt,
        JSON.stringify({ version: 1, fingerprint: FP, mode: "upsert", format: "ndjson", batchSize: 2, committedLines: 2 }),
      );
      const importer = new BulkImporter(
        client as never,
        baseOpts({ batchSize: 2, resumePath: ckpt, fingerprint: FP }),
      );
      const result = await importer.run(fromArray(records(["a", "b", "c", "d"])));
      expect(result.succeeded).toBe(2); // only c, d
      expect(client.post).toHaveBeenCalledTimes(1);
    });

    it("refuses to resume when the file fingerprint differs", async () => {
      const client = { post: vi.fn() };
      const ckpt = join(tmp, "run.ckpt");
      writeFileSync(
        ckpt,
        JSON.stringify({ version: 1, fingerprint: { size: 9, mtimeMs: 9, headHash: "zzz" }, mode: "upsert", format: "ndjson", batchSize: 2, committedLines: 2 }),
      );
      const importer = new BulkImporter(client as never, baseOpts({ resumePath: ckpt, fingerprint: FP }));
      await expect(importer.run(fromArray(records(["a"])))).rejects.toThrow(/input file differs/);
    });

    it("refuses to resume when mode/format differ", async () => {
      const client = { post: vi.fn() };
      const ckpt = join(tmp, "run.ckpt");
      writeFileSync(
        ckpt,
        JSON.stringify({ version: 1, fingerprint: FP, mode: "replace", format: "ndjson", batchSize: 2, committedLines: 2 }),
      );
      const importer = new BulkImporter(client as never, baseOpts({ resumePath: ckpt, fingerprint: FP }));
      await expect(importer.run(fromArray(records(["a"])))).rejects.toThrow(/mode\/format/);
    });

    it("starts fresh when no checkpoint file exists yet", async () => {
      const client = { post: vi.fn().mockResolvedValue(ok204()) };
      const ckpt = join(tmp, "absent.ckpt");
      const importer = new BulkImporter(client as never, baseOpts({ resumePath: ckpt, fingerprint: FP }));
      const result = await importer.run(fromArray(records(["a"])));
      expect(result.succeeded).toBe(1);
    });
  });

  describe("concurrency", () => {
    it("processes all chunks and advances the checkpoint contiguously despite out-of-order completion", async () => {
      // First chunk resolves slower than the second → completion order is reversed.
      const client = {
        post: vi.fn().mockImplementation((_p, entities: { id: string }[]) => {
          const delay = entities.some((e) => e.id === "a") ? 20 : 1;
          return new Promise((resolve) => setTimeout(() => resolve(ok204()), delay));
        }),
      };
      const ckpt = join(tmp, "c.ckpt");
      const importer = new BulkImporter(
        client as never,
        baseOpts({ batchSize: 1, concurrency: 3, resumePath: ckpt, fingerprint: FP }),
      );
      const result = await importer.run(fromArray(records(["a", "b", "c"])));
      expect(result.succeeded).toBe(3);
      expect(JSON.parse(readFileSync(ckpt, "utf-8")).committedLines).toBe(3);
    });
  });
});
