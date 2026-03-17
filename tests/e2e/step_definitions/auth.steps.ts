import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, performLogin } from "../support/world.js";

Given("I am logged in", async function (this: GdbWorld) {
  await performLogin(this);
});

Given("I am logged in with token {string}", function (this: GdbWorld, token: string) {
  this.writeConfig({ url: this.serverUrl, token });
});

Given("I am not logged in", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
});

Given("I have invalid authentication tokens", function (this: GdbWorld) {
  this.writeConfig({
    url: this.serverUrl,
    token: "invalid",
    refreshToken: "invalid",
  });
});

When("I run login without credentials", async function (this: GdbWorld) {
  await this.run(["login"]);
});

Then("a token should be saved in config", function (this: GdbWorld) {
  const config = this.readProfileConfig();
  assert.ok(config.token, `Expected token to be saved. Config: ${JSON.stringify(config)}`);
});

Then("a refresh token should be saved in config", function (this: GdbWorld) {
  const config = this.readProfileConfig();
  assert.ok(config.refreshToken, `Expected refreshToken to be saved. Config: ${JSON.stringify(config)}`);
});

Then("no token should be in config", function (this: GdbWorld) {
  const config = this.readProfileConfig();
  assert.ok(!config.token, `Expected no token in config. Config: ${JSON.stringify(config)}`);
});

Then("no refresh token should be in config", function (this: GdbWorld) {
  const config = this.readProfileConfig();
  assert.ok(!config.refreshToken, `Expected no refreshToken in config. Config: ${JSON.stringify(config)}`);
});
