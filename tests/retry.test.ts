import { describe, it, expect, vi } from "vitest";
import { GdbClientError } from "../src/client.js";
import { isRetryableError, withRetry } from "../src/retry.js";

const noSleep = () => Promise.resolve();

describe("isRetryableError", () => {
  it("treats 429 and 5xx as retryable", () => {
    expect(isRetryableError(new GdbClientError("rate", 429))).toBe(true);
    expect(isRetryableError(new GdbClientError("boom", 500))).toBe(true);
    expect(isRetryableError(new GdbClientError("boom", 503))).toBe(true);
  });

  it("treats 4xx (non-429) as non-retryable", () => {
    expect(isRetryableError(new GdbClientError("bad", 400))).toBe(false);
    expect(isRetryableError(new GdbClientError("conflict", 409))).toBe(false);
  });

  it("treats network errors and timeouts as retryable", () => {
    const abort = new Error("aborted");
    abort.name = "AbortError";
    expect(isRetryableError(abort)).toBe(true);
    const netErr = new TypeError("fetch failed");
    expect(isRetryableError(netErr)).toBe(true);
  });

  it("treats unknown values as non-retryable", () => {
    expect(isRetryableError("nope")).toBe(false);
    expect(isRetryableError(new Error("plain"))).toBe(false);
  });
});

describe("withRetry", () => {
  it("returns immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, { retries: 3, sleep: noSleep });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries transient failures up to the limit then throws", async () => {
    const fn = vi.fn().mockRejectedValue(new GdbClientError("boom", 500));
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow("boom");
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it("does not retry non-retryable errors", async () => {
    const fn = vi.fn().mockRejectedValue(new GdbClientError("bad", 400));
    await expect(withRetry(fn, { retries: 5, sleep: noSleep })).rejects.toThrow("bad");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("succeeds after a transient failure", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new GdbClientError("boom", 503))
      .mockResolvedValue("ok");
    const onRetry = vi.fn();
    const result = await withRetry(fn, { retries: 3, sleep: noSleep, onRetry });
    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After for 429 instead of backoff", async () => {
    const err = new GdbClientError("rate", 429, undefined, 1234);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const delays: number[] = [];
    await withRetry(fn, {
      retries: 1,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    expect(delays).toEqual([1234]);
  });

  it("uses exponential backoff with jitter when no Retry-After", async () => {
    const err = new GdbClientError("boom", 500);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const delays: number[] = [];
    await withRetry(fn, {
      retries: 1,
      baseDelayMs: 100,
      random: () => 0.5,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    // exp = 100 * 2^0 = 100; delay = 50 + 0.5*50 = 75
    expect(delays).toEqual([75]);
  });

  it("honors Retry-After on a 503 as well as a 429", async () => {
    const err = new GdbClientError("unavailable", 503, undefined, 2500);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const delays: number[] = [];
    await withRetry(fn, {
      retries: 1,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    expect(delays).toEqual([2500]);
  });

  it("uses the built-in sleep when none is injected", async () => {
    const err = new GdbClientError("boom", 500);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const result = await withRetry(fn, { retries: 1, baseDelayMs: 1, maxDelayMs: 2 });
    expect(result).toBe("ok");
  });

  it("caps Retry-After at maxDelayMs", async () => {
    const err = new GdbClientError("rate", 429, undefined, 999_999);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const delays: number[] = [];
    await withRetry(fn, {
      retries: 1,
      maxDelayMs: 5000,
      sleep: (ms) => {
        delays.push(ms);
        return Promise.resolve();
      },
    });
    expect(delays).toEqual([5000]);
  });
});
