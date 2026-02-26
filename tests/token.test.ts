import { describe, it, expect, vi, afterEach } from "vitest";
import { decodeJwtPayload, getTokenStatus, formatDuration } from "../src/token.js";

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-signature`;
}

describe("token", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("decodeJwtPayload", () => {
    it("decodes valid JWT payload", () => {
      const token = createJwt({ sub: "user@test.com", exp: 1700000000 });
      const payload = decodeJwtPayload(token);
      expect(payload).toEqual({ sub: "user@test.com", exp: 1700000000 });
    });

    it("returns null for invalid token", () => {
      expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    });

    it("returns null for token with invalid base64", () => {
      expect(decodeJwtPayload("a.!!!.c")).toBeNull();
    });
  });

  describe("getTokenStatus", () => {
    it("returns valid status for future expiry", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

      const exp = Math.floor(new Date("2026-03-01T00:00:00Z").getTime() / 1000);
      const token = createJwt({ exp });
      const status = getTokenStatus(token);

      expect(status.isExpired).toBe(false);
      expect(status.isExpiringSoon).toBe(false);
      expect(status.expiresAt).toEqual(new Date("2026-03-01T00:00:00Z"));
      expect(status.remainingMs).toBeGreaterThan(0);
    });

    it("detects expired token", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));

      const exp = Math.floor(new Date("2026-01-01T00:00:00Z").getTime() / 1000);
      const token = createJwt({ exp });
      const status = getTokenStatus(token);

      expect(status.isExpired).toBe(true);
      expect(status.remainingMs).toBeLessThan(0);
    });

    it("detects expiring soon (within 5 minutes)", () => {
      vi.useFakeTimers();
      const now = new Date("2026-01-01T00:00:00Z");
      vi.setSystemTime(now);

      const exp = Math.floor(now.getTime() / 1000) + 180; // 3 minutes from now
      const token = createJwt({ exp });
      const status = getTokenStatus(token);

      expect(status.isExpired).toBe(false);
      expect(status.isExpiringSoon).toBe(true);
    });

    it("returns null expiry for token without exp claim", () => {
      const token = createJwt({ sub: "user@test.com" });
      const status = getTokenStatus(token);

      expect(status.expiresAt).toBeNull();
      expect(status.remainingMs).toBeNull();
      expect(status.isExpired).toBe(false);
    });

    it("returns null expiry for invalid token", () => {
      const status = getTokenStatus("invalid");
      expect(status.expiresAt).toBeNull();
    });
  });

  describe("formatDuration", () => {
    it("formats days and hours", () => {
      const ms = (2 * 24 + 5) * 60 * 60 * 1000; // 2d 5h
      expect(formatDuration(ms)).toBe("2d 5h");
    });

    it("formats hours and minutes", () => {
      const ms = (3 * 60 + 30) * 60 * 1000; // 3h 30m
      expect(formatDuration(ms)).toBe("3h 30m");
    });

    it("formats minutes only", () => {
      const ms = 15 * 60 * 1000; // 15m
      expect(formatDuration(ms)).toBe("15m");
    });

    it("formats seconds when less than a minute", () => {
      const ms = 45 * 1000;
      expect(formatDuration(ms)).toBe("45s");
    });

    it("returns expired for zero or negative", () => {
      expect(formatDuration(0)).toBe("expired");
      expect(formatDuration(-1000)).toBe("expired");
    });

    it("omits minutes when showing days", () => {
      const ms = (1 * 24 * 60 + 30) * 60 * 1000; // 1d 0h 30m
      expect(formatDuration(ms)).toBe("1d");
    });
  });
});
