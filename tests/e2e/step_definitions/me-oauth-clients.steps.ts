import { Given } from "@cucumber/cucumber";
import type { GdbWorld } from "../support/world.js";

Given("I invalidate the current token keeping client credentials", function (this: GdbWorld) {
  const full = this.readFullConfig();
  const profiles =
    (full.profiles as Record<string, Record<string, unknown>> | undefined) ?? {};
  full.profiles = profiles;
  const active = (full.currentProfile as string) ?? "default";
  const profile = profiles[active] ?? {};
  profiles[active] = profile;

  // Invalidate token and refreshToken, but keep clientId/clientSecret
  profile.token = "invalidated";
  delete profile.refreshToken;

  this.writeConfig(full);
});
