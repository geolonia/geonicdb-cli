import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const mockReadFileSync = vi.fn();
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { ...actual, readFileSync: (...args: unknown[]) => {
    // If first arg is 0 (fd), use the mock. Otherwise delegate to actual.
    if (args[0] === 0) return mockReadFileSync(...args);
    return actual.readFileSync(...(args as Parameters<typeof actual.readFileSync>));
  }};
});

let mockRl: {
  on: ReturnType<typeof vi.fn>;
  prompt: ReturnType<typeof vi.fn>;
  setPrompt: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  _emit: (event: string, ...args: unknown[]) => void;
};

vi.mock("node:readline", () => ({
  createInterface: vi.fn(() => {
    const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    mockRl = {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        (listeners[event] ??= []).push(cb);
        return mockRl;
      }),
      prompt: vi.fn(),
      setPrompt: vi.fn(),
      close: vi.fn(() => {
        // Trigger 'close' event like the real readline does
        Promise.resolve().then(() => {
          listeners["close"]?.forEach((cb) => {
            cb();
          });
        });
      }),
      _emit: (event: string, ...args: unknown[]) => {
        listeners[event]?.forEach((cb) => {
          cb(...args);
        });
      },
    };
    return mockRl;
  }),
}));

import { parseJsonInput } from "../src/input.js";

