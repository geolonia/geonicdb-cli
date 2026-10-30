import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

Given("the CLI is configured with URL {string}", function (this: GdbWorld, url: string) {
  this.writeConfig({ url });
});

Given("the CLI is configured with:", function (this: GdbWorld, docString: string) {
  const config = JSON.parse(docString);
  this.writeConfig(config);
});

Given("the CLI is configured with server URL", function (this: GdbWorld) {
  const existing = this.readConfig();
  this.writeConfig({ ...existing, url: this.serverUrl });
});

Given("no config file exists", function (this: GdbWorld) {
  // configDir is already empty from Before hook
});

When(/^I run `([^`]+)`$/, async function (this: GdbWorld, command: string) {
  const args = stripCommandPrefix(parseArgs(command));
  await this.run(args);
});

When(/^I run `([^`]+)` with URL$/, async function (this: GdbWorld, command: string) {
  const args = stripCommandPrefix(parseArgs(command));
  args.push("--url", this.serverUrl);
  await this.run(args);
});

When(/^I run `([^`]+)` with stdin:$/, async function (this: GdbWorld, command: string, docString: string) {
  const args = stripCommandPrefix(parseArgs(command));
  await this.run(args, undefined, docString);
});

When(/^I run `([^`]+)` with env "([^"]+)"$/, async function (this: GdbWorld, command: string, envPair: string) {
  const args = stripCommandPrefix(parseArgs(command));
  const eqIdx = envPair.indexOf("=");
  const key = envPair.substring(0, eqIdx);
  const value = envPair.substring(eqIdx + 1);
  await this.run(args, { [key]: value });
});

When(/^I run `([^`]+)` replacing ID$/, async function (this: GdbWorld, command: string) {
  const savedId = (this as Record<string, unknown>).savedId as string;
  assert.ok(savedId, "No saved ID available. Run 'I save the ID from the JSON output' first.");
  const resolved = command.replace(/\$ID/g, savedId);
  const args = stripCommandPrefix(parseArgs(resolved));
  await this.run(args);
});

When(/^I run `([^`]+)` replacing vars$/, async function (this: GdbWorld, command: string) {
  const vars = ((this as Record<string, unknown>).savedVars ?? {}) as Record<string, string>;
  const resolved = command.replace(/\$([A-Z][A-Z0-9_]*)/g, (_match, name: string) => {
    assert.ok(vars[name], `No saved var $${name}. Run 'I save the ID ... as ${name}' first.`);
    return vars[name];
  });
  const args = stripCommandPrefix(parseArgs(resolved));
  await this.run(args);
});

When(/^I run `([^`]+)` replacing URL$/, async function (this: GdbWorld, command: string) {
  const savedUrl = (this as Record<string, unknown>).savedUrl as string;
  assert.ok(savedUrl, "No saved URL available. Run 'I save the url from the JSON output' first.");
  const resolved = command.replace(/\$URL/g, savedUrl);
  const args = stripCommandPrefix(parseArgs(resolved));
  await this.run(args);
});

Given("I save the ID from the JSON output", function (this: GdbWorld) {
  const item = findItemInJsonOutput(this.lastResult.stdout);
  const id = extractId(item);
  assert.ok(id, `Could not extract ID from: ${JSON.stringify(item)}`);
  (this as Record<string, unknown>).savedId = String(id);
});

/** Save `url` from a single JSON object (e.g. `geonic contexts create` output, #241). */
Given("I save the url from the JSON output", function (this: GdbWorld) {
  const json = extractJson(this.lastResult.stdout);
  assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
  const url = json.url;
  assert.ok(typeof url === "string" && url, `Expected JSON.url to be a non-empty string.\nJSON: ${JSON.stringify(json)}`);
  (this as Record<string, unknown>).savedUrl = url;
  // Hosted get/delete resolve by localId (URN), not by the broker's serve URL.
  const marker = "/jsonldContexts/";
  const idx = url.lastIndexOf(marker);
  if (idx >= 0) {
    (this as Record<string, unknown>).savedId = decodeURIComponent(url.slice(idx + marker.length));
  }
});

Given(/^I save the ID from the JSON output where "([^"]+)" is "([^"]+)"$/, function (this: GdbWorld, field: string, value: string) {
  const item = findItemInJsonOutput(this.lastResult.stdout, field, value);
  const id = extractId(item);
  assert.ok(id, `Could not extract ID from: ${JSON.stringify(item)}`);
  (this as Record<string, unknown>).savedId = String(id);
});

Given(
  /^I save the ID from the JSON output where "([^"]+)" is "([^"]+)" as ([A-Z][A-Z0-9_]*)$/,
  function (this: GdbWorld, field: string, value: string, name: string) {
    const item = findItemInJsonOutput(this.lastResult.stdout, field, value);
    const id = extractId(item);
    assert.ok(id, `Could not extract ID from: ${JSON.stringify(item)}`);
    const world = this as Record<string, unknown>;
    const vars = (world.savedVars ?? {}) as Record<string, string>;
    vars[name] = String(id);
    world.savedVars = vars;
  },
);

Then("the exit code should be {int}", function (this: GdbWorld, code: number) {
  assert.equal(this.lastResult.exitCode, code, `Expected exit code ${code}, got ${this.lastResult.exitCode}.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);
});

