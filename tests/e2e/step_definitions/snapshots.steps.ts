import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

Given("I get the snapshot ID from the list", async function (this: GdbWorld) {
  await this.run(["snapshots", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list snapshots: ${this.lastResult.stderr}`);
  const data = JSON.parse(this.lastResult.stdout);
  const snapshots = Array.isArray(data) ? data : data.snapshots ?? [];
  assert.ok(snapshots.length > 0, "No snapshots found");
  (this as Record<string, unknown>).snapshotId = snapshots[0].id ?? snapshots[0]._id;
});

When("I get the snapshot by ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).snapshotId as string;
  assert.ok(id, "No snapshot ID saved");
  await this.run(["snapshots", "get", id]);
});

When("I delete the snapshot", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).snapshotId as string;
  assert.ok(id, "No snapshot ID saved");
  await this.run(["snapshots", "delete", id]);
});

When("I clone the snapshot", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).snapshotId as string;
  assert.ok(id, "No snapshot ID saved");
  await this.run(["snapshots", "clone", id]);
});

Then("the snapshot count should be at least {int}", function (this: GdbWorld, min: number) {
  const data = JSON.parse(this.lastResult.stdout);
  const snapshots = Array.isArray(data) ? data : data.snapshots ?? [];
  assert.ok(snapshots.length >= min, `Expected at least ${min} snapshots, got ${snapshots.length}`);
});
