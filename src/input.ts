import { readFileSync } from "node:fs";

/**
 * Parse JSON input from a string, file (@path), or stdin (-).
 */
export function parseJsonInput(input: string): unknown {
  if (input === "-") {
    const data = readFileSync(0, "utf-8");
    return JSON.parse(data);
  }

  if (input.startsWith("@")) {
    const filePath = input.slice(1);
    const data = readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  }

  return JSON.parse(input);
}
