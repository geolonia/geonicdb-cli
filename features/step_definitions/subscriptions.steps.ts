import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a subscription for type {string}", async function (this: GdbWorld, type: string) {
  const sub = JSON.stringify({
    type: "Subscription",
    description: `Notify on ${type} changes`,
    entities: [{ type }],
    watchedAttributes: ["temperature"],
    notification: {
      endpoint: { uri: "http://localhost:3000/notify" },
      attributes: ["temperature"],
    },
  });
  await this.run(["subscriptions", "create", sub]);
});

Given("I get the subscription ID from the list", async function (this: GdbWorld) {
  await this.run(["subscriptions", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list subscriptions: ${this.lastResult.stderr}`);
  const subs = JSON.parse(this.lastResult.stdout);
  assert.ok(Array.isArray(subs) && subs.length > 0, "No subscriptions found");
  (this as Record<string, unknown>).subscriptionId = subs[0].id;
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
