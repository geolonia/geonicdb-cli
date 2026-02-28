import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD } from "../support/world.js";

async function performLogin(world: GdbWorld): Promise<Record<string, unknown>> {
  world.writeConfig({ url: world.serverUrl });
  await world.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(world.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${world.lastResult.stdout}\nstderr: ${world.lastResult.stderr}`);
  return world.readConfig();
}

function stripAuthTokens(config: Record<string, unknown>): void {
  delete config.token;
  delete config.refreshToken;
}

Given("I have a valid API key from login", async function (this: GdbWorld) {
  const config = await performLogin(this);
  this.env.VALID_API_KEY = config.token as string;

  stripAuthTokens(config);
  this.writeConfig(config);
});

When("I run entities list with api-key flag", async function (this: GdbWorld) {
  await this.run(["entities", "list", "--api-key", this.env.VALID_API_KEY, "--url", this.serverUrl]);
});

When("I run entities list with api-key env var", async function (this: GdbWorld) {
  await this.run(["entities", "list"], { GDB_API_KEY: this.env.VALID_API_KEY });
});

Given("I have a valid API key saved in config as apiKey", async function (this: GdbWorld) {
  const config = await performLogin(this);
  const jwt = config.token as string;
  stripAuthTokens(config);
  config.apiKey = jwt;
  this.writeConfig(config);
});

Given("I am logged in with token and invalid apiKey in config", async function (this: GdbWorld) {
  const config = await performLogin(this);
  config.apiKey = "invalid-not-a-jwt";
  this.writeConfig(config);
});
