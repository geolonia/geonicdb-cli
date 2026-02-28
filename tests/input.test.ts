import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseJsonInput } from "../src/input.js";

describe("parseJsonInput", () => {
  it("parses inline JSON string", () => {
    const result = parseJsonInput('{"id":"Room:001","type":"Room"}');
    expect(result).toEqual({ id: "Room:001", type: "Room" });
  });

  it("parses JSON from file with @ prefix", () => {
    const filePath = join(tmpdir(), "geonic-test-input.json");
    writeFileSync(filePath, '{"id":"Room:002","type":"Room"}');
    const result = parseJsonInput(`@${filePath}`);
    expect(result).toEqual({ id: "Room:002", type: "Room" });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJsonInput("not-json")).toThrow();
  });
});
