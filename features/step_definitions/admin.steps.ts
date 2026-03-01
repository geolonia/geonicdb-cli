import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

/** Extract ID from a resource object, trying common field names */
function extractId(obj: Record<string, unknown>): string | undefined {
  return (obj.id ?? obj._id ?? obj.policyId ?? obj.tenantId ?? obj.userId ?? obj.clientId) as string | undefined;
}

// ── Tenants ──

When("I create an admin tenant {string}", async function (this: GdbWorld, name: string) {
  const payload = JSON.stringify({ name, description: `Tenant ${name}` });
  await this.run(["admin", "tenants", "create", payload]);
});

Given("I get the admin tenant ID", async function (this: GdbWorld) {
  await this.run(["admin", "tenants", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list tenants: ${this.lastResult.stderr}`);
  const tenants = JSON.parse(this.lastResult.stdout);
  const list = Array.isArray(tenants) ? tenants : [];
  assert.ok(list.length > 0, "No tenants found");
  const id = extractId(list[list.length - 1]);
  assert.ok(id, `Could not extract tenant ID from: ${JSON.stringify(list[list.length - 1])}`);
  (this as Record<string, unknown>).adminResourceId = id;
});

When("I run admin tenants get with the saved ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "tenants", "get", id]);
});

When("I update the admin tenant with {string}", async function (this: GdbWorld, json: string) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "tenants", "update", id, json]);
});

When("I delete the admin tenant", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "tenants", "delete", id]);
});

When("I activate the admin tenant", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "tenants", "activate", id]);
});

When("I deactivate the admin tenant", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "tenants", "deactivate", id]);
});

// ── Users ──

When("I create an admin user {string}", async function (this: GdbWorld, email: string) {
  const payload = JSON.stringify({ email, password: "TestPassword123!", role: "super_admin" });
  await this.run(["admin", "users", "create", payload]);
});

Given("I get the admin user ID", async function (this: GdbWorld) {
  await this.run(["admin", "users", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list users: ${this.lastResult.stderr}`);
  const users = JSON.parse(this.lastResult.stdout);
  const list = Array.isArray(users) ? users : [];
  // Get the last non-admin user (the one we just created)
  const nonAdmin = list.filter((u: Record<string, unknown>) => u.email !== "admin@test.com");
  assert.ok(nonAdmin.length > 0, `No non-admin users found. Users: ${JSON.stringify(list.map((u: Record<string, unknown>) => u.email))}`);
  const id = extractId(nonAdmin[nonAdmin.length - 1]);
  assert.ok(id, `Could not extract user ID from: ${JSON.stringify(nonAdmin[nonAdmin.length - 1])}`);
  (this as Record<string, unknown>).adminResourceId = id;
});

When("I run admin users get with the saved ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "users", "get", id]);
});

When("I delete the admin user", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "users", "delete", id]);
});

When("I activate the admin user", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "users", "activate", id]);
});

When("I deactivate the admin user", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "users", "deactivate", id]);
});

When("I unlock the admin user", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "users", "unlock", id]);
});

// ── Policies ──

When("I create an admin policy {string}", async function (this: GdbWorld, name: string) {
  const payload = JSON.stringify({
    description: `Policy ${name}`,
    rules: [{ ruleId: name, effect: "Permit" }],
  });
  await this.run(["admin", "policies", "create", payload]);
});

Given("I get the admin policy ID", async function (this: GdbWorld) {
  await this.run(["admin", "policies", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list policies: ${this.lastResult.stderr}`);
  const policies = JSON.parse(this.lastResult.stdout);
  const list = Array.isArray(policies) ? policies : [];
  assert.ok(list.length > 0, "No policies found");
  const id = extractId(list[list.length - 1]);
  assert.ok(id, `Could not extract policy ID from: ${JSON.stringify(list[list.length - 1])}`);
  (this as Record<string, unknown>).adminResourceId = id;
});

When("I run admin policies get with the saved ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "policies", "get", id]);
});

When("I delete the admin policy", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "policies", "delete", id]);
});

When("I activate the admin policy", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "policies", "activate", id]);
});

When("I deactivate the admin policy", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "policies", "deactivate", id]);
});

// ── OAuth Clients ──

When("I create an admin oauth-client {string}", async function (this: GdbWorld, name: string) {
  const payload = JSON.stringify({ clientName: name, allowedScopes: [] });
  await this.run(["admin", "oauth-clients", "create", payload]);
});

Given("I get the admin oauth-client ID", async function (this: GdbWorld) {
  await this.run(["admin", "oauth-clients", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list oauth-clients: ${this.lastResult.stderr}`);
  const clients = JSON.parse(this.lastResult.stdout);
  const list = Array.isArray(clients) ? clients : [];
  assert.ok(list.length > 0, "No oauth-clients found");
  const id = extractId(list[list.length - 1]);
  assert.ok(id, `Could not extract oauth-client ID from: ${JSON.stringify(list[list.length - 1])}`);
  (this as Record<string, unknown>).adminResourceId = id;
});

When("I run admin oauth-clients get with the saved ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "oauth-clients", "get", id]);
});

When("I delete the admin oauth-client", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).adminResourceId as string;
  assert.ok(id, "No admin resource ID saved");
  await this.run(["admin", "oauth-clients", "delete", id]);
});