Then("the output should contain {string}", function (this: GdbWorld, text: string) {
  const combined = this.lastResult.stdout + "\n" + this.lastResult.stderr;
  assert.ok(combined.includes(text), `Expected output to contain "${text}".\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);
});

Then("the output should not contain {string}", function (this: GdbWorld, text: string) {
  const combined = this.lastResult.stdout + "\n" + this.lastResult.stderr;
  assert.ok(!combined.includes(text), `Expected output NOT to contain "${text}".\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);
});

Then("stdout should contain {string}", function (this: GdbWorld, text: string) {
  assert.ok(this.lastResult.stdout.includes(text), `Expected stdout to contain "${text}".\nstdout: ${this.lastResult.stdout}`);
});

Then("stdout should contain the saved URL", function (this: GdbWorld) {
  const savedUrl = (this as Record<string, unknown>).savedUrl as string;
  assert.ok(savedUrl, "No saved URL available. Run 'I save the url from the JSON output' first.");
  assert.ok(
    this.lastResult.stdout.includes(savedUrl),
    `Expected stdout to contain saved URL "${savedUrl}".\nstdout: ${this.lastResult.stdout}`,
  );
});

Then("stdout should not contain {string}", function (this: GdbWorld, text: string) {
  assert.ok(!this.lastResult.stdout.includes(text), `Expected stdout NOT to contain "${text}".\nstdout: ${this.lastResult.stdout}`);
});

Then("stderr should contain {string}", function (this: GdbWorld, text: string) {
  assert.ok(this.lastResult.stderr.includes(text), `Expected stderr to contain "${text}".\nstderr: ${this.lastResult.stderr}`);
});

Then("stderr should not contain {string}", function (this: GdbWorld, text: string) {
  assert.ok(!this.lastResult.stderr.includes(text), `Expected stderr NOT to contain "${text}".\nstderr: ${this.lastResult.stderr}`);
});

Then("stdout should be valid JSON", function (this: GdbWorld) {
  const json = extractJson(this.lastResult.stdout);
  assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
});

Then("the JSON output should have key {string}", function (this: GdbWorld, key: string) {
  const json = extractJson(this.lastResult.stdout);
  assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
  assert.ok(key in json, `Expected JSON output to have key "${key}".\nJSON: ${JSON.stringify(json)}`);
});

Then("the JSON output key {string} should be {string}", function (this: GdbWorld, key: string, value: string) {
  const json = extractJson(this.lastResult.stdout);
  assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
  assert.equal(String(json[key]), value, `Expected json.${key} to be "${value}", got "${json[key]}".`);
});

Then("the JSON output path {string} should be {string}", function (this: GdbWorld, path: string, value: string) {
  const json = extractJson(this.lastResult.stdout);
  assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
  const actual = getJsonPath(json, path);
  assert.equal(String(actual), value, `Expected json.${path} to be "${value}", got "${actual}".`);
});

Then("the JSON array length should be {int}", function (this: GdbWorld, expected: number) {
  const data = JSON.parse(this.lastResult.stdout);
  const arr = Array.isArray(data) ? data : [];
  assert.equal(arr.length, expected, `Expected JSON array length ${expected}, got ${arr.length}.\nstdout: ${this.lastResult.stdout}`);
});

