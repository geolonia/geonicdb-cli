import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a registration for type {string}", async function (this: GdbWorld, type: string) {
  const reg = JSON.stringify({
    type: "ContextSourceRegistration",
    information: [
      {
        entities: [{ type }],
      },
    ],
    endpoint: "http://localhost:4000/source",
  });
  await this.run(["registrations", "create", reg]);
});

Given("I get the registration ID from the list", async function (this: GdbWorld) {
  await this.run(["registrations", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list registrations: ${this.lastResult.stderr}`);
  const regs = JSON.parse(this.lastResult.stdout);
  assert.ok(Array.isArray(regs) && regs.length > 0, "No registrations found");
  (this as Record<string, unknown>).registrationId = regs[0].id;
});

When("I get the registration by ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).registrationId as string;
  assert.ok(id, "No registration ID saved");
  await this.run(["registrations", "get", id]);
});

When("I delete the registration", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).registrationId as string;
  assert.ok(id, "No registration ID saved");
  await this.run(["registrations", "delete", id]);
});