describe("parseJsonInput", () => {
  const originalIsTTY = process.stdin.isTTY;
  let stderrWriteSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    stderrWriteSpy?.mockRestore();
    stderrWriteSpy = undefined;
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, writable: true });
    mockReadFileSync.mockReset();
  });

  it("parses inline JSON string", async () => {
    const result = await parseJsonInput('{"id":"Room:001","type":"Room"}');
    expect(result).toEqual({ id: "Room:001", type: "Room" });
  });

  it("parses JSON from file with @ prefix", async () => {
    const filePath = join(tmpdir(), "geonic-test-input.json");
    writeFileSync(filePath, '{"id":"Room:002","type":"Room"}');
    const result = await parseJsonInput(`@${filePath}`);
    expect(result).toEqual({ id: "Room:002", type: "Room" });
  });

  it("throws on invalid JSON", async () => {
    await expect(parseJsonInput("not-json")).rejects.toThrow();
  });

  // JSON5 tests
  it("parses JSON5 with unquoted keys", async () => {
    const result = await parseJsonInput('{id: "Room:003", type: "Room"}');
    expect(result).toEqual({ id: "Room:003", type: "Room" });
  });

  it("parses JSON5 with single quotes", async () => {
    const result = await parseJsonInput("{'id': 'Room:004', 'type': 'Room'}");
    expect(result).toEqual({ id: "Room:004", type: "Room" });
  });

  it("parses JSON5 with trailing commas", async () => {
    const result = await parseJsonInput('{"id": "Room:005", "type": "Room",}');
    expect(result).toEqual({ id: "Room:005", type: "Room" });
  });

  it("parses JSON5 with comments", async () => {
    const result = await parseJsonInput(`{
      // entity definition
      id: "Room:006",
      type: "Room", /* inline comment */
    }`);
    expect(result).toEqual({ id: "Room:006", type: "Room" });
  });

  it("parses JSON5 from file with @ prefix", async () => {
    const filePath = join(tmpdir(), "geonic-test-input.json5");
    writeFileSync(filePath, "{id: 'Room:007', type: 'Room',}");
    const result = await parseJsonInput(`@${filePath}`);
    expect(result).toEqual({ id: "Room:007", type: "Room" });
  });

  it("parses JSON array", async () => {
    const result = await parseJsonInput('[{"id":"a"},{"id":"b"}]');
    expect(result).toEqual([{ id: "a" }, { id: "b" }]);
  });

  it("trims whitespace before parsing", async () => {
    const result = await parseJsonInput('  {"id":"Room:008"}  ');
    expect(result).toEqual({ id: "Room:008" });
  });

  describe("stdin mode (input === '-')", () => {
    it("reads from stdin fd 0 when input is '-'", async () => {
      mockReadFileSync.mockReturnValue('{"id":"stdin-entity"}');
      const result = await parseJsonInput("-");
      expect(result).toEqual({ id: "stdin-entity" });
      expect(mockReadFileSync).toHaveBeenCalledWith(0, "utf-8");
    });
  });

  describe("piped stdin (non-TTY, no input)", () => {
    it("reads from stdin when no input and stdin is not a TTY", async () => {
      Object.defineProperty(process.stdin, "isTTY", { value: false, writable: true });
      mockReadFileSync.mockReturnValue('{"piped":"data"}');
      const result = await parseJsonInput(undefined);
      expect(result).toEqual({ piped: "data" });
      expect(mockReadFileSync).toHaveBeenCalledWith(0, "utf-8");
    });
  });

  describe("interactive mode (TTY, no input)", () => {
    beforeEach(() => {
      Object.defineProperty(process.stdin, "isTTY", { value: true, writable: true });
      stderrWriteSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    });

    it("reads JSON interactively and auto-submits when braces balance", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '{"id": "interactive",');
      mockRl._emit("line", '"type": "Room"}');

      const result = await promise;
      expect(result).toEqual({ id: "interactive", type: "Room" });
    });

    it("handles SIGINT cancellation", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("SIGINT");

      await expect(promise).rejects.toThrow("Input cancelled.");
    });

    it("handles EOF with no input", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("close");

      await expect(promise).rejects.toThrow("No input provided.");
    });

    it("handles EOF before braces are balanced", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '{"id": "partial"');
      // depth > 0, close without balancing
      mockRl._emit("close");

      // It will attempt to parse what we have — which is invalid JSON5
      await expect(promise).rejects.toThrow();
    });

    it("parses single-line JSON that auto-submits", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '{id: "test"}');
      const result = await promise;
      expect(result).toEqual({ id: "test" });
    });

    it("handles array input with balanced brackets", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '[{"id": "a"},');
      mockRl._emit("line", '{"id": "b"}]');

      const result = await promise;
      expect(result).toEqual([{ id: "a" }, { id: "b" }]);
    });

    it("handles block comments spanning lines", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", "{ /* start comment");
      mockRl._emit("line", "end comment */");
      mockRl._emit("line", '"id": "commented"}');

      const result = await promise;
      expect(result).toEqual({ id: "commented" });
    });

    it("handles string literals with braces inside", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '{"value": "contains { and } braces"}');

      const result = await promise;
      expect(result).toEqual({ value: "contains { and } braces" });
    });

    it("handles escaped characters in strings", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", '{"value": "escaped \\" quote"}');

      const result = await promise;
      expect(result).toEqual({ value: 'escaped " quote' });
    });

    it("handles line comments", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", "{ // this is a comment");
      mockRl._emit("line", '"id": "with-comment"}');

      const result = await promise;
      expect(result).toEqual({ id: "with-comment" });
    });

    it("handles single-quoted strings in JSON5", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", "{'id': 'test'}");

      const result = await promise;
      expect(result).toEqual({ id: "test" });
    });

    it("sets continuation prompt while awaiting more input", async () => {
      const promise = parseJsonInput(undefined);

      mockRl._emit("line", "{");
      expect(mockRl.setPrompt).toHaveBeenCalledWith("...  ");
      expect(mockRl.prompt).toHaveBeenCalled();

      mockRl._emit("line", '"id": "multi-line"}');
      await promise;
    });

    it("rejects when balanced braces produce invalid JSON5", async () => {
      const promise = parseJsonInput(undefined);

      // {a} is balanced (depth 0 after }) but not valid JSON5
      mockRl._emit("line", "{a}");

      await expect(promise).rejects.toThrow();
    });
  });
});
