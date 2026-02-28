import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD } from "../support/world.js";

Given("I am logged in", async function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(this.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);
});

Given("I am logged in with token {string}", function (this: GdbWorld, token: string) {
  const config = this.readConfig();
  config.token = token;
  config.url = config.url ?? this.serverUrl;
  this.writeConfig(config);
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

When("I run login with credentials", async function (this: GdbWorld) {
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
});

When("I run login with credentials and URL", async function (this: GdbWorld) {
  await this.run(["login", "--url", this.serverUrl], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
});

When("I run login with invalid credentials", async function (this: GdbWorld) {
  await this.run(["login"], { GDB_EMAIL: "wrong@test.com", GDB_PASSWORD: "WrongPassword999!" });
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