Then(
  /^the JSON output array "([^"]+)" should contain an object with "([^"]+)" "([^"]+)" and "([^"]+)" "([^"]+)"$/,
  function (
    this: GdbWorld,
    arrayKey: string,
    key1: string,
    value1: string,
    key2: string,
    value2: string,
  ) {
    const json = extractJson(this.lastResult.stdout);
    assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
    const arr = json[arrayKey];
    assert.ok(Array.isArray(arr), `Expected json.${arrayKey} to be an array.\nJSON: ${JSON.stringify(json)}`);
    const found = (arr as Record<string, unknown>[]).some(
      (item) =>
        item != null &&
        typeof item === "object" &&
        String(item[key1]) === value1 &&
        String(item[key2]) === value2,
    );
    assert.ok(
      found,
      `Expected json.${arrayKey} to contain { ${key1}: ${JSON.stringify(value1)}, ${key2}: ${JSON.stringify(value2)} }.\nJSON: ${JSON.stringify(json)}`,
    );
  },
);

Then(
  /^the JSON output array "([^"]+)" should not contain an object with "([^"]+)" "([^"]+)"$/,
  function (this: GdbWorld, arrayKey: string, key: string, value: string) {
    const json = extractJson(this.lastResult.stdout);
    assert.ok(json !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
    const arr = json[arrayKey];
    assert.ok(Array.isArray(arr), `Expected json.${arrayKey} to be an array.\nJSON: ${JSON.stringify(json)}`);
    const found = (arr as Record<string, unknown>[]).some(
      (item) => item != null && typeof item === "object" && String(item[key]) === value,
    );
    assert.ok(
      !found,
      `Expected json.${arrayKey} NOT to contain { ${key}: ${JSON.stringify(value)} }.\nJSON: ${JSON.stringify(json)}`,
    );
  },
);

Then("the config should have key {string}", function (this: GdbWorld, key: string) {
  const config = this.readProfileConfig();
  assert.ok(key in config, `Expected config to have key "${key}". Config: ${JSON.stringify(config)}`);
});

Then("the config key {string} should be {string}", function (this: GdbWorld, key: string, value: string) {
  const config = this.readProfileConfig();
  assert.equal(String(config[key]), value, `Expected config.${key} to be "${value}", got "${config[key]}".`);
});

Then("the config should not have key {string}", function (this: GdbWorld, key: string) {
  const config = this.readProfileConfig();
  assert.ok(!(key in config), `Expected config NOT to have key "${key}". Config: ${JSON.stringify(config)}`);
});

/** Resolve a dotted path (e.g. settings.caddeEnabled) against a JSON object. */
function getJsonPath(root: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = root;
  for (const part of parts) {
    if (cur === null || typeof cur !== "object" || Array.isArray(cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

/** Extract the first JSON object or array from stdout (ignoring leading/trailing non-JSON lines) */
function extractJson(text: string): Record<string, unknown> | null {
  // Try parsing the entire text first
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Fall through
  }
  // Find the JSON boundaries (first opening and last closing brace/bracket)
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");
  const startIdx =
    firstBrace >= 0 && firstBracket >= 0
      ? Math.min(firstBrace, firstBracket)
      : Math.max(firstBrace, firstBracket);
  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  const endIdx = Math.max(lastBrace, lastBracket);
  if (startIdx >= 0 && endIdx >= startIdx) {
    try {
      return JSON.parse(text.substring(startIdx, endIdx + 1)) as Record<string, unknown>;
    } catch {
      // Fall through
    }
  }
  return null;
}

function toList(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data;
  const nested = Object.values(data as Record<string, unknown>).find((v) => Array.isArray(v));
  return (nested as Record<string, unknown>[]) ?? [];
}

function findItemInJsonOutput(stdout: string, field?: string, value?: string): Record<string, unknown> {
  const parsed = extractJson(stdout);
  assert.ok(parsed !== null, `Expected stdout to contain valid JSON.\nstdout: ${stdout}`);
  const list = toList(parsed);
  assert.ok(list.length > 0, `No items found in JSON output.\nstdout: ${stdout}`);
  if (field && value) {
    const item = list.find((i) => String(i[field]) === value);
    assert.ok(item, `No item found where "${field}" is "${value}".\nstdout: ${stdout}`);
    return item;
  }
  return list[list.length - 1];
}

function extractId(item: Record<string, unknown>): string | undefined {
  const id = item.id ?? item._id ?? item.policyId ?? item.ruleId ?? item.tenantId ?? item.userId ?? item.clientId;
  return id ? String(id) : undefined;
}

function stripCommandPrefix(args: string[]): string[] {
  return args[0] === "geonic" ? args.slice(1) : args;
}

function parseArgs(command: string): string[] {
  // Simple argument parser that handles quoted strings
  const args: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (const ch of command) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === " ") {
      if (current) {
        args.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);

  return args;
}
