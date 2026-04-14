import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";
import { PW_TEST_EMAIL, PW_TEST_PASSWORD } from "../support/world.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log in as the dedicated password-test user (created in BeforeAll).
 * No admin API calls needed — the user is part of the baseline snapshot,
 * so it is restored between scenarios automatically.
 */
Given("I am logged in as password test user", async function (this: GdbWorld) {
  const loginRes = await fetch(new URL("/auth/login", this.serverUrl).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: PW_TEST_EMAIL, password: PW_TEST_PASSWORD }),
  });
  assert.ok(loginRes.ok, `Login as password test user failed: HTTP ${loginRes.status}`);
  const data = (await loginRes.json()) as Record<string, unknown>;
  const token = (data.accessToken ?? data.token) as string;
  assert.ok(token, "No token received");

  const profile: Record<string, unknown> = { url: this.serverUrl, token };
  if (data.refreshToken) profile.refreshToken = data.refreshToken;
  this.writeConfig({
    version: 2,
    currentProfile: "default",
    profiles: { default: profile },
  });
});

When(
  "I login with email {string} and password {string}",
  async function (this: GdbWorld, email: string, password: string) {
    // Brief delay to ensure the JWT iat is strictly after any tokenInvalidatedBefore
    // timestamp set by a preceding password change (sub-second precision issue).
    await sleep(1100);

    const loginUrl = new URL("/auth/login", this.serverUrl).toString();
    const res = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.ok(res.ok, `Login failed: HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    const token = (data.accessToken ?? data.token) as string;
    assert.ok(token, "No token received from login API");

    const profile: Record<string, unknown> = { url: this.serverUrl, token };
    if (data.refreshToken) profile.refreshToken = data.refreshToken;
    this.writeConfig({
      version: 2,
      currentProfile: "default",
      profiles: { default: profile },
    });
  },
);
