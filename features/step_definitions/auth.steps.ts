import { Given, When, Then } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { mockServer } from "../support/mock-server.js";
import type { GdbWorld } from "../support/world.js";

Given("a mock auth server that accepts login", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
  mockServer.addRoute("POST", "/auth/tokens", (_req, body) => {
    const { email, password } = JSON.parse(body);
    if (email && password) {
      return {
        status: 200,
        body: { token: "mock-token-abc123", refreshToken: "mock-refresh-xyz" },
      };
    }
    return { status: 401, body: { error: "Unauthorized", description: "Invalid credentials" } };
  });
});

Given("a mock auth server that rejects login", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
  mockServer.addRoute("POST", "/auth/tokens", () => ({
    status: 401,
    body: { error: "Unauthorized", description: "Invalid credentials" },
  }));
});

Given("a mock auth server that returns user info", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl, token: "valid-token" });
  mockServer.addRoute("GET", "/auth/me", () => ({
    status: 200,
    body: { email: "user@example.com", name: "Test User", role: "admin" },
  }));
});

Given("a mock auth server that returns 401 for user info", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl, token: "expired-token" });
  mockServer.addRoute("GET", "/auth/me", () => ({
    status: 401,
    body: { error: "Unauthorized", description: "Token expired" },
  }));
});

Given("a mock auth server with server error", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
  mockServer.addRoute("POST", "/auth/tokens", () => ({
    status: 500,
    body: { error: "InternalError", description: "Server error" },
  }));
});

Given("I am logged in", function (this: GdbWorld) {
  this.writeConfig({
    url: this.serverUrl,
    token: "existing-token",
    refreshToken: "existing-refresh-token",
  });
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

When("I run login with credentials", async function (this: GdbWorld) {
  await this.run(["login"], { GDB_EMAIL: "user@example.com", GDB_PASSWORD: "secret123" });
});

When("I run login with credentials and URL", async function (this: GdbWorld) {
  await this.run(["login", "--url", this.serverUrl], { GDB_EMAIL: "user@example.com", GDB_PASSWORD: "secret123" });
});

When("I run login without credentials", async function (this: GdbWorld) {
  await this.run(["login"]);
});

Then("a token should be saved in config", function (this: GdbWorld) {
  const config = this.readConfig();
  assert.ok(config.token, `Expected token to be saved. Config: ${JSON.stringify(config)}`);
});

Then("the token should be {string}", function (this: GdbWorld, expected: string) {
  const config = this.readConfig();
  assert.equal(config.token, expected, `Expected token "${expected}", got "${config.token}".`);
});

Then("a refresh token should be saved in config", function (this: GdbWorld) {
  const config = this.readConfig();
  assert.ok(config.refreshToken, `Expected refreshToken to be saved. Config: ${JSON.stringify(config)}`);
});

Then("no token should be in config", function (this: GdbWorld) {
  const config = this.readConfig();
  assert.ok(!config.token, `Expected no token in config. Config: ${JSON.stringify(config)}`);
});

Then("no refresh token should be in config", function (this: GdbWorld) {
  const config = this.readConfig();
  assert.ok(!config.refreshToken, `Expected no refreshToken in config. Config: ${JSON.stringify(config)}`);
});

Then("the auth server should have received a POST to {string}", function (this: GdbWorld, path: string) {
  const req = mockServer.requests.find((r) => r.method === "POST" && r.url === path);
  assert.ok(req, `Expected POST request to "${path}". Requests: ${JSON.stringify(mockServer.requests.map((r) => `${r.method} ${r.url}`))}`);
});

Then("the auth request body should contain email {string}", function (this: GdbWorld, email: string) {
  const req = mockServer.requests.find((r) => r.method === "POST" && r.url === "/auth/tokens");
  assert.ok(req, "Expected POST to /auth/tokens");
  const body = JSON.parse(req.body);
  assert.equal(body.email, email);
});
