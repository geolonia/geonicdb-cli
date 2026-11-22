import type { EntityRecord } from "./input.js";

export interface GeoJsonMapping {
  type: string;
  idField?: string;
}

const RESERVED_ATTRIBUTES = new Set([
  "id", "type", "@context", "location",
  "scope", "expiresAt", "createdAt", "modifiedAt", "deletedAt",
  "__proto__", "constructor", "prototype",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPosition(value: unknown): value is number[] {
  return Array.isArray(value) && (value.length === 2 || value.length === 3) &&
    value.every((coordinate) => typeof coordinate === "number" && Number.isFinite(coordinate));
}

function isPositionList(value: unknown, minLength: number): value is number[][] {
  return Array.isArray(value) && value.length >= minLength && value.every(isPosition);
}

function isPolygon(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((ring: unknown) => {
    if (!isPositionList(ring, 4)) return false;
    const first = ring[0];
    const last = ring[ring.length - 1];
    return first.length === last.length && first.every((coordinate, i) => coordinate === last[i]);
  });
}

function isGeometry(value: unknown): boolean {
  if (!isObject(value)) return false;
  const { coordinates } = value;
  switch (value.type) {
    case "Point": return isPosition(coordinates);
    case "LineString": return isPositionList(coordinates, 2);
    case "MultiPoint": return isPositionList(coordinates, 1);
    case "Polygon": return isPolygon(coordinates);
    case "MultiLineString":
      return Array.isArray(coordinates) && coordinates.length > 0 &&
        coordinates.every((line) => isPositionList(line, 2));
    case "MultiPolygon":
      return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isPolygon);
    default: return false;
  }
}

function portableIdPart(value: string): string {
  // Reserve the prefix so encoded IDs cannot collide with literal source IDs.
  if (/^[A-Za-z0-9._-]+$/.test(value) && !value.startsWith("_b64_")) return value;
  return `_b64_${Buffer.from(value, "utf8").toString("base64url")}`;
}

function entityId(value: unknown, mapping: GeoJsonMapping): string {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Expected a string or numeric feature ID.");
  }
  const id = String(value).trim();
  if (!id) throw new Error("Expected a non-empty feature ID.");
  if (typeof value === "string" && /^urn:ngsi-ld:[A-Za-z0-9._-]+:[A-Za-z0-9._:-]+$/.test(id)) {
    return id;
  }
  return `urn:ngsi-ld:${portableIdPart(mapping.type)}:${portableIdPart(id)}`;
}

function convertFeature(feature: unknown, mapping: GeoJsonMapping) {
  if (!isObject(feature) || feature.type !== "Feature") {
    throw new Error("Expected a GeoJSON Feature.");
  }
  if (feature.properties !== null && !isObject(feature.properties)) {
    throw new Error("Expected a GeoJSON properties object or null.");
  }
  const properties = feature.properties ?? {};
  const sourceId = mapping.idField === undefined
    ? feature.id
    : Object.hasOwn(properties, mapping.idField) ? properties[mapping.idField] : undefined;
  const id = entityId(sourceId, mapping);

  if (feature.geometry !== null && !isGeometry(feature.geometry)) {
    throw new Error("Expected a supported GeoJSON geometry (Point, LineString, Polygon or their Multi variants) or null.");
  }

  const attributes = Object.entries(properties).flatMap(([name, value]) => {
    if (name === mapping.idField) return [];
    if (name.trim().length === 0 || RESERVED_ATTRIBUTES.has(name)) {
      throw new Error(`Invalid entity attribute name ${JSON.stringify(name)} in GeoJSON properties.`);
    }
    return value === null ? [] : [[name, { type: "Property", value }]];
  });
  return {
    id,
    type: mapping.type,
    ...Object.fromEntries(attributes),
    ...(feature.geometry !== null && { location: { type: "GeoProperty", value: feature.geometry } }),
  };
}

export function recordsFromGeoJson(data: unknown, mapping: GeoJsonMapping): EntityRecord[] {
  if (!isObject(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection.");
  }
  const seenIds = new Set<string>();
  return data.features.map((feature, i) => {
    const lineNumber = i + 1;
    try {
      const value = convertFeature(feature, mapping);
      if (seenIds.has(value.id)) throw new Error(`Duplicate GeoJSON feature ID ${JSON.stringify(value.id)}.`);
      seenIds.add(value.id);
      return { lineNumber, raw: JSON.stringify(value), value };
    } catch (error) {
      return {
        lineNumber,
        raw: JSON.stringify(feature),
        parseError: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
