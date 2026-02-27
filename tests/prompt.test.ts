import { describe, it, expect, afterEach } from "vitest";
import { isInteractive } from "../src/prompt.js";

describe("prompt", () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutIsTTY, writable: true });
  });

  describe("isInteractive", () => {
    it("returns false when stdin is not a TTY", () => {
      Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true });
      expect(isInteractive()).toBe(false);
    });

    it("returns false when stdout is not a TTY", () => {
      Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: false, writable: true });
      expect(isInteractive()).toBe(false);
    });

    it("returns true when both stdin and stdout are TTY", () => {
      Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: true, writable: true });
      expect(isInteractive()).toBe(true);
    });

    it("returns false when isTTY is undefined", () => {
      Object.defineProperty(process.stdin, "isTTY", { value: undefined, writable: true });
      Object.defineProperty(process.stdout, "isTTY", { value: undefined, writable: true });
      expect(isInteractive()).toBe(false);
    });
  });
});
