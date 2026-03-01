import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a subscription for type {string}", async function (this: GdbWorld, type: string) {
  const description = `Notify on ${type} changes`;
  const sub = JSON.stringify({
    type: "Subscription",
    description,
    entities: [{ type }],
    watchedAttributes: ["temperature"],
    notification: {
      endpoint: { uri: "http://localhost:3000/notify" },
      attributes: ["temperature"],
    },
  });
  await this.run(["subscriptions", "create", sub]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to create subscription: ${this.lastResult.stderr}`);
  (this as Record<string, unknown>).subscriptionDescription = description;
});

Given("I get the subscription ID from the list", async function (this: GdbWorld) {
  const description = (this as Record<string, unknown>).subscriptionDescription as string | undefined;
  await this.run(["subscriptions", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list subscriptions: ${this.lastResult.stderr}`);
  const data = JSON.parse(this.lastResult.stdout);
  const subs = Array.isArray(data) ? data : data.subscriptions ?? [];
  assert.ok(subs.length > 0, "No subscriptions found");
  const target = description
    ? subs.find((s: Record<string, unknown>) => s.description === description) ?? subs[0]
    : subs[0];
  const id = (target as Record<string, unknown>).id ?? (target as Record<string, unknown>)._id;
  assert.ok(id, `Could not extract subscription ID from: ${JSON.stringify(target)}`);
  (this as Record<string, unknown>).subscriptionId = id;
});

When("I delete the subscription", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).subscriptionId as string;
  assert.ok(id, "No subscription ID saved");
  await this.run(["subscriptions", "delete", id]);
});

When("I get the subscription by ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).subscriptionId as string;
  assert.ok(id, "No subscription ID saved");
  await this.run(["subscriptions", "get", id]);
});

When("I update the subscription with {string}", async function (this: GdbWorld, json: string) {
  const id = (this as Record<string, unknown>).subscriptionId as string;
  assert.ok(id, "No subscription ID saved");
  await this.run(["subscriptions", "update", id, json]);
});
