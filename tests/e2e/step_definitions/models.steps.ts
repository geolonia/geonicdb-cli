import { Given, When } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

When("I create a model {string}", async function (this: GdbWorld, name: string) {
  const payload = JSON.stringify({
    type: name,
    domain: "test",
    description: `Model ${name}`,
    propertyDetails: {
      temperature: { ngsiType: "Property", valueType: "Number", example: 25 },
      humidity: { ngsiType: "Property", valueType: "Number", example: 60 },
    },
  });
  await this.run(["models", "create", payload]);
});

Given("I get the model ID from the list", async function (this: GdbWorld) {
  await this.run(["models", "list", "--format", "json"]);
  assert.equal(this.lastResult.exitCode, 0, `Failed to list models: ${this.lastResult.stderr}`);
  const data = JSON.parse(this.lastResult.stdout);
  const models = Array.isArray(data) ? data : [];
  assert.ok(models.length > 0, "No models found");
  (this as Record<string, unknown>).modelId = models[models.length - 1].id ?? models[models.length - 1]._id;
});

When("I get the model by ID", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).modelId as string;
  assert.ok(id, "No model ID saved");
  await this.run(["models", "get", id]);
});

When("I delete the model", async function (this: GdbWorld) {
  const id = (this as Record<string, unknown>).modelId as string;
  assert.ok(id, "No model ID saved");
  await this.run(["models", "delete", id]);
});
