import type { EntityRecord } from "./input.js";

export interface GeoJsonMapping {
  type: string;
  idField?: string;
}

const GEOMETRY_TYPES = new Set([
  "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon",
]);
const RESERVED_ATTRIBUTES = new Set(["id", "type", "@context", "location", "__proto__", "constructor", "prototype"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGeometry(value: unknown): boolean {
  if (!isObject(value) || typeof value.type !== "string") return false;
  if (value.type === "GeometryCollection") {
    return Array.isArray(value.geometries) && value.geometries.every(isGeometry);
  }
  return GEOMETRY_TYPES.has(value.type) && Array.isArray(value.coordinates);
}

function entityId(value: unknown, mapping: GeoJsonMapping): string {
  if (typeof value !== "string" && !(typeof value === "number" && Number.isFinite(value))) {
    throw new Error("Expected a string or numeric feature ID.");
  }
  const id = String(value).trim();
  if (!id) throw new Error("Expected a non-empty feature ID.");
  if (typeof value === "string" && /^[a-z][a-z0-9+.-]*:[^\s]+$/i.test(id)) {
    return id;
  }
  return `urn:ngsi-ld:${encodeURIComponent(mapping.type)}:${encodeURIComponent(id)}`;
}

function convertFeature(feature: unknown, mapping: GeoJsonMapping): Record<string, unknown> {
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
    throw new Error("Expected a GeoJSON geometry or null.");
  }

  const attributes = Object.entries(properties).flatMap(([name, value]) => {
    if (name === mapping.idField) return [];
    if (name.trim().length === 0 || RESERVED_ATTRIBUTES.has(name)) {
      throw new Error(`Invalid entity attribute name ${JSON.stringify(name)} in GeoJSON properties.`);
    }
    return [[name, { type: "Property", value }]];
  });
  return {
    ...Object.fromEntries(attributes),
    id,
    type: mapping.type,
    ...(feature.geometry !== null && { location: { type: "GeoProperty", value: feature.geometry } }),
  };
}

export function recordsFromGeoJson(data: unknown, mapping: GeoJsonMapping): EntityRecord[] {
  if (!isObject(data) || data.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection.");
  }
  return data.features.map((feature, i) => {
    const lineNumber = i + 1;
    try {
      const value = convertFeature(feature, mapping);
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
