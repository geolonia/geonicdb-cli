import { GdbClientError } from "./client.js";

export interface RetryInfo {
  /** 1-based attempt number that just failed (i.e. the retry we are about to perform). */
  attempt: number;
  delayMs: number;
  error: unknown;
}

export interface RetryOptions {
  /** Maximum number of retries after the initial attempt. */
  retries: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (info: RetryInfo) => void;
  /** Injectable sleep for tests. */
  sleep?: (ms: number) => Promise<void>;
  /** Injectable jitter [0,1) for deterministic tests. */
  random?: () => number;
}

const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 30_000;

/**
 * Determine whether an error is worth retrying: server-side transient failures
 * (429 / 5xx), network errors, and request timeouts (AbortError). Client input
 * errors (4xx other than 429) are NOT retryable — retrying won't help.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof GdbClientError) {
    return err.status === 429 || err.status >= 500;
  }
  if (err instanceof Error) {
    // AbortError = our timeout; TypeError = fetch network failure (e.g. "fetch failed").
    return err.name === "AbortError" || err.name === "TypeError";
  }
  return false;
}

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying transient failures with exponential backoff + jitter.
 * For 429 responses that carry a Retry-After, honor that delay instead of backoff.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const base = opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const max = opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const sleep = opts.sleep ?? defaultSleep;
  const random = opts.random ?? Math.random;

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= opts.retries || !isRetryableError(err)) throw err;
      attempt++;
      const delay = computeDelay(err, attempt, base, max, random);
      opts.onRetry?.({ attempt, delayMs: delay, error: err });
      await sleep(delay);
    }
  }
}

function computeDelay(
  err: unknown,
  attempt: number,
  base: number,
  max: number,
  random: () => number,
): number {
  // Honor a server-provided Retry-After (429 or 503), always clamped to max so a
  // hostile/buggy header can't stall the client for hours.
  if (err instanceof GdbClientError && err.retryAfterMs !== undefined) {
    return Math.min(max, err.retryAfterMs);
  }
  // Exponential backoff with full-range jitter on the upper half.
  const exp = Math.min(max, base * 2 ** (attempt - 1));
  return exp / 2 + random() * (exp / 2);
}
