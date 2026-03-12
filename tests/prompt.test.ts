import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const mockQuestion = vi.fn();
const mockClose = vi.fn();
vi.mock("node:readline/promises", () => ({
  createInterface: vi.fn(() => ({
    question: mockQuestion,
    close: mockClose,
  })),
}));

import { isInteractive, promptEmail, promptPassword, promptTenantSelection } from "../src/prompt.js";

describe("prompt", () => {
  const originalStdinIsTTY = process.stdin.isTTY;
  const originalStdoutIsTTY = process.stdout.isTTY;

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: originalStdinIsTTY, writable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: originalStdoutIsTTY, writable: true });
    vi.restoreAllMocks();
    mockQuestion.mockReset();
    mockClose.mockReset();
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

  describe("promptEmail", () => {
    it("prompts for email and returns trimmed input", async () => {
      mockQuestion.mockResolvedValue("  user@test.com  ");

      const result = await promptEmail();
      expect(result).toBe("user@test.com");
      expect(mockQuestion).toHaveBeenCalledWith("Email: ");
      expect(mockClose).toHaveBeenCalled();
    });

    it("closes readline even when question throws", async () => {
      mockQuestion.mockRejectedValue(new Error("readline error"));

      await expect(promptEmail()).rejects.toThrow("readline error");
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("promptPassword", () => {
    let stdinListeners: Record<string, ((...args: unknown[]) => void)[]>;
    let stdoutWriteSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      stdinListeners = {};
      stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe("TTY mode", () => {
      beforeEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
        // Mock setRawMode, resume, pause, setEncoding, on, removeListener
        (process.stdin as never as Record<string, unknown>).setRawMode = vi.fn();
        (process.stdin as never as Record<string, unknown>).isRaw = false;
        vi.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "setEncoding").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "on").mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          (stdinListeners[event] ??= []).push(cb);
          return process.stdin;
        });
        vi.spyOn(process.stdin, "removeListener").mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          const arr = stdinListeners[event];
          if (arr) {
            const idx = arr.indexOf(cb);
            if (idx !== -1) arr.splice(idx, 1);
          }
          return process.stdin;
        });
      });

      it("collects password chars and resolves on Enter", async () => {
        const promise = promptPassword();

        // Type "abc" then Enter
        for (const ch of ["a", "b", "c"]) {
          stdinListeners["data"]?.forEach((cb) => cb(ch));
        }
        stdinListeners["data"]?.forEach((cb) => cb("\r"));

        const result = await promise;
        expect(result).toBe("abc");
        // Should have written Password: prompt and 3 * chars
        expect(stdoutWriteSpy).toHaveBeenCalledWith("Password: ");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("*");
      });

      it("handles newline (\\n) as Enter", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("x"));
        stdinListeners["data"]?.forEach((cb) => cb("\n"));
        const result = await promise;
        expect(result).toBe("x");
      });

      it("handles Ctrl+C (code 3) by rejecting", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb(String.fromCharCode(3)));
        await expect(promise).rejects.toThrow("User cancelled");
      });

      it("handles backspace (code 127)", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("a"));
        stdinListeners["data"]?.forEach((cb) => cb("b"));
        // Backspace
        stdinListeners["data"]?.forEach((cb) => cb(String.fromCharCode(127)));
        stdinListeners["data"]?.forEach((cb) => cb("\r"));
        const result = await promise;
        expect(result).toBe("a");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("\b \b");
      });

      it("handles backspace (code 8)", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("x"));
        stdinListeners["data"]?.forEach((cb) => cb(String.fromCharCode(8)));
        stdinListeners["data"]?.forEach((cb) => cb("\r"));
        const result = await promise;
        expect(result).toBe("");
      });

      it("ignores backspace on empty password", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb(String.fromCharCode(127)));
        stdinListeners["data"]?.forEach((cb) => cb("\r"));
        const result = await promise;
        expect(result).toBe("");
      });

      it("ignores control chars below code 32", async () => {
        const promise = promptPassword();
        // Send a control char that isn't enter, ctrl+c, or backspace
        stdinListeners["data"]?.forEach((cb) => cb(String.fromCharCode(1))); // Ctrl+A
        stdinListeners["data"]?.forEach((cb) => cb("z"));
        stdinListeners["data"]?.forEach((cb) => cb("\r"));
        const result = await promise;
        expect(result).toBe("z");
      });

      it("handles error event", async () => {
        const promise = promptPassword();
        const error = new Error("stdin error");
        stdinListeners["error"]?.forEach((cb) => cb(error));
        await expect(promise).rejects.toThrow("stdin error");
      });

      it("handles isRaw being undefined (wasRaw ?? false branch)", async () => {
        (process.stdin as never as Record<string, unknown>).isRaw = undefined;
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("p"));
        stdinListeners["data"]?.forEach((cb) => cb("\r"));
        const result = await promise;
        expect(result).toBe("p");
        // setRawMode should be called with false (from ?? false)
        expect((process.stdin as never as Record<string, unknown>).setRawMode).toHaveBeenCalledWith(false);
      });
    });

    describe("non-TTY mode (piped input)", () => {
      beforeEach(() => {
        Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });
        vi.spyOn(process.stdin, "setEncoding").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "resume").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "pause").mockImplementation(() => process.stdin);
        vi.spyOn(process.stdin, "on").mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          (stdinListeners[event] ??= []).push(cb);
          return process.stdin;
        });
        vi.spyOn(process.stdin, "removeListener").mockImplementation((event: string, cb: (...args: unknown[]) => void) => {
          const arr = stdinListeners[event];
          if (arr) {
            const idx = arr.indexOf(cb);
            if (idx !== -1) arr.splice(idx, 1);
          }
          return process.stdin;
        });
      });

      it("reads password from piped input with newline", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("piped-pass\n"));
        const result = await promise;
        expect(result).toBe("piped-pass");
      });

      it("reads password from piped input without newline (on end)", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("no-newline"));
        stdinListeners["end"]?.forEach((cb) => cb());
        const result = await promise;
        expect(result).toBe("no-newline");
      });

      it("accumulates chunks before newline", async () => {
        const promise = promptPassword();
        stdinListeners["data"]?.forEach((cb) => cb("part1"));
        stdinListeners["data"]?.forEach((cb) => cb("part2\n"));
        const result = await promise;
        expect(result).toBe("part1part2");
      });

      it("handles error event in non-TTY mode", async () => {
        const promise = promptPassword();
        const error = new Error("pipe error");
        stdinListeners["error"]?.forEach((cb) => cb(error));
        await expect(promise).rejects.toThrow("pipe error");
      });
    });
  });

  describe("promptTenantSelection", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("returns selected tenant when user enters a valid number", async () => {
      mockQuestion.mockResolvedValue("2");
      const tenants = [
        { tenantId: "city_a", role: "admin" },
        { tenantId: "city_b", role: "user" },
      ];
      const result = await promptTenantSelection(tenants, "city_a");
      expect(result).toBe("city_b");
      expect(mockClose).toHaveBeenCalled();
    });

    it("returns undefined when user presses Enter without input", async () => {
      mockQuestion.mockResolvedValue("");
      const tenants = [
        { tenantId: "city_a", role: "admin" },
        { tenantId: "city_b", role: "user" },
      ];
      const result = await promptTenantSelection(tenants, "city_a");
      expect(result).toBeUndefined();
    });

    it("returns undefined when user enters whitespace only", async () => {
      mockQuestion.mockResolvedValue("   ");
      const tenants = [{ tenantId: "city_a", role: "admin" }];
      const result = await promptTenantSelection(tenants);
      expect(result).toBeUndefined();
    });

    it("re-prompts on out-of-range number then accepts valid input", async () => {
      mockQuestion
        .mockResolvedValueOnce("99")
        .mockResolvedValueOnce("1");
      const tenants = [
        { tenantId: "city_a", role: "admin" },
        { tenantId: "city_b", role: "user" },
      ];
      const result = await promptTenantSelection(tenants, "city_a");
      expect(result).toBe("city_a");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid selection"));
      expect(mockQuestion).toHaveBeenCalledTimes(2);
    });

    it("re-prompts on zero then accepts valid input", async () => {
      mockQuestion
        .mockResolvedValueOnce("0")
        .mockResolvedValueOnce("1");
      const tenants = [{ tenantId: "city_a", role: "admin" }];
      const result = await promptTenantSelection(tenants);
      expect(result).toBe("city_a");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid selection"));
    });

    it("re-prompts on negative number then accepts Enter to keep current", async () => {
      mockQuestion
        .mockResolvedValueOnce("-1")
        .mockResolvedValueOnce("");
      const tenants = [{ tenantId: "city_a", role: "admin" }];
      const result = await promptTenantSelection(tenants);
      expect(result).toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid selection"));
    });

    it("displays current tenant marker", async () => {
      mockQuestion.mockResolvedValue("");
      const tenants = [
        { tenantId: "city_a", role: "admin" },
        { tenantId: "city_b", role: "user" },
      ];
      await promptTenantSelection(tenants, "city_a");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("← current"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/\*.*city_a/));
    });

    it("displays tenants without current marker when currentTenantId is not provided", async () => {
      mockQuestion.mockResolvedValue("");
      const tenants = [
        { tenantId: "city_a", role: "admin" },
        { tenantId: "city_b", role: "user" },
      ];
      await promptTenantSelection(tenants);
      // No "← current" marker should appear
      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).not.toContain("← current");
    });

    it("closes readline even when question throws", async () => {
      mockQuestion.mockRejectedValue(new Error("readline error"));
      const tenants = [{ tenantId: "city_a", role: "admin" }];
      await expect(promptTenantSelection(tenants)).rejects.toThrow("readline error");
      expect(mockClose).toHaveBeenCalled();
    });
  });
});
