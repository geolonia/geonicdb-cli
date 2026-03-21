import { BeforeAll, AfterAll, Before, After } from "@cucumber/cucumber";
import { createServer, type GeonicDBServer } from "geonicdb";
import { MongoClient, type Document } from "mongodb";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD, JWT_SECRET } from "./world.js";

let server: GeonicDBServer;
let mongoClient: MongoClient;

// Collections whose contents are restored (not dropped) between scenarios
// so the server's default XACML policies and super-admin user survive cleanup.
const preservedCollectionNames = ["users", "policies", "tenant"] as const;
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

  // Snapshot initial state of preserved collections
  const db = mongoClient.db();
  for (const name of preservedCollectionNames) {
    baselineDocs.set(name, await db.collection(name).find({}).toArray());
  }
});

Before(async function (this: GdbWorld) {
  // DB cleanup for scenario isolation
  const preserveSet = new Set<string>(preservedCollectionNames);
  const db = mongoClient.db();
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
    await db.collection(name).deleteMany({});
    const docs = baselineDocs.get(name) ?? [];
    if (docs.length > 0) {
      await db.collection(name).insertMany(docs);
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
