import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseJsonInput } from "../src/input.js";

describe("parseJsonInput", () => {
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
});
