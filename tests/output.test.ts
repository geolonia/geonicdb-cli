import { describe, it, expect, vi } from "vitest";
import stripAnsi from "strip-ansi";
import {
  formatOutput,
  printOutput,
  printSuccess,
  printError,
  printInfo,
  printWarning,
  printCount,
} from "../src/output.js";

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

    it("returns String(data) for non-array non-object data", () => {
      const result = formatOutput("hello-string", "table");
      expect(result).toBe("hello-string");
    });

    it("returns String(data) for a number", () => {
      const result = formatOutput(42, "table");
      expect(result).toBe("42");
    });

    it("returns String(data) for null", () => {
      const result = formatOutput(null, "table");
      expect(result).toBe("null");
    });
  });

  describe("formatObjectTable", () => {
    it("formats object entries as key-value pairs", () => {
      const data = { name: "Room:001", status: "active" };
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("name");
      expect(result).toContain("Room:001");
      expect(result).toContain("status");
      expect(result).toContain("active");
    });

    it("shows (empty) for empty object", () => {
      const result = formatOutput({}, "table");
      expect(result).toBe("(empty)");
    });
  });

  describe("cellValue", () => {
    it("extracts .value from object with value property", () => {
      const data = [{ id: "e1", temp: { value: 42, type: "Property" } }];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("42");
    });

    it("uses JSON.stringify for object without value property", () => {
      const data = [{ id: "e1", meta: { nested: true, count: 5 } }];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain('{"nested":true,"count":5}');
    });

    it("formats GeoProperty Point as readable coordinates (NGSIv2)", () => {
      const data = [
        {
          id: "e1",
          location: {
            type: "geo:json",
            value: { type: "Point", coordinates: [139.7, 35.6] },
          },
        },
      ];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("Point(139.70, 35.60)");
    });

    it("formats GeoProperty Point as readable coordinates (NGSI-LD)", () => {
      const data = [
        {
          id: "e1",
          location: {
            type: "GeoProperty",
            value: { type: "Point", coordinates: [139.7, 35.6] },
          },
        },
      ];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("Point(139.70, 35.60)");
    });

    it("formats GeoJSON directly in keyValues mode", () => {
      const data = [
        {
          id: "e1",
          location: { type: "Point", coordinates: [139.7, 35.6] },
        },
      ];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("Point(139.70, 35.60)");
    });

    it("formats LineString with coordinate count", () => {
      const data = [
        {
          id: "e1",
          route: {
            type: "GeoProperty",
            value: {
              type: "LineString",
              coordinates: [
                [139.7, 35.6],
                [139.8, 35.7],
                [139.9, 35.8],
              ],
            },
          },
        },
      ];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("LineString(3 coords)");
    });

    it("formats Polygon with coordinate count", () => {
      const data = [
        {
          id: "e1",
          area: {
            type: "GeoProperty",
            value: {
              type: "Polygon",
              coordinates: [
                [
                  [139.7, 35.6],
                  [139.8, 35.6],
                  [139.8, 35.7],
                  [139.7, 35.6],
                ],
              ],
            },
          },
        },
      ];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("Polygon(4 coords)");
    });

    it("returns empty string for null/undefined values", () => {
      const data = [{ id: "e1", n: null, u: undefined }];
      const result = stripAnsi(formatOutput(data, "table"));
      expect(result).toContain("e1");
      expect(result).not.toContain("null");
      expect(result).not.toContain("undefined");
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

    it("returns Feature with null geometry and entity as properties for non-object entity", () => {
      const result = JSON.parse(formatOutput(42, "geojson"));
      expect(result).toEqual({ type: "Feature", geometry: null, properties: 42 });
    });

    it("returns Feature with null geometry for null entity", () => {
      const result = JSON.parse(formatOutput(null, "geojson"));
      expect(result).toEqual({ type: "Feature", geometry: null, properties: null });
    });

    it("uses location directly when location has no .value (raw GeoJSON)", () => {
      const data = {
        id: "Room:001",
        location: { type: "Point", coordinates: [139.7, 35.6] },
      };
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.geometry).toEqual({ type: "Point", coordinates: [139.7, 35.6] });
    });

    it("extracts .value from property value objects", () => {
      const data = {
        id: "Room:001",
        temperature: { value: 25, type: "Property" },
        name: "test",
      };
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.properties.temperature).toBe(25);
      expect(result.properties.name).toBe("test");
      expect(result.properties.id).toBe("Room:001");
    });

    it("keeps non-value objects as-is in properties", () => {
      const data = {
        id: "Room:001",
        metadata: { nested: true },
      };
      const result = JSON.parse(formatOutput(data, "geojson"));
      expect(result.properties.metadata).toEqual({ nested: true });
    });
  });

  describe("default format (falls through to JSON)", () => {
    it("uses JSON for unknown format string", () => {
      const data = { id: "test" };
      const result = formatOutput(data, "unknown" as never);
      expect(result).toBe(JSON.stringify(data, null, 2));
    });
  });

  describe("print functions", () => {
    it("printOutput logs formatted output", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      printOutput({ id: "test" }, "json");
      expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: "test" }, null, 2));
      logSpy.mockRestore();
    });

    it("printSuccess logs green message", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      printSuccess("done");
      expect(logSpy).toHaveBeenCalled();
      const output = stripAnsi(logSpy.mock.calls[0][0]);
      expect(output).toBe("done");
      logSpy.mockRestore();
    });

    it("printError logs red error message", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      printError("something failed");
      expect(errSpy).toHaveBeenCalled();
      const output = stripAnsi(errSpy.mock.calls[0][0]);
      expect(output).toBe("Error: something failed");
      errSpy.mockRestore();
    });

    it("printInfo logs cyan message", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      printInfo("info message");
      expect(logSpy).toHaveBeenCalled();
      const output = stripAnsi(logSpy.mock.calls[0][0]);
      expect(output).toBe("info message");
      logSpy.mockRestore();
    });

    it("printWarning logs yellow message to stderr", () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      printWarning("warning message");
      expect(errSpy).toHaveBeenCalled();
      const output = stripAnsi(errSpy.mock.calls[0][0]);
      expect(output).toBe("warning message");
      errSpy.mockRestore();
    });

    it("printCount logs dim count message", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      printCount(42);
      expect(logSpy).toHaveBeenCalled();
      const output = stripAnsi(logSpy.mock.calls[0][0]);
      expect(output).toBe("Count: 42");
      logSpy.mockRestore();
    });
  });
});
