import { describe, it, expect } from "vitest";
import { formatOutput } from "../src/output.js";

describe("output", () => {
  describe("json format", () => {
    it("pretty prints JSON", () => {
      const data = { id: "Room:001", type: "Room" };
      const result = formatOutput(data, "json");
      expect(result).toBe(JSON.stringify(data, null, 2));
    });

    it("handles arrays", () => {
      const data = [{ id: "a" }, { id: "b" }];
      const result = formatOutput(data, "json");
      expect(JSON.parse(result)).toEqual(data);
    });
  });

  describe("table format", () => {
    it("formats array as table", () => {
      const data = [
        { id: "Room:001", type: "Room" },
        { id: "Room:002", type: "Room" },
      ];
      const result = formatOutput(data, "table");
      expect(result).toContain("Room:001");
      expect(result).toContain("Room:002");
    });

    it("shows (empty) for empty arrays", () => {
      const result = formatOutput([], "table");
      expect(result).toBe("(empty)");
    });

    it("formats single object as key-value pairs", () => {
      const data = { id: "Room:001", type: "Room" };
      const result = formatOutput(data, "table");
      expect(result).toContain("id");
      expect(result).toContain("Room:001");
    });

    it("extracts .value from attribute objects", () => {
      const data = [
        { id: "Room:001", temperature: { type: "Number", value: 23.5 } },
      ];
      const result = formatOutput(data, "table");
      expect(result).toContain("23.5");
    });
  });

  describe("geojson format", () => {
    it("converts array to FeatureCollection", () => {
      const data = [{ id: "Room:001", type: "Room" }];
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.type).toBe("FeatureCollection");
      expect(result.features).toHaveLength(1);
    });

    it("converts single entity to Feature", () => {
      const data = { id: "Room:001", type: "Room" };
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.type).toBe("Feature");
    });

    it("extracts location as geometry", () => {
      const data = {
        id: "Room:001",
        location: {
          type: "geo:json",
          value: { type: "Point", coordinates: [139.7, 35.6] },
        },
      };
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.geometry).toEqual({ type: "Point", coordinates: [139.7, 35.6] });
    });
  });
});
