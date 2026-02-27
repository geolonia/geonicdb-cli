import { Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

Then("the config should be empty", function (this: GdbWorld) {
  const config = this.readConfig();
  const keys = Object.keys(config);
  assert.equal(keys.length, 0, `Expected empty config. Config: ${JSON.stringify(config)}`);
});

Then("the config should have {int} key(s)", function (this: GdbWorld, count: number) {
  const config = this.readConfig();
  const keys = Object.keys(config);
  assert.equal(keys.length, count, `Expected ${count} keys. Config: ${JSON.stringify(config)}`);
});
