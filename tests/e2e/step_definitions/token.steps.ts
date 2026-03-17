import { Given } from "@cucumber/cucumber";
import { GdbWorld, performLogin } from "../support/world.js";

Given("I am logged in with an invalidated token", async function (this: GdbWorld) {
  await performLogin(this);

  // Invalidate the token but keep the refreshToken intact
  const full = this.readFullConfig();
  const profiles = full.profiles as Record<string, Record<string, unknown>>;
  const active = (full.currentProfile as string) ?? "default";
  profiles[active].token = "invalidated";
  this.writeConfig(full);
});
