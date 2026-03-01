import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a rule {string}", async function (this: GdbWorld, name: string) {
  const payload = JSON.stringify({
    name,
    description: `Rule ${name}`,
    conditions: [{ type: "celExpression", expression: "entity.temperature > 30" }],
    actions: [{ type: "webhook", url: "http://localhost:5000/rules", method: "POST" }],
  });
  await this.run(["rules", "create", payload]);
});

Given("I get the rule ID from the list", async function (this: GdbWorld) {
  await this.run(["rules", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list rules: ${this.lastResult.stderr}`);
  const data = JSON.parse(this.lastResult.stdout);
  const rules = Array.isArray(data) ? data : [];
  assert.ok(rules.length > 0, "No rules found");
  const rule = rules[rules.length - 1];
  (this as Record<string, unknown>).ruleId = rule.id ?? rule.ruleId ?? rule._id;
});

When("I get the rule by ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).ruleId as string;
  assert.ok(id, "No rule ID saved");
  await this.run(["rules", "get", id]);
});

When("I delete the rule", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).ruleId as string;
  assert.ok(id, "No rule ID saved");
  await this.run(["rules", "delete", id]);
});

When("I activate the rule", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).ruleId as string;
  assert.ok(id, "No rule ID saved");
  await this.run(["rules", "activate", id]);
});

When("I deactivate the rule", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).ruleId as string;
  assert.ok(id, "No rule ID saved");
  await this.run(["rules", "deactivate", id]);
});
