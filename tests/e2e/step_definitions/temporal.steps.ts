import { When } from "@cucumber/cucumber";
import type { GdbWorld } from "../support/world.js";

When(
  "I create a temporal entity {string}",
  async function (this: GdbWorld, id: string) {
    const entity = JSON.stringify({
      id,
      type: "Room",
      temperature: [
        {
          type: "Property",
          value: 25,
          observedAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    await this.run(["temporal", "entities", "create", entity]);
  },
);
