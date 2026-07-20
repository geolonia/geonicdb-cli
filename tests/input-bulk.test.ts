import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import {
  fileFingerprint,
  fingerprintsMatch,
  recordsFromArray,
  streamNdjsonFile,
  streamNdjsonFrom,
} from "../src/input.js";
import type { EntityRecord } from "../src/input.js";

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "geonic-input-"));
});
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

async function drain(gen: AsyncGenerator<EntityRecord>): Promise<EntityRecord[]> {
  const out: EntityRecord[] = [];
  for await (const r of gen) out.push(r);
  return out;
}

describe("streamNdjsonFrom", () => {
  it("yields one record per non-blank line with 1-based line numbers", async () => {
    const input = Readable.from(['{"id":"a"}\n', "\n", '{"id":"b"}\n']);
    const recs = await drain(streamNdjsonFrom(input));
    expect(recs).toHaveLength(2);
    expect(recs[0]).toMatchObject({ lineNumber: 1, value: { id: "a" } });
    // Blank line is skipped but still counted, so the second record is line 3.
    expect(recs[1]).toMatchObject({ lineNumber: 3, value: { id: "b" } });
  });

  it("diverts an oversize line to a parse error instead of buffering it as an entity", async () => {
    const huge = "x".repeat(16 * 1024 * 1024 + 1);
    const input = Readable.from([`${huge}\n`, '{"id":"ok"}\n']);
    const recs = await drain(streamNdjsonFrom(input));
    expect(recs[0].parseError).toMatch(/exceeds max size/);
    expect(recs[0].value).toBeUndefined();
    expect(recs[1].value).toEqual({ id: "ok" });
  });

  it("captures a parse error instead of throwing", async () => {
    const input = Readable.from(["{not json\n", '{"id":"ok"}\n']);
    const recs = await drain(streamNdjsonFrom(input));
    expect(recs[0].parseError).toBeDefined();
    expect(recs[0].value).toBeUndefined();
    expect(recs[1].value).toEqual({ id: "ok" });
  });
});

describe("streamNdjsonFile", () => {
  it("streams records from a file", async () => {
    const file = join(tmp, "data.ndjson");
    writeFileSync(file, '{"id":"a"}\n{"id":"b"}\n');
    const recs = await drain(streamNdjsonFile(file));
    expect(recs.map((r) => (r.value as { id: string }).id)).toEqual(["a", "b"]);
  });
});

describe("recordsFromArray", () => {
  it("maps an array to records with index-based line numbers", () => {
    const recs = recordsFromArray([{ id: "a" }, { id: "b" }]);
    expect(recs).toHaveLength(2);
    expect(recs[1]).toMatchObject({ lineNumber: 2, value: { id: "b" } });
  });

  it("throws on non-array input", () => {
    expect(() => recordsFromArray({ id: "a" })).toThrow(/array/);
  });
});

describe("fileFingerprint / fingerprintsMatch", () => {
  it("produces a stable fingerprint for the same content and detects changes", () => {
    const file = join(tmp, "fp.ndjson");
    writeFileSync(file, '{"id":"a"}\n');
    const fp1 = fileFingerprint(file);
    expect(fp1.size).toBeGreaterThan(0);
    expect(fp1.headHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprintsMatch(fp1, { ...fp1 })).toBe(true);
    expect(fingerprintsMatch(fp1, { ...fp1, size: fp1.size + 1 })).toBe(false);
    expect(fingerprintsMatch(fp1, { ...fp1, headHash: "different" })).toBe(false);
  });

  it("hashes an empty file without error", () => {
    const file = join(tmp, "empty.ndjson");
    writeFileSync(file, "");
    const fp = fileFingerprint(file);
    expect(fp.size).toBe(0);
    expect(fp.headHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
