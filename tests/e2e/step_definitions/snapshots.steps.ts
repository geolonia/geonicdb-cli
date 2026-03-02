import { Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

Then("the snapshot count should be at least {int}", function (this: GdbWorld, min: number) {
  const data = JSON.parse(this.lastResult.stdout);
  const snapshots = Array.isArray(data) ? data : data.snapshots ?? [];
  assert.ok(snapshots.length >= min, `Expected at least ${min} snapshots, got ${snapshots.length}`);
});
