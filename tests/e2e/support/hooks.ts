import { BeforeAll, AfterAll, Before, After } from "@cucumber/cucumber";
import { createServer, type GeonicDBServer } from "geonicdb";
import { MongoClient, type Db, type Document } from "mongodb";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD, JWT_SECRET, TENANT_ADMIN_EMAIL, TENANT_ADMIN_PASSWORD, PW_TEST_EMAIL, PW_TEST_PASSWORD } from "./world.js";

let server: GeonicDBServer;
let mongoClient: MongoClient;
let db: Db;

const DB_NAME = "local-context-broker";

// Collections whose contents are restored (not dropped) between scenarios
// so the server's default XACML policies, tenants, and users survive cleanup.
const preservedCollectionNames = [
  "users", "policies", "policySets", "tenants",
  "tenantMemberships", "oauthClients", "apiKeys", "loginAttempts",
] as const;
const baselineDocs = new Map<string, Document[]>();

// Suppress all server console output during E2E tests
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
};
const noop = () => {};

function suppressConsole() {
  console.log = noop;
  console.error = noop;
  console.warn = noop;
  console.info = noop;
}

function restoreConsole() {
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
}

BeforeAll(async function () {
  process.env.AUTH_ENABLED = "true";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SUPER_ADMIN_EMAIL = TEST_EMAIL;
  process.env.SUPER_ADMIN_PASSWORD = TEST_PASSWORD;

  suppressConsole();
  server = await createServer({ silent: true });
  mongoClient = new MongoClient(server.mongoUri);
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);

  // Login as super admin and create test tenant + tenant_admin user
  const loginRes = await fetch(new URL("/auth/login", server.url).toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error(`Super admin login failed: HTTP ${loginRes.status}`);
  const loginData = (await loginRes.json()) as Record<string, unknown>;
  const superAdminToken = (loginData.accessToken ?? loginData.token) as string;

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${superAdminToken}`,
  };

  // Create test tenant
  const tenantRes = await fetch(new URL("/admin/tenants", server.url).toString(), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({ name: "e2e_test", description: "E2E test tenant" }),
  });
  if (!tenantRes.ok) throw new Error(`Tenant creation failed: HTTP ${tenantRes.status}`);
  const tenantData = (await tenantRes.json()) as Record<string, unknown>;
  const tenantId = (tenantData.tenantId ?? tenantData.id) as string;

  // Create tenant_admin user
  const userRes = await fetch(new URL("/admin/users", server.url).toString(), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: TENANT_ADMIN_EMAIL,
      password: TENANT_ADMIN_PASSWORD,
      role: "tenant_admin",
      tenantId,
    }),
  });
  if (!userRes.ok) throw new Error(`Tenant admin user creation failed: HTTP ${userRes.status}`);

  // Create dedicated user for password change tests
  const pwUserRes = await fetch(new URL("/admin/users", server.url).toString(), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      email: PW_TEST_EMAIL,
      password: PW_TEST_PASSWORD,
      role: "user",
      tenantId,
    }),
  });
  if (!pwUserRes.ok) throw new Error(`Password test user creation failed: HTTP ${pwUserRes.status}`);

  // Snapshot initial state of preserved collections AFTER tenant + user setup
  for (const name of preservedCollectionNames) {
    baselineDocs.set(name, await db.collection(name).find({}).toArray());
  }
});

Before(async function (this: GdbWorld) {
  // DB cleanup for scenario isolation
  const preserveSet = new Set<string>(preservedCollectionNames);
  const collections = await db.listCollections().toArray();

  for (const c of collections) {
    if (c.name.startsWith("system.")) continue;
    if (preserveSet.has(c.name)) continue;
    await db.collection(c.name).drop().catch((err: Error & { code?: number }) => {
      if (err.code !== 26 && !err.message.includes("ns not found")) {
        console.warn(`Warning: failed to drop collection ${c.name}: ${err.message}`);
      }
    });
  }

  // Restore preserved collections to initial state
  for (const name of preservedCollectionNames) {
    const col = db.collection(name);
    await col.deleteMany({});
    const docs = baselineDocs.get(name) ?? [];
    if (docs.length > 0) {
      await col.insertMany(docs);
    }
  }

  this.serverUrl = server.url;
  this.createConfigDir();
});

After(function (this: GdbWorld) {
  this.cleanConfigDir();
});

AfterAll(async function () {
  await mongoClient.close();
  await server.close();
  restoreConsole();
});
