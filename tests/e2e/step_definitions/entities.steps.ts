import { When } from "@cucumber/cucumber";
import type { GdbWorld } from "../support/world.js";

function normalizeEntityId(id: string): string {
  if (/^urn:|^https?:\/\//i.test(id)) return id;
  return `urn:ngsi-ld:${id}`;
}

When(
  "I create entity {string} of type {string}",
  async function (this: GdbWorld, id: string, type: string) {
    const entity = JSON.stringify({ id: normalizeEntityId(id), type });
    await this.run(["entities", "create", entity]);
  },
);

When(
  "I update entity {string} with {string}",
  async function (this: GdbWorld, id: string, json: string) {
    await this.run(["entities", "update", normalizeEntityId(id), json]);
  },
);
