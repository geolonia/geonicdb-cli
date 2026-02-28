import { Given } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD } from "../support/world.js";

Given("I am logged in with an invalidated token", async function (this: GdbWorld) {
  // Perform real login to get valid tokens
  this.writeConfig({ url: this.serverUrl });
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(this.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);

  // Invalidate the token but keep the refreshToken intact
  const config = this.readConfig();
  config.token = "invalidated";
  this.writeConfig(config);
});
