import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a subscription for type {string}", async function (this: GdbWorld, type: string) {
  const sub = JSON.stringify({
    description: `Notify on ${type} changes`,
    subject: {
      entities: [{ type }],
      condition: { attrs: ["temperature"] },
    },
    notification: {
      http: { url: "http://localhost:3000/notify" },
      attrs: ["temperature"],
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
