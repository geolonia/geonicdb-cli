import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard for geonicdb ≥ 0.17.0 (ETSI GS CIM 009 clause 5.7.2.4 / 5.7.4.4):
 * GET /entities and GET /temporal/entities reject too-wide queries unless
 * type / non-system attrs / non-system q / geoquery / local=true is present.
 *
 * `--count`, `--limit`, `--id-pattern`, and `--offset` alone are NOT enough
 * (idPattern is explicitly not an exemption). E2E fixtures that hit the server
 * must carry a real restriction or `--local`.
 *
 * Closes #212.
 */

const FEATURES_DIR = join(import.meta.dirname, "e2e", "features");

/** Flags that satisfy assertQueryRestrictionPresent (or skip the live request). */
const RESTRICTION_OR_SKIP =
  /(?:^|\s)(--type|--attrs|--query|--georel|--geometry|--coords|--local|--dry-run)(?:\s|=|$)/;

/**
 * CLI rejects these before any HTTP call, so they never reach the server's
 * too-wide check even without a restriction flag.
 */
function failsClientSideBeforeRequest(cmd: string): boolean {
  // temporal list: --aggr-methods without --aggr-period
  if (
    /\btemporal entities list\b/.test(cmd) &&
    /(?:^|\s)--aggr-methods(?:\s|=|$)/.test(cmd) &&
    !/(?:^|\s)--aggr-period(?:\s|=|$)/.test(cmd)
  ) {
    return true;
  }
  // --context validation (absolute URL / ASCII / header forging) is client-side
  if (/(?:^|\s)--context(?:\s|=|$)/.test(cmd) && !/(?:^|\s)--dry-run(?:\s|=|$)/.test(cmd)) {
    // Only treat clearly-invalid contexts as client-side; valid contexts still hit the server.
    // Heuristic: scenarios that only pass --context (no type/local) and expect rejection
    // use not-a-url, header-forging, or non-ASCII — those never reach GET.
    if (
      /not-a-url/.test(cmd) ||
      / extra["']/.test(cmd) ||
      /[\u0080-\uFFFF]/.test(cmd)
    ) {
      return true;
    }
  }
  return false;
}

const LIST_CMD =
  /`geonic (?:temporal )?entities list(?:\s+([^`]*))?`/g;

function collectViolations(): string[] {
  const files = readdirSync(FEATURES_DIR).filter((f) => f.endsWith(".feature"));
  const violations: string[] = [];

  for (const file of files) {
    const path = join(FEATURES_DIR, file);
    const lines = readFileSync(path, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      LIST_CMD.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = LIST_CMD.exec(line)) !== null) {
        const args = match[1] ?? "";
        const full = match[0].slice(1, -1); // strip backticks
        if (RESTRICTION_OR_SKIP.test(` ${args} `)) continue;
        if (failsClientSideBeforeRequest(full)) continue;
        violations.push(`${file}:${i + 1}: ${full}`);
      }
    }
  }
  return violations;
}

describe("E2E list fixtures vs too-wide query (#212)", () => {
  it("requires type/attrs/query/geo/--local/--dry-run on live entities list calls", () => {
    expect(collectViolations()).toEqual([]);
  });

  // near-miss: pagination / idPattern look like selectors but are not exemptions.
  it("flags --limit / --count / --id-pattern alone as too-wide (near-miss)", () => {
    const nearMiss = [
      "geonic entities list --limit 2",
      "geonic entities list --count",
      "geonic entities list --id-pattern Sensor",
      "geonic temporal entities list --offset 0",
    ];
    for (const cmd of nearMiss) {
      const args = cmd.replace(/^geonic (?:temporal )?entities list\s*/, "");
      expect(RESTRICTION_OR_SKIP.test(` ${args} `), cmd).toBe(false);
      expect(failsClientSideBeforeRequest(cmd), cmd).toBe(false);
    }
  });
});
