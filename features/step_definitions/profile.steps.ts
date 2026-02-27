import { Given, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GdbWorld } from "../support/world.js";

Given("a v2 config with profiles:", function (this: GdbWorld, docString: string) {
  const config = JSON.parse(docString);
  writeFileSync(join(this.configDir, "config.json"), JSON.stringify(config, null, 2) + "\n");
});

Then("the config should have profile {string}", function (this: GdbWorld, profileName: string) {
  const config = this.readFullConfig();
  const profiles = config.profiles as Record<string, unknown> | undefined;
  assert.ok(profiles && profileName in profiles, `Expected profile "${profileName}" in config. Config: ${JSON.stringify(config)}`);
});

Then("the config should not have profile {string}", function (this: GdbWorld, profileName: string) {
  const config = this.readFullConfig();
  const profiles = config.profiles as Record<string, unknown> | undefined;
  assert.ok(!profiles || !(profileName in profiles), `Expected profile "${profileName}" NOT in config.`);
});

Then("the active profile should be {string}", function (this: GdbWorld, profileName: string) {
  const config = this.readFullConfig();
  assert.equal(config.currentProfile, profileName, `Expected active profile "${profileName}", got "${config.currentProfile}".`);
});
