import { BeforeAll, AfterAll, Before, After } from "@cucumber/cucumber";
import { createServer, type GeonicDBServer } from "geonicdb";
import { MongoClient } from "mongodb";
import { GdbWorld, TEST_EMAIL, TEST_PASSWORD, JWT_SECRET } from "./world.js";

let server: GeonicDBServer;
let mongoClient: MongoClient;

BeforeAll(async function () {
  process.env.AUTH_ENABLED = "true";
  process.env.JWT_SECRET = JWT_SECRET;
  process.env.SUPER_ADMIN_EMAIL = TEST_EMAIL;
  process.env.SUPER_ADMIN_PASSWORD = TEST_PASSWORD;

  server = await createServer({ silent: true });
  mongoClient = new MongoClient(server.mongoUri);
  await mongoClient.connect();
});

Before(async function (this: GdbWorld) {
  // DB cleanup for scenario isolation — drop collections to bypass server caching
  const db = mongoClient.db();
  const collections = await db.listCollections().toArray();
  for (const c of collections) {
    if (!c.name.startsWith("system.")) {
      await db.collection(c.name).drop().catch((err: Error & { code?: number }) => {
        if (err.code !== 26 && !err.message.includes("ns not found")) {
          console.warn(`Warning: failed to drop collection ${c.name}: ${err.message}`);
        }
      });
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
});
