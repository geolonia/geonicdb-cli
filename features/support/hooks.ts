import { BeforeAll, AfterAll, Before, After } from "@cucumber/cucumber";
import { mockServer } from "./mock-server.js";
import type { GdbWorld } from "./world.js";

BeforeAll(async function () {
  await mockServer.start();
});

Before(function (this: GdbWorld) {
  mockServer.clearRoutes();
  this.createConfigDir();
});

After(function (this: GdbWorld) {
  this.cleanConfigDir();
});

AfterAll(async function () {
  await mockServer.stop();
});
