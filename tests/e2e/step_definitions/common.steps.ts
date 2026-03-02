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

When("I run {string}", async function (this: GdbWorld, command: string) {
  const args = stripCommandPrefix(parseArgs(command));
  await this.run(args);
});

When("I run {string} with URL", async function (this: GdbWorld, command: string) {
  const args = stripCommandPrefix(parseArgs(command));
  args.push("--url", this.serverUrl);
  await this.run(args);
});

When("I run {string} with env {string}", async function (this: GdbWorld, command: string, envPair: string) {
  const args = stripCommandPrefix(parseArgs(command));
  const eqIdx = envPair.indexOf("=");
  const key = envPair.substring(0, eqIdx);
  const value = envPair.substring(eqIdx + 1);
  await this.run(args, { [key]: value });
});

When("I run {string} replacing ID", async function (this: GdbWorld, command: string) {
  const savedId = (this as Record<string, unknown>).savedId as string;
  assert.ok(savedId, "No saved ID available. Run 'I save the ID from the JSON output' first.");
  const resolved = command.replace(/\$ID/g, savedId);
  const args = stripCommandPrefix(parseArgs(resolved));
  await this.run(args);
});

Given("I save the ID from the JSON output", function (this: GdbWorld) {
  const parsed = extractJson(this.lastResult.stdout);
  assert.ok(parsed !== null, `Expected stdout to contain valid JSON.\nstdout: ${this.lastResult.stdout}`);
  const data: unknown = parsed;
  let list: Record<string, unknown>[];
  if (Array.isArray(data)) {
    list = data;
  } else {
    const nested = Object.values(data as Record<string, unknown>).find((v) => Array.isArray(v));
    list = (nested as Record<string, unknown>[]) ?? [];
  }
  assert.ok(list.length > 0, `No items found in JSON output.\nstdout: ${this.lastResult.stdout}`);
  const item = list[list.length - 1];
  const id = item.id ?? item._id ?? item.policyId ?? item.tenantId ?? item.userId ?? item.clientId ?? item.ruleId;
  assert.ok(id, `Could not extract ID from: ${JSON.stringify(item)}`);
  (this as Record<string, unknown>).savedId = String(id);
});

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

Then("stderr should contain {string}", function (this: GdbWorld, text: string) {
  assert.ok(this.lastResult.stderr.includes(text), `Expected stderr to contain "${text}".\nstderr: ${this.lastResult.stderr}`);
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

Then("the JSON array length should be {int}", function (this: GdbWorld, expected: number) {
  const data = JSON.parse(this.lastResult.stdout);
  const arr = Array.isArray(data) ? data : [];
  assert.equal(arr.length, expected, `Expected JSON array length ${expected}, got ${arr.length}.\nstdout: ${this.lastResult.stdout}`);
});

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

/** Extract the first JSON object or array from stdout (ignoring trailing non-JSON lines) */
function extractJson(text: string): Record<string, unknown> | null {
  // Try parsing the entire text first
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Fall through
  }
  // Find the last closing brace/bracket and try parsing up to that point
  const lastBrace = text.lastIndexOf("}");
  const lastBracket = text.lastIndexOf("]");
  const endIdx = Math.max(lastBrace, lastBracket);
  if (endIdx >= 0) {
    try {
      return JSON.parse(text.substring(0, endIdx + 1)) as Record<string, unknown>;
    } catch {
      // Fall through
    }
  }
  return null;
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
