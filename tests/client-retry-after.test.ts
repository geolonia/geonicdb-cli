import { describe, it, expect, vi, beforeEach } from "vitest";
import { GdbClient, GdbClientError, parseRetryAfter } from "../src/client.js";

describe("parseRetryAfter", () => {
  it("parses delta-seconds", () => {
    expect(parseRetryAfter("120")).toBe(120_000);
    expect(parseRetryAfter("0")).toBe(0);
  });

  it("parses an HTTP-date relative to now", () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfter(future);
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it("returns undefined for missing or unparseable values", () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("not-a-date")).toBeUndefined();
  });
});

describe("GdbClient error/abort handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("attaches retryAfterMs to a 429 error", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Too Many Requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "7" },
      }),
    );
    await expect(client.post("/entityOperations/upsert", [])).rejects.toMatchObject({
      status: 429,
      retryAfterMs: 7000,
    });
  });

  it("forwards an AbortSignal to fetch", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }));
    const controller = new AbortController();
    await client.post("/entityOperations/upsert", [], undefined, { signal: controller.signal });
    expect(spy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("attaches retryAfterMs on rawRequest errors too", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ title: "Service Unavailable" }), {
        status: 503,
        headers: { "Content-Type": "application/json", "Retry-After": "3" },
      }),
    );
    await expect(client.rawRequest("GET", "/health")).rejects.toMatchObject({
      status: 503,
      retryAfterMs: 3000,
    });
  });

  it("still throws GdbClientError with no retryAfterMs when header absent", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "bad" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const err = await client.post("/entityOperations/upsert", []).catch((e) => e as GdbClientError);
    expect(err).toBeInstanceOf(GdbClientError);
    expect(err.retryAfterMs).toBeUndefined();
  });
});
