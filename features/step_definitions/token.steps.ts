import { Given } from "@cucumber/cucumber";
import { mockServer } from "../support/mock-server.js";
import type { GdbWorld } from "../support/world.js";

let refreshCallCount = 0;

Given("a mock server that returns 401 then succeeds after token refresh", function (this: GdbWorld) {
  refreshCallCount = 0;

  this.writeConfig({
    url: this.serverUrl,
    token: "expired-token",
    refreshToken: "valid-refresh-token",
  });

  // The protected endpoint returns 401 on first call, 200 on second
  mockServer.addRoute("GET", "/v2/entities", () => {
    if (refreshCallCount === 0) {
      return { status: 401, body: { error: "Unauthorized", description: "Token expired" } };
    }
    return { status: 200, body: [{ id: "entity1", type: "Thing" }] };
  });

  // Token refresh endpoint
  mockServer.addRoute("POST", "/auth/tokens/refresh", (_req, body) => {
    const parsed = JSON.parse(body);
    if (parsed.refreshToken === "valid-refresh-token") {
      refreshCallCount++;
      return { status: 200, body: { token: "new-fresh-token", refreshToken: "new-refresh-token" } };
    }
    return { status: 401, body: { error: "Unauthorized", description: "Invalid refresh token" } };
  });
});

Given("a mock server that returns 401 and refresh also fails", function (this: GdbWorld) {
  this.writeConfig({
    url: this.serverUrl,
    token: "expired-token",
    refreshToken: "invalid-refresh-token",
  });

  mockServer.addRoute("GET", "/v2/entities", () => ({
    status: 401,
    body: { error: "Unauthorized", description: "Token expired" },
  }));

  mockServer.addRoute("POST", "/auth/tokens/refresh", () => ({
    status: 401,
    body: { error: "Unauthorized", description: "Invalid refresh token" },
  }));
});
