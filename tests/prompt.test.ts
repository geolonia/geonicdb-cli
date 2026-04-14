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

      it("resolves with answer from readline and displays prompt", async () => {
        mockQuestion.mockResolvedValue("abc");
        const result = await promptPassword();
        expect(result).toBe("abc");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("Password: ");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("\n");
        expect(mockClose).toHaveBeenCalled();
      });

      it("displays * for each keypress character", async () => {
        let resolveQ!: (v: string) => void;
        mockQuestion.mockReturnValue(new Promise<string>((r) => { resolveQ = r; }));

        const promise = promptPassword();
        for (const ch of ["a", "b", "c"]) {
          stdinListeners["keypress"]?.forEach((cb) => cb(ch, { name: ch }));
        }
        resolveQ("abc");

        const result = await promise;
        expect(result).toBe("abc");
        const starCalls = stdoutWriteSpy.mock.calls.filter(([arg]) => arg === "*");
        expect(starCalls).toHaveLength(3);
      });

      it("handles backspace keypress by erasing a *", async () => {
        let resolveQ!: (v: string) => void;
        mockQuestion.mockReturnValue(new Promise<string>((r) => { resolveQ = r; }));

        const promise = promptPassword();
        stdinListeners["keypress"]?.forEach((cb) => cb("a", { name: "a" }));
        stdinListeners["keypress"]?.forEach((cb) => cb("b", { name: "b" }));
        stdinListeners["keypress"]?.forEach((cb) => cb(undefined, { name: "backspace" }));
        resolveQ("a");

        const result = await promise;
        expect(result).toBe("a");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("\b \b");
      });

      it("ignores backspace on empty password", async () => {
        let resolveQ!: (v: string) => void;
        mockQuestion.mockReturnValue(new Promise<string>((r) => { resolveQ = r; }));

        const promise = promptPassword();
        stdinListeners["keypress"]?.forEach((cb) => cb(undefined, { name: "backspace" }));
        resolveQ("");

        const result = await promise;
        expect(result).toBe("");
        expect(stdoutWriteSpy).not.toHaveBeenCalledWith("\b \b");
      });

      it("ignores Enter keypress for display", async () => {
        let resolveQ!: (v: string) => void;
        mockQuestion.mockReturnValue(new Promise<string>((r) => { resolveQ = r; }));

        const promise = promptPassword();
        stdinListeners["keypress"]?.forEach((cb) => cb("x", { name: "x" }));
        stdinListeners["keypress"]?.forEach((cb) => cb(undefined, { name: "return" }));
        resolveQ("x");

        await promise;
        const starCalls = stdoutWriteSpy.mock.calls.filter(([arg]) => arg === "*");
        expect(starCalls).toHaveLength(1);
      });

      it("ignores ctrl key combos for display", async () => {
        let resolveQ!: (v: string) => void;
        mockQuestion.mockReturnValue(new Promise<string>((r) => { resolveQ = r; }));

        const promise = promptPassword();
        stdinListeners["keypress"]?.forEach((cb) => cb("\x01", { name: "a", ctrl: true }));
        stdinListeners["keypress"]?.forEach((cb) => cb("z", { name: "z" }));
        resolveQ("z");

        const result = await promise;
        expect(result).toBe("z");
        const starCalls = stdoutWriteSpy.mock.calls.filter(([arg]) => arg === "*");
        expect(starCalls).toHaveLength(1);
      });

      it("uses custom label", async () => {
        mockQuestion.mockResolvedValue("secret");
        await promptPassword("New password");
        expect(stdoutWriteSpy).toHaveBeenCalledWith("New password: ");
      });

      it("cleans up keypress listener after resolve", async () => {
        mockQuestion.mockResolvedValue("test");
        await promptPassword();
        expect(stdinListeners["keypress"]?.length ?? 0).toBe(0);
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
