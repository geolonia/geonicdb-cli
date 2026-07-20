import { createWriteStream, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { WriteStream } from "node:fs";
import type { GdbClient } from "./client.js";
import { GdbClientError } from "./client.js";
import { withRetry } from "./retry.js";
import { fingerprintsMatch } from "./input.js";
import type { EntityRecord, FileFingerprint } from "./input.js";

export type ImportMode = "upsert" | "replace";
export type InputFormat = "ndjson" | "json";

export interface ImporterOptions {
  mode: ImportMode;
  format: InputFormat;
  batchSize: number;
  maxBytes: number;
  concurrency: number;
  retries: number;
  timeoutMs: number;
  continueOnError: boolean;
  bisect: boolean;
  bisectMax: number;
  dryRun?: boolean;
  /** Checkpoint file for resume; requires a file input (fingerprint) and upsert mode. */
  resumePath?: string;
  errorsOutPath?: string;
  errorsLogPath?: string;
  /** Present only for file input — enables resume and same-file verification. */
  fingerprint?: FileFingerprint;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  onProgress?: (p: ImportProgress) => void;
  onRetry?: (info: { attempt: number; delayMs: number; status?: number }) => void;
}

export interface ImportProgress {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  chunks: number;
}

export interface ImportResult extends ImportProgress {
  aborted: boolean;
  /** For dry-run: number of entities that would be sent (no request made). */
  planned?: number;
}

interface Chunk {
  index: number;
  records: EntityRecord[];
  startLine: number;
  endLine: number;
}

interface Checkpoint {
  version: 1;
  fingerprint: FileFingerprint;
  mode: ImportMode;
  format: InputFormat;
  batchSize: number;
  committedLines: number;
}

/** Server 207 Multi-Status body shape for batch upsert. */
interface MultiStatusBody {
  created?: string[];
  updated?: string[];
  errors?: { entityId: string; error?: unknown }[];
}

/** Upper bound for a single shared cooldown, so a hostile Retry-After can't stall for hours. */
const MAX_COOLDOWN_MS = 60_000;

/**
 * Process-wide rate-limit cooldown. When any request is 429/503'd, all workers pause
 * until the shared deadline so we don't keep hammering the server (429 storm).
 */
class SharedCooldown {
  private until = 0;
  note(ms: number): void {
    this.until = Math.max(this.until, Date.now() + Math.min(ms, MAX_COOLDOWN_MS));
  }
  async wait(sleep: (ms: number) => Promise<void>): Promise<void> {
    // Loop: another worker may extend `until` while we sleep.
    for (let remaining = this.until - Date.now(); remaining > 0; remaining = this.until - Date.now()) {
      await sleep(remaining);
    }
  }
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function entityId(value: unknown): string | undefined {
  if (value && typeof value === "object" && typeof (value as Record<string, unknown>).id === "string") {
    return (value as Record<string, unknown>).id as string;
  }
  return undefined;
}

/**
 * Client-driven bulk loader. Streams records, chunks them (by count AND bytes),
 * sends each chunk to the batch upsert endpoint with retry/backoff, classifies
 * 204/207/400 outcomes, writes failures to re-submittable NDJSON + a detail log,
 * and checkpoints progress for resume.
 */
export class BulkImporter {
  private counts: ImportProgress = { processed: 0, succeeded: 0, failed: 0, skipped: 0, chunks: 0 };
  private aborted = false;
  private cooldown = new SharedCooldown();
  private sleep: (ms: number) => Promise<void>;
  private random: () => number;
  private errorsOut?: WriteStream;
  private errorsLog?: WriteStream;
  private sinkError?: Error;
  // Contiguous checkpoint tracking (chunks may complete out of order under concurrency).
  private committedLines = 0;
  private nextExpected = 0;
  private pendingEnds = new Map<number, number>();

  constructor(
    // Optional: a dry-run never sends, so no client is required.
    private readonly client: GdbClient | undefined,
    private readonly opts: ImporterOptions,
  ) {
    this.sleep = opts.sleep ?? defaultSleep;
    this.random = opts.random ?? Math.random;
  }

  async run(source: AsyncIterable<EntityRecord>): Promise<ImportResult> {
    const skipUntilLine = this.initCheckpoint();

    if (this.opts.dryRun) {
      return this.planDryRun(source, skipUntilLine);
    }

    const appendErrors = skipUntilLine > 0;
    this.openErrorSinks(appendErrors);
    try {
      const chunks = chunkRecords(source, {
        batchSize: this.opts.batchSize,
        maxBytes: this.opts.maxBytes,
        skipUntilLine,
        isAborted: () => this.aborted,
        onParseError: (r) => this.handleParseError(r),
      });
      await this.runPool(chunks);
    } finally {
      await this.closeErrorSinks();
    }

    if (this.sinkError) throw this.sinkError; // a failed error-file write must not pass silently
    return { ...this.counts, aborted: this.aborted };
  }

  // ---- checkpoint ----------------------------------------------------------

  private initCheckpoint(): number {
    if (!this.opts.resumePath) return 0;
    if (!existsSync(this.opts.resumePath)) return 0;
    const cp = JSON.parse(readFileSync(this.opts.resumePath, "utf-8")) as Checkpoint;
    if (!this.opts.fingerprint || !fingerprintsMatch(cp.fingerprint, this.opts.fingerprint)) {
      throw new Error(
        "Resume aborted: the input file differs from the one recorded in the checkpoint.",
      );
    }
    if (cp.mode !== this.opts.mode || cp.format !== this.opts.format) {
      throw new Error(
        `Resume aborted: checkpoint mode/format (${cp.mode}/${cp.format}) does not match current (${this.opts.mode}/${this.opts.format}).`,
      );
    }
    this.committedLines = cp.committedLines;
    return cp.committedLines;
  }

  private writeCheckpoint(): void {
    if (!this.opts.resumePath || !this.opts.fingerprint) return;
    const cp: Checkpoint = {
      version: 1,
      fingerprint: this.opts.fingerprint,
      mode: this.opts.mode,
      format: this.opts.format,
      batchSize: this.opts.batchSize,
      committedLines: this.committedLines,
    };
    const tmp = `${this.opts.resumePath}.tmp`;
    writeFileSync(tmp, JSON.stringify(cp));
    renameSync(tmp, this.opts.resumePath); // atomic replace
  }

  // ---- dry run -------------------------------------------------------------

  private async planDryRun(source: AsyncIterable<EntityRecord>, skipUntilLine: number): Promise<ImportResult> {
    let planned = 0;
    let chunks = 0;
    for await (const chunk of chunkRecords(source, {
      batchSize: this.opts.batchSize,
      maxBytes: this.opts.maxBytes,
      skipUntilLine,
      isAborted: () => false,
      onParseError: () => {
        this.counts.skipped++;
      },
    })) {
      planned += chunk.records.length;
      chunks++;
    }
    this.counts.chunks = chunks;
    return { ...this.counts, aborted: false, planned };
  }

  // ---- concurrency pool ----------------------------------------------------

  private async runPool(chunks: AsyncIterable<Chunk>): Promise<void> {
    const concurrency = Math.max(1, this.opts.concurrency);
    const inFlight = new Set<Promise<void>>();
    for await (const chunk of chunks) {
      if (this.aborted) break;
      const p = this.processChunk(chunk).finally(() => inFlight.delete(p));
      inFlight.add(p);
      if (inFlight.size >= concurrency) await Promise.race(inFlight);
    }
    await Promise.all(inFlight);
  }

  private async processChunk(chunk: Chunk): Promise<void> {
    const failedBefore = this.counts.failed;
    await this.processGroup(chunk.records, 0);
    // Only the chunk that actually failed is left uncommitted (resume retries it).
    // A chunk that itself succeeded is committed even if another concurrent chunk
    // aborted — otherwise resume would needlessly re-send it.
    const thisChunkFailed = this.counts.failed > failedBefore;
    if (thisChunkFailed && !this.opts.continueOnError) {
      this.aborted = true;
      return;
    }
    // A chunk skipped because an abort was already in flight isn't a real commit.
    if (chunk.records.length === 0) return;
    this.counts.chunks++;
    this.pendingEnds.set(chunk.index, chunk.endLine);
    while (this.pendingEnds.has(this.nextExpected)) {
      this.committedLines = this.pendingEnds.get(this.nextExpected)!;
      this.pendingEnds.delete(this.nextExpected);
      this.nextExpected++;
    }
    this.writeCheckpoint();
    this.reportProgress();
  }

  // ---- send + classify -----------------------------------------------------

  private async processGroup(records: EntityRecord[], depth: number): Promise<void> {
    if (this.aborted || records.length === 0) return;
    await this.cooldown.wait(this.sleep);
    // Another (concurrent) chunk may have aborted while we waited on the cooldown.
    if (this.aborted) return;

    let response;
    try {
      response = await withRetry(() => this.send(records), {
        retries: this.opts.retries,
        sleep: this.sleep,
        random: this.random,
        onRetry: (info) => {
          // A rate-limit signal (429/503) pauses ALL workers via the shared cooldown,
          // honoring Retry-After when present and falling back to the computed backoff
          // otherwise — so a header-less 429 storm is still throttled process-wide.
          if (info.error instanceof GdbClientError && (info.error.status === 429 || info.error.status === 503)) {
            this.cooldown.note(info.error.retryAfterMs ?? info.delayMs);
          }
          const status = info.error instanceof GdbClientError ? info.error.status : undefined;
          this.opts.onRetry?.({ attempt: info.attempt, delayMs: info.delayMs, status });
        },
      });
    } catch (err) {
      await this.handleSendFailure(records, err, depth);
      return;
    }
    this.handleResponse(records, response);
  }

  private async send(records: EntityRecord[]) {
    /* istanbul ignore next -- guarded: send() is never reached in dry-run */
    if (!this.client) throw new Error("No client configured for sending.");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeoutMs);
    try {
      return await this.client.post(
        "/entityOperations/upsert",
        records.map((r) => r.value),
        this.opts.mode === "replace" ? { options: "replace" } : undefined,
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private handleResponse(records: EntityRecord[], response: { status: number; data: unknown }): void {
    this.counts.processed += records.length;

    if (response.status === 207) {
      this.handleMultiStatus(records, (response.data ?? {}) as MultiStatusBody);
      return;
    }

    // 201/204/200 — whole chunk succeeded.
    this.counts.succeeded += records.length;
  }

  /**
   * Reconcile a 207 against the chunk *by record*, not by trusting the server's error
   * list alone. Anything not confirmed created/updated is treated as failed and written
   * to the re-submittable errors file — so id normalization or an under-reporting server
   * can never silently drop an entity.
   */
  private handleMultiStatus(records: EntityRecord[], body: MultiStatusBody): void {
    const succeededIds = new Set<string>([...(body.created ?? []), ...(body.updated ?? [])]);
    const errorById = new Map((body.errors ?? []).map((e) => [e.entityId, e] as const));

    for (const record of records) {
      const id = entityId(record.value);
      if (id !== undefined && succeededIds.has(id)) {
        this.counts.succeeded++;
        continue;
      }
      // Not confirmed as succeeded → failed. Prefer the server's reason when it maps.
      this.counts.failed++;
      const matched = id !== undefined ? errorById.get(id) : undefined;
      const reason = matched ? describeError(matched.error) : "not confirmed in 207 response";
      this.writeError(record, 207, reason);
    }
    // Surface any server error whose id matched no input record (never silently dropped).
    for (const e of body.errors ?? []) {
      if (!records.some((r) => entityId(r.value) === e.entityId)) {
        this.writeErrorLogOnly(
          { lineNumber: -1, raw: "", value: { id: e.entityId } },
          207,
          `unmatched server error: ${describeError(e.error)}`,
        );
      }
    }
    // Abort decision is owned by processChunk (based on the per-chunk failure delta).
  }

  private async handleSendFailure(records: EntityRecord[], err: unknown, depth: number): Promise<void> {
    const status = err instanceof GdbClientError ? err.status : undefined;
    const splittable = status === 400 || status === 413;
    if (this.opts.bisect && splittable && records.length > 1 && depth < this.opts.bisectMax) {
      const mid = Math.floor(records.length / 2);
      await this.processGroup(records.slice(0, mid), depth + 1);
      await this.processGroup(records.slice(mid), depth + 1);
      return;
    }
    // Leaf failure: the whole group failed. (Abort decision is owned by processChunk.)
    this.counts.processed += records.length;
    this.counts.failed += records.length;
    const reason = err instanceof Error ? err.message : String(err);
    for (const r of records) this.writeError(r, status, reason);
  }

  private handleParseError(record: EntityRecord): void {
    this.counts.processed++;
    this.counts.failed++;
    this.writeErrorLogOnly(record, undefined, `parse error: ${record.parseError}`);
    if (!this.opts.continueOnError) this.aborted = true;
  }

  // ---- error sinks ---------------------------------------------------------

  private openErrorSinks(append: boolean): void {
    const flags = append ? "a" : "w";
    const capture = (stream: WriteStream): WriteStream => {
      // Attach an error listener immediately so a mid-run write failure (disk full,
      // permissions) is captured instead of crashing the process as an uncaught error.
      stream.on("error", (err) => {
        this.sinkError ??= err instanceof Error ? err : new Error(String(err));
      });
      return stream;
    };
    if (this.opts.errorsOutPath) this.errorsOut = capture(createWriteStream(this.opts.errorsOutPath, { flags }));
    if (this.opts.errorsLogPath) this.errorsLog = capture(createWriteStream(this.opts.errorsLogPath, { flags }));
  }

  private writeError(record: EntityRecord, status: number | undefined, reason: string): void {
    if (this.errorsOut && record.value !== undefined) {
      this.errorsOut.write(JSON.stringify(record.value) + "\n");
    }
    this.writeErrorLogOnly(record, status, reason);
  }

  private writeErrorLogOnly(record: EntityRecord, status: number | undefined, reason: string): void {
    if (!this.errorsLog) return;
    this.errorsLog.write(
      JSON.stringify({
        lineNumber: record.lineNumber,
        entityId: entityId(record.value),
        status,
        reason,
      }) + "\n",
    );
  }

  private async closeErrorSinks(): Promise<void> {
    await Promise.all([closeStream(this.errorsOut), closeStream(this.errorsLog)]);
  }

  private reportProgress(): void {
    this.opts.onProgress?.({ ...this.counts });
  }
}

function describeError(error: unknown): string {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const detail = e.detail ?? e.title ?? e.description;
    if (typeof detail === "string") return detail;
    return JSON.stringify(error);
  }
  return String(error);
}

function closeStream(stream?: WriteStream): Promise<void> {
  if (!stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    stream.on("error", reject);
    stream.end(resolve);
  });
}

/**
 * Chunk a record stream by BOTH entity count and serialized byte size. A single
 * record larger than maxBytes becomes its own (over-size) chunk. Parse-error
 * records are diverted to onParseError and never enter a chunk.
 */
export async function* chunkRecords(
  source: AsyncIterable<EntityRecord>,
  opts: {
    batchSize: number;
    maxBytes: number;
    skipUntilLine: number;
    isAborted: () => boolean;
    onParseError: (record: EntityRecord) => void;
  },
): AsyncGenerator<Chunk> {
  let buf: EntityRecord[] = [];
  const BRACKET_OVERHEAD = 2; // the enclosing "[" and "]" of the JSON array body
  let bytes = BRACKET_OVERHEAD;
  let index = 0;

  const makeChunk = (): Chunk => ({
    index: index++,
    records: buf,
    startLine: buf[0].lineNumber,
    endLine: buf[buf.length - 1].lineNumber,
  });

  for await (const rec of source) {
    if (opts.isAborted()) return;
    if (rec.lineNumber <= opts.skipUntilLine) continue;
    if (rec.parseError !== undefined) {
      opts.onParseError(rec);
      continue;
    }
    const size = Buffer.byteLength(JSON.stringify(rec.value)) + 1; // +1 for the "," separator
    if (buf.length > 0 && (buf.length >= opts.batchSize || bytes + size > opts.maxBytes)) {
      yield makeChunk();
      buf = [];
      bytes = BRACKET_OVERHEAD;
    }
    buf.push(rec);
    bytes += size;
  }
  if (buf.length > 0) yield makeChunk();
}
