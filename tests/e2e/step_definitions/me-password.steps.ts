import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { GdbWorld, performSuperAdminLogin } from "../support/world.js";

const PW_TEST_EMAIL = "pw-test@test.com";
const PW_TEST_PASSWORD = "PwTestUser12345!";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a dedicated user for password change tests and log in as that user.
 * Uses a separate user so that password changes and token invalidations
 * don't pollute the shared tenant-admin used by other test features.
 */
Given("I am logged in as password test user", async function (this: GdbWorld) {
  // Login as super admin to create the test user
  await performSuperAdminLogin(this);
  const superConfig = this.readProfileConfig();
  const superToken = superConfig.token as string;

  // Check if user already exists (ignore errors)
  const listRes = await fetch(new URL("/admin/users", this.serverUrl).toString(), {
    headers: { Authorization: `Bearer ${superToken}` },
  });
  const users = (await listRes.json()) as Record<string, unknown>[];
  const existing = users.find((u) => u.email === PW_TEST_EMAIL);

  if (!existing) {
    // Get tenant ID from super admin's available info
    const tenantsRes = await fetch(new URL("/admin/tenants", this.serverUrl).toString(), {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    const tenants = (await tenantsRes.json()) as Record<string, unknown>[];
    const tenant = tenants.find((t) => t.name === "e2e_test");
    assert.ok(tenant, "e2e_test tenant not found");

    const createRes = await fetch(new URL("/admin/users", this.serverUrl).toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${superToken}`,
      },
      body: JSON.stringify({
        email: PW_TEST_EMAIL,
        password: PW_TEST_PASSWORD,
        role: "user",
        tenantId: tenant.tenantId ?? tenant.id,
      }),
    });
    assert.ok(createRes.ok, `Failed to create password test user: HTTP ${createRes.status}`);
  }

  // Login as the password test user
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
