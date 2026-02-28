import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD } from "../support/world.js";

Given("I have a valid API key from login", async function (this: GdbWorld) {
  // Perform real login to get a valid JWT
  this.writeConfig({ url: this.serverUrl });
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(this.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);

  // Read the JWT token and store it as API key
  const config = this.readConfig();
  this.env.VALID_API_KEY = config.token as string;

  // Remove token from config so only the API key is used
  delete config.token;
  delete config.refreshToken;
  this.writeConfig(config);
});

When("I run entities list with api-key flag", async function (this: GdbWorld) {
  await this.run(["entities", "list", "--api-key", this.env.VALID_API_KEY, "--url", this.serverUrl]);
});

When("I run entities list with api-key env var", async function (this: GdbWorld) {
  await this.run(["entities", "list"], { GDB_API_KEY: this.env.VALID_API_KEY });
});

Given("I have a valid API key saved in config as apiKey", async function (this: GdbWorld) {
  // Perform real login to get a valid JWT
  this.writeConfig({ url: this.serverUrl });
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(this.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);

  // Read the JWT and save it as apiKey in config (remove token)
  const config = this.readConfig();
  const jwt = config.token as string;
  delete config.token;
  delete config.refreshToken;
  config.apiKey = jwt;
  this.writeConfig(config);
});

Given("I am logged in with token and invalid apiKey in config", async function (this: GdbWorld) {
  // Perform real login (token is valid)
  this.writeConfig({ url: this.serverUrl });
  await this.run(["login"], { GDB_EMAIL: TEST_EMAIL, GDB_PASSWORD: TEST_PASSWORD });
  assert.equal(this.lastResult.exitCode, 0, `Login failed during setup.\nstdout: ${this.lastResult.stdout}\nstderr: ${this.lastResult.stderr}`);

  // Add invalid apiKey to config (token stays valid)
  const config = this.readConfig();
  config.apiKey = "invalid-not-a-jwt";
  this.writeConfig(config);
});
