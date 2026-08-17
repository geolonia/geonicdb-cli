import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Guard for geonicdb ≥ 0.17.0 (ETSI GS CIM 009 clause 5.7.2.4 / 5.7.4.4):
 * GET /entities and GET /temporal/entities reject too-wide queries unless
 * type / non-system attrs / non-system q / geoquery / local=true is present.
 *
 * `--count`, `--limit`, `--id-pattern`, and `--offset` alone are NOT enough
 * (idPattern is explicitly not an exemption). System-only `--attrs` /
 * `--query` (e.g. `--attrs createdAt`, `--query id==…`) are also too-wide.
 * E2E fixtures that hit the server must carry a real restriction or `--local`.
 *
 * Closes #212.
 */

const FEATURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "e2e", "features");

/** Mirror geonicdb `SYSTEM_ATTRIBUTE_NAMES` (query-param-validation.ts). */
const SYSTEM_ATTRIBUTE_NAMES: ReadonlySet<string> = new Set([
  "id",
  "@id",
  "type",
  "@type",
  "scope",
  "createdAt",
  "modifiedAt",
  "deletedAt",
  "observedAt",
  "instanceId",
]);

function hasNonSystemAttribute(csv: string | undefined): boolean {
  if (!csv) return false;
  return csv
    .split(",")
    .map((s) => s.trim())
    .some((s) => s.length > 0 && !SYSTEM_ATTRIBUTE_NAMES.has(s));
}

/** Mirror geonicdb `queryHasNonSystemAttribute` (attribute-path head only). */
function queryHasNonSystemAttribute(q: string | undefined): boolean {
  if (!q || q.trim().length === 0) return false;
  const tokens = q
    .split(/[;|()]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return tokens.some((token) => {
    const lhs = token.replace(/^!/, "").split(/[=!<>~]/)[0]!.trim();
    const head = lhs.split(/[.[]/)[0]!.trim();
    return head.length > 0 && !SYSTEM_ATTRIBUTE_NAMES.has(head);
  });
}

/** Extract `--flag value` / `--flag=value` (quoted or bare). */
function flagValue(args: string, flag: string): string | undefined {
  const re = new RegExp(
    `(?:^|\\s)${flag}(?:=|\\s+)(?:"([^"]*)"|'([^']*)'|(\\S+))`,
  );
  const m = re.exec(` ${args} `);
  if (!m) return undefined;
  return m[1] ?? m[2] ?? m[3];
}

function hasFlag(args: string, flag: string): boolean {
  return new RegExp(`(?:^|\\s)${flag}(?:\\s|=|$)`).test(` ${args} `);
}

/**
 * True when list args would satisfy assertQueryRestrictionPresent, or the
 * invocation is --dry-run (no live GET).
 */
function hasLiveQueryRestriction(listArgs: string): boolean {
  const args = ` ${listArgs} `;
  if (hasFlag(args, "--dry-run") || hasFlag(args, "--local")) return true;
  const type = flagValue(args, "--type");
  if (type !== undefined && type.trim().length > 0) return true;
  if (hasFlag(args, "--georel") || hasFlag(args, "--geometry") || hasFlag(args, "--coords")) {
    return true;
  }
  if (hasNonSystemAttribute(flagValue(args, "--attrs"))) return true;
  if (queryHasNonSystemAttribute(flagValue(args, "--query"))) return true;
  return false;
}

/**
 * CLI rejects these before any HTTP call, so they never reach the server's
 * too-wide check even without a restriction flag.
 */
function failsClientSideBeforeRequest(cmd: string): boolean {
  if (
    /\btemporal entities list\b/.test(cmd) &&
    hasFlag(cmd, "--aggr-methods") &&
    !hasFlag(cmd, "--aggr-period")
  ) {
    return true;
  }
  if (hasFlag(cmd, "--context") && !hasFlag(cmd, "--dry-run")) {
    if (/not-a-url/.test(cmd) || / extra["']/.test(cmd) || /[\u0080-\uFFFF]/.test(cmd)) {
      return true;
    }
  }
  return false;
}

/**
 * Match `geonic … entities list …` / `geonic … temporal entities list …`,
 * including global flags before the subcommand (e.g. `--profile p`).
 */
const GEONIC_BACKTICK = /`geonic\b([^`]*)`/g;
const LIST_SUBCOMMAND = /(?:^|\s)((?:temporal\s+)?entities\s+list)\b(?:\s+(.*))?$/;

function extractListInvocations(line: string): Array<{ full: string; listArgs: string }> {
  const out: Array<{ full: string; listArgs: string }> = [];
  GEONIC_BACKTICK.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = GEONIC_BACKTICK.exec(line)) !== null) {
    const body = m[1]!.trim();
    const listMatch = LIST_SUBCOMMAND.exec(body);
    if (!listMatch) continue;
    out.push({
      full: `geonic ${body}`,
      listArgs: (listMatch[2] ?? "").trim(),
    });
  }
  return out;
}

function collectViolations(): string[] {
  const files = readdirSync(FEATURES_DIR).filter((f) => f.endsWith(".feature"));
  const violations: string[] = [];

  for (const file of files) {
    const path = join(FEATURES_DIR, file);
    const lines = readFileSync(path, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const { full, listArgs } of extractListInvocations(lines[i]!)) {
        if (hasLiveQueryRestriction(listArgs)) continue;
        if (failsClientSideBeforeRequest(full)) continue;
        violations.push(`${file}:${i + 1}: ${full}`);
      }
    }
  }
  return violations;
}

describe("E2E list fixtures vs too-wide query (#212)", () => {
  it("requires a real restriction (or --local/--dry-run) on live entities list calls", () => {
    expect(collectViolations()).toEqual([]);
  });

  // near-miss: pagination / idPattern look like selectors but are not exemptions.
  it("flags --limit / --count / --id-pattern alone as too-wide (near-miss)", () => {
    const nearMiss = [
      "--limit 2",
      "--count",
      "--id-pattern Sensor",
      "--offset 0",
    ];
    for (const args of nearMiss) {
      expect(hasLiveQueryRestriction(args), args).toBe(false);
    }
  });

  // near-miss: system-only attrs/q satisfy the flag presence but not the server.
  it("flags system-only --attrs / --query as too-wide (near-miss)", () => {
    expect(hasLiveQueryRestriction("--attrs createdAt")).toBe(false);
    expect(hasLiveQueryRestriction("--attrs id,type")).toBe(false);
    expect(hasLiveQueryRestriction("--query id==urn:ngsi-ld:Room:1")).toBe(false);
    expect(hasLiveQueryRestriction("--attrs createdAt,temperature")).toBe(true);
    expect(hasLiveQueryRestriction("--query temperature>30")).toBe(true);
  });

  it("detects list invocations with global flags before the subcommand", () => {
    const withProfile = extractListInvocations(
      "When I run `geonic --profile p entities list`",
    );
    expect(withProfile).toEqual([{ full: "geonic --profile p entities list", listArgs: "" }]);
    expect(hasLiveQueryRestriction(withProfile[0]!.listArgs)).toBe(false);

    const ok = extractListInvocations(
      "When I run `geonic --profile p entities list --local`",
    );
    expect(ok).toEqual([
      { full: "geonic --profile p entities list --local", listArgs: "--local" },
    ]);
    expect(hasLiveQueryRestriction(ok[0]!.listArgs)).toBe(true);

    const temporal = extractListInvocations(
      "When I run `geonic --url http://x temporal entities list --type Room`",
    );
    expect(temporal[0]!.listArgs).toBe("--type Room");
    expect(hasLiveQueryRestriction(temporal[0]!.listArgs)).toBe(true);
  });
});
