import { Given } from "@cucumber/cucumber";
import { GdbWorld, performLogin } from "../support/world.js";

Given("I am logged in with an invalidated token", async function (this: GdbWorld) {
  await performLogin(this);

  // Invalidate the token but keep the refreshToken intact
  const config = this.readConfig();
  config.token = "invalidated";
  this.writeConfig(config);
});
