import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, performLogin, performSuperAdminLogin } from "../support/world.js";

Given("I am logged in", async function (this: GdbWorld) {
  await performLogin(this);
});

Given("I am logged in as super admin", async function (this: GdbWorld) {
  await performSuperAdminLogin(this);
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

// Static keys only for local SigV4 signing (API Gateway is absent; server returns 403).
Given("I have static AWS credentials for SigV4 signing", function (this: GdbWorld) {
  this.env.AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
  this.env.AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
  // Prevent ambient credentials / SSO from hijacking the signer in CI/dev machines.
  delete this.env.AWS_PROFILE;
  delete this.env.AWS_SESSION_TOKEN;
  // fromNodeProviderChain also reads process.env; world.run spreads process.env first,
  // then this.env — so these keys win. Clear profile selection via empty AWS_PROFILE.
  this.env.AWS_PROFILE = "";
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
