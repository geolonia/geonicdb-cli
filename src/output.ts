import chalk from "chalk";
import type { OutputFormat } from "./types.js";

export function formatOutput(data: unknown, format: OutputFormat): string {
  switch (format) {
    case "json":
      return JSON.stringify(data, null, 2);
    case "table":
      return formatTable(data);
    case "keyValues":
      return JSON.stringify(data, null, 2);
    case "geojson":
      return JSON.stringify(toGeoJSON(data), null, 2);
    default:
      return JSON.stringify(data, null, 2);
  }
}

export function printOutput(data: unknown, format: OutputFormat): void {
  console.log(formatOutput(data, format));
}

export function printSuccess(message: string): void {
  console.log(chalk.green(message));
}

export function printError(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}

export function printInfo(message: string): void {
  console.log(chalk.cyan(message));
}

export function printWarning(message: string): void {
  console.log(chalk.yellow(message));
}

export function printCount(count: number): void {
  console.log(chalk.dim(`Count: ${count}`));
}

function formatTable(data: unknown): string {
  if (!Array.isArray(data)) {
    if (typeof data === "object" && data !== null) {
      return formatObjectTable(data as Record<string, unknown>);
    }
    return String(data);
  }

  if (data.length === 0) return "(empty)";

  const items = data as Record<string, unknown>[];
  const keys = collectKeys(items);

  const widths = new Map<string, number>();
  for (const key of keys) {
    widths.set(key, key.length);
  }
  for (const item of items) {
    for (const key of keys) {
      const val = cellValue(item[key]);
      widths.set(key, Math.max(widths.get(key)!, val.length));
    }
  }

  const header = keys.map((k) => chalk.bold(k.padEnd(widths.get(k)!))).join("  ");
  const separator = keys.map((k) => "─".repeat(widths.get(k)!)).join("──");
  const rows = items.map((item) =>
    keys.map((k) => cellValue(item[k]).padEnd(widths.get(k)!)).join("  "),
  );

  return [header, separator, ...rows].join("\n");
}

function formatObjectTable(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "(empty)";

  const keyWidth = Math.max(...entries.map(([k]) => k.length));
  return entries.map(([k, v]) => `${chalk.bold(k.padEnd(keyWidth))}  ${cellValue(v)}`).join("\n");
}

function collectKeys(items: Record<string, unknown>[]): string[] {
  const priority = ["id", "type"];
  const keySet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      keySet.add(key);
    }
  }
  const sorted: string[] = [];
  for (const p of priority) {
    if (keySet.has(p)) {
      sorted.push(p);
      keySet.delete(p);
    }
  }
  sorted.push(...Array.from(keySet).sort());
  return sorted;
}

function cellValue(val: unknown): string {
  if (val === undefined || val === null) return "";
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    if ("value" in obj) return String(obj.value);
    return JSON.stringify(val);
  }
  return String(val);
}

function toGeoJSON(data: unknown): unknown {
  if (Array.isArray(data)) {
    return {
      type: "FeatureCollection",
      features: data.map(entityToFeature),
    };
  }
  return entityToFeature(data);
}

function entityToFeature(entity: unknown): unknown {
  if (typeof entity !== "object" || entity === null) {
    return { type: "Feature", geometry: null, properties: entity };
  }

  const obj = entity as Record<string, unknown>;
  let geometry = null;

  if (obj.location) {
    const loc = obj.location as Record<string, unknown>;
    geometry = loc.value ?? loc;
  }

  const properties: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "location") continue;
    if (typeof value === "object" && value !== null && "value" in (value as object)) {
      properties[key] = (value as Record<string, unknown>).value;
    } else {
      properties[key] = value;
    }
  }

  return { type: "Feature", geometry, properties };
}
