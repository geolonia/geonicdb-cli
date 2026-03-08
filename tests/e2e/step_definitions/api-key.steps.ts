import { Given, When } from "@cucumber/cucumber";
import { GdbWorld, performLogin } from "../support/world.js";

Given("I have a config with url", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl });
});

Given("I have a config with url and apiKey", function (this: GdbWorld) {
  this.writeConfig({ url: this.serverUrl, apiKey: "gdb_from_config_key" });
});

When("I run entities list with api-key env var in dry-run", async function (this: GdbWorld) {
  await this.run(["entities", "list", "--dry-run"], { GDB_API_KEY: "gdb_envvar_key" });
});

Given("I am logged in with token and invalid apiKey in config", async function (this: GdbWorld) {
  const config = await performLogin(this);
  config.apiKey = "invalid-not-a-real-key";
  this.writeConfig(config);
});
