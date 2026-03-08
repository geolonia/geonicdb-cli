import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn(),
}));

vi.mock("../src/input.js", () => ({
  parseJsonInput: vi.fn(),
}));

vi.mock("../src/output.js", () => ({
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
}));

vi.mock("../src/config.js", () => ({
  loadConfig: vi.fn(() => ({})),
  saveConfig: vi.fn(),
  getCurrentProfile: vi.fn(() => "default"),
  validateUrl: vi.fn((url: string) => url.replace(/\/+$/, "") + "/"),
}));

vi.mock("../src/prompt.js", () => ({
  isInteractive: vi.fn(),
  promptEmail: vi.fn(),
  promptPassword: vi.fn(),
}));

vi.mock("../src/token.js", () => ({
  getTokenStatus: vi.fn(),
  formatDuration: vi.fn(),
}));

vi.mock("../src/oauth.js", () => ({
  clientCredentialsGrant: vi.fn(),
}));

import { createClient, getFormat, outputResponse, resolveOptions } from "../src/helpers.js";
import { printSuccess, printError, printInfo, printWarning } from "../src/output.js";
import { loadConfig, saveConfig, getCurrentProfile } from "../src/config.js";
import { isInteractive, promptEmail, promptPassword } from "../src/prompt.js";
import { getTokenStatus, formatDuration } from "../src/token.js";
import { clientCredentialsGrant } from "../src/oauth.js";
import { registerAuthCommands } from "../src/commands/auth.js";

describe("auth commands", () => {
  let client: MockClient;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
    vi.mocked(resolveOptions).mockReturnValue({
      url: "http://localhost:3000",
      profile: "default",
      token: "test-token",
      format: "json",
    } as never);
    vi.mocked(loadConfig).mockReturnValue({});
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    // Clear env vars
    delete process.env.GDB_EMAIL;
    delete process.env.GDB_PASSWORD;
    delete process.env.GDB_OAUTH_CLIENT_ID;
    delete process.env.GDB_OAUTH_CLIENT_SECRET;
  });

  afterEach(() => {
    exitSpy.mockRestore();
    delete process.env.GDB_EMAIL;
    delete process.env.GDB_PASSWORD;
    delete process.env.GDB_OAUTH_CLIENT_ID;
    delete process.env.GDB_OAUTH_CLIENT_SECRET;
  });

  function makeProgram() {
    return createTestProgram((prog) => registerAuthCommands(prog));
  }

  describe("auth login --client-credentials", () => {
    it("performs OAuth client credentials flow with --client-id and --client-secret", async () => {
      vi.mocked(clientCredentialsGrant).mockResolvedValue({
        access_token: "oauth-token-123",
        token_type: "Bearer",
        expires_in: 3600,
      });
      const program = makeProgram();
      await runCommand(program, [
        "auth", "login",
        "--client-credentials",
        "--client-id", "myid",
        "--client-secret", "mysecret",
      ]);
      expect(clientCredentialsGrant).toHaveBeenCalledWith({
        baseUrl: "http://localhost:3000",
        clientId: "myid",
        clientSecret: "mysecret",
        scope: undefined,
      });
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "oauth-token-123" }),
        "default",
      );
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Login successful"));
    });

    it("passes scope when provided", async () => {
      vi.mocked(clientCredentialsGrant).mockResolvedValue({
        access_token: "oauth-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
      const program = makeProgram();
      await runCommand(program, [
        "auth", "login",
        "--client-credentials",
        "--client-id", "myid",
        "--client-secret", "mysecret",
        "--scope", "read write",
      ]);
      expect(clientCredentialsGrant).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "read write" }),
      );
    });

    it("prints error and exits when clientId/secret are missing", async () => {
      const program = makeProgram();
      await expect(
        runCommand(program, ["auth", "login", "--client-credentials"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("Client ID and secret"));
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("falls back to env vars for clientId/secret", async () => {
      process.env.GDB_OAUTH_CLIENT_ID = "env-id";
      process.env.GDB_OAUTH_CLIENT_SECRET = "env-secret";
      vi.mocked(clientCredentialsGrant).mockResolvedValue({
        access_token: "env-token",
        token_type: "Bearer",
        expires_in: 3600,
      });
      const program = makeProgram();
      await runCommand(program, ["auth", "login", "--client-credentials"]);
      expect(clientCredentialsGrant).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: "env-id", clientSecret: "env-secret" }),
      );
    });

    it("prints error and exits when URL is not configured", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: undefined,
        profile: "default",
      } as never);
      const program = makeProgram();
      await expect(
        runCommand(program, [
          "auth", "login",
          "--client-credentials",
          "--client-id", "myid",
          "--client-secret", "mysecret",
        ]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("No URL configured"));
    });
  });

  describe("auth login (email/password)", () => {
    it("uses GDB_EMAIL/GDB_PASSWORD env vars", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "tok-abc", refreshToken: "ref-xyz" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/login", {
        body: { email: "user@example.com", password: "pass123" },
      });
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "tok-abc", refreshToken: "ref-xyz" }),
        "default",
      );
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Login successful"));
    });

    it("uses interactive prompts when isInteractive and no env vars", async () => {
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptEmail).mockResolvedValue("prompt@example.com");
      vi.mocked(promptPassword).mockResolvedValue("promptpass");
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "interactive-token" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      expect(promptEmail).toHaveBeenCalled();
      expect(promptPassword).toHaveBeenCalled();
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/login", {
        body: { email: "prompt@example.com", password: "promptpass" },
      });
    });

    it("prompts only for missing credentials when one env var is set", async () => {
      process.env.GDB_EMAIL = "env@example.com";
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptPassword).mockResolvedValue("interactive-pass");
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "partial-token" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      expect(promptEmail).not.toHaveBeenCalled();
      expect(promptPassword).toHaveBeenCalled();
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/login", {
        body: { email: "env@example.com", password: "interactive-pass" },
      });
    });

    it("prints error and exits when non-interactive and no env vars", async () => {
      vi.mocked(isInteractive).mockReturnValue(false);
      const program = makeProgram();
      await expect(
        runCommand(program, ["auth", "login"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("GDB_EMAIL"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("includes tenantId in the request body when --tenant-id is provided", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "tenant-token" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login", "--tenant-id", "my-tenant"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/login", {
        body: { email: "user@example.com", password: "pass123", tenantId: "my-tenant" },
      });
    });

    it("prints error and exits when no token in response", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(mockResponse({ message: "ok" }));
      const program = makeProgram();
      await expect(
        runCommand(program, ["auth", "login"]),
      ).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("No token received from server.");
    });

    it("saves refreshToken when present in response", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "tok", refreshToken: "ref" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "tok", refreshToken: "ref" }),
        "default",
      );
    });

    it("deletes refreshToken when not present in response", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      const configObj = { refreshToken: "old-refresh" } as Record<string, unknown>;
      vi.mocked(loadConfig).mockReturnValue(configObj as never);
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "tok" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      // refreshToken should have been deleted
      expect(configObj.refreshToken).toBeUndefined();
      expect(saveConfig).toHaveBeenCalled();
    });

    it("reads token from data.token when accessToken is not present", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(
        mockResponse({ token: "legacy-token" }),
      );
      const program = makeProgram();
      await runCommand(program, ["auth", "login"]);
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "legacy-token" }),
        "default",
      );
    });
  });

  describe("auth logout", () => {
    it("notifies server and clears token from config", async () => {
      vi.mocked(loadConfig).mockReturnValue({ token: "old-token" } as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
        token: "old-token",
      } as never);
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["auth", "logout"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/logout");
      expect(saveConfig).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });

    it("ignores server error and still clears token", async () => {
      vi.mocked(loadConfig).mockReturnValue({ token: "old-token" } as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
        token: "old-token",
      } as never);
      client.rawRequest.mockRejectedValue(new Error("Network error"));
      const program = makeProgram();
      await runCommand(program, ["auth", "logout"]);
      expect(saveConfig).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });

    it("skips server call when no token or url", async () => {
      vi.mocked(loadConfig).mockReturnValue({} as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: undefined,
        profile: "default",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["auth", "logout"]);
      expect(client.rawRequest).not.toHaveBeenCalled();
      expect(saveConfig).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });
  });

  describe("me command", () => {
    it("prints info when not logged in (no token or apiKey)", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("fetches /me and outputs response when logged in", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({ token: "valid-token" } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2025-12-31T00:00:00Z"),
        isExpired: false,
        isExpiringSoon: false,
        remainingMs: 86400000,
      } as never);
      vi.mocked(formatDuration).mockReturnValue("1 day");
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me");
      expect(outputResponse).toHaveBeenCalled();
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Token expires:"));
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Profile:"));
    });

    it("suppresses human-readable logs for json format", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(getFormat).mockReturnValue("json");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(outputResponse).toHaveBeenCalled();
      // Should not print token status or profile info when format is json
      expect(getTokenStatus).not.toHaveBeenCalled();
    });

    it("shows expired token status", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({ token: "expired-token" } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2020-01-01T00:00:00Z"),
        isExpired: true,
        isExpiringSoon: false,
        remainingMs: 0,
      } as never);
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("expired"));
    });

    it("shows expiring-soon token status", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({ token: "expiring-token" } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: new Date("2025-12-31T00:00:00Z"),
        isExpired: false,
        isExpiringSoon: true,
        remainingMs: 300000,
      } as never);
      vi.mocked(formatDuration).mockReturnValue("5 minutes");
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(printWarning).toHaveBeenCalledWith(expect.stringContaining("Token expires:"));
    });

    it("shows profile from resolvedOptions profile when available", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({} as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "staging",
        token: "tok",
      } as never);
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(printInfo).toHaveBeenCalledWith("Profile: staging");
    });

    it("falls back to getCurrentProfile when profile not in options", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({} as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: undefined,
        token: "tok",
      } as never);
      vi.mocked(getCurrentProfile).mockReturnValue("custom-profile");
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(printInfo).toHaveBeenCalledWith("Profile: custom-profile");
    });

    it("handles token without expiresAt", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      vi.mocked(loadConfig).mockReturnValue({ token: "no-exp-token" } as never);
      vi.mocked(getTokenStatus).mockReturnValue({
        expiresAt: undefined,
        isExpired: false,
        isExpiringSoon: false,
        remainingMs: undefined,
      } as never);
      vi.mocked(getFormat).mockReturnValue("table");
      const program = makeProgram();
      await runCommand(program, ["me"]);
      // Should not print any expiry messages
      expect(printWarning).not.toHaveBeenCalled();
    });

    it("works with apiKey instead of token", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
        apiKey: "my-api-key",
      } as never);
      vi.mocked(loadConfig).mockReturnValue({} as never);
      vi.mocked(getFormat).mockReturnValue("table");
      client.rawRequest.mockResolvedValue(mockResponse({ email: "user@example.com" }));
      const program = makeProgram();
      await runCommand(program, ["me"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me");
    });
  });

  describe("auth nonce", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ nonce: "abc123", difficulty: 4, algorithm: "sha256" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
        apiKey: "gdb_testkey",
      } as never);
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it("requests nonce with API key and outputs response", async () => {
      const program = makeProgram();
      await runCommand(program, ["auth", "nonce"]);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/auth/nonce"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "X-Api-Key": "gdb_testkey" }),
        }),
      );
      expect(outputResponse).toHaveBeenCalled();
    });

    it("uses apiKey from resolvedOptions when --api-key flag is not provided", async () => {
      const program = makeProgram();
      await runCommand(program, ["auth", "nonce"]);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Api-Key": "gdb_testkey" }),
        }),
      );
    });

    it("errors when no API key is available", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
      } as never);
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "nonce"])).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("API key is required"));
    });

    it("errors when no URL is configured", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: undefined,
        profile: "default",
        apiKey: "gdb_key",
      } as never);
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "nonce"])).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("No URL configured"));
    });

    it("throws on non-ok response with body", async () => {
      fetchSpy.mockResolvedValue(
        new Response("Bad Request", { status: 400 }),
      );
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "nonce"])).rejects.toThrow("Nonce request failed: Bad Request");
    });

    it("throws with HTTP status fallback when response body is empty", async () => {
      fetchSpy.mockResolvedValue(
        new Response("", { status: 403 }),
      );
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "nonce"])).rejects.toThrow("Nonce request failed: HTTP 403");
    });
  });

  describe("auth token-exchange", () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
        apiKey: "gdb_testkey",
      } as never);
    });

    afterEach(() => {
      if (fetchSpy) fetchSpy.mockRestore();
    });

    it("performs full nonce → PoW → token exchange flow", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/nonce")) {
          return new Response(
            JSON.stringify({ nonce: "test-nonce", difficulty: 1, algorithm: "sha256" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (urlStr.includes("/oauth/token")) {
          return new Response(
            JSON.stringify({ access_token: "jwt-from-exchange", token_type: "Bearer", expires_in: 3600 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Not Found", { status: 404 });
      });

      const program = makeProgram();
      await runCommand(program, ["auth", "token-exchange", "--api-key", "gdb_mykey"]);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Solving PoW"));
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Token exchange successful.");
    });

    it("saves token to config with --save", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/nonce")) {
          return new Response(
            JSON.stringify({ nonce: "test-nonce", difficulty: 1, algorithm: "sha256" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ access_token: "saved-jwt", token_type: "Bearer" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      });

      const program = makeProgram();
      await runCommand(program, ["auth", "token-exchange", "--save"]);
      expect(saveConfig).toHaveBeenCalledWith(
        expect.objectContaining({ token: "saved-jwt" }),
        "default",
      );
      expect(printSuccess).toHaveBeenCalledWith("Token exchange successful. Token saved to config.");
    });

    it("errors when no API key is available", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
      } as never);
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("API key is required"));
    });

    it("errors when no URL is configured", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: undefined,
        profile: "default",
        apiKey: "gdb_key",
      } as never);
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("No URL configured"));
    });

    it("throws when nonce request fails with body", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Server Error", { status: 500 }),
      );
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("Nonce request failed: Server Error");
    });

    it("throws when nonce request fails with empty body", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", { status: 500 }),
      );
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("Nonce request failed: HTTP 500");
    });

    it("throws when token exchange request fails with body", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/nonce")) {
          return new Response(
            JSON.stringify({ nonce: "test-nonce", difficulty: 1, algorithm: "sha256" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("Invalid PoW", { status: 400 });
      });
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("Token exchange failed: Invalid PoW");
    });

    it("throws when token exchange request fails with empty body", async () => {
      fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes("/auth/nonce")) {
          return new Response(
            JSON.stringify({ nonce: "test-nonce", difficulty: 1, algorithm: "sha256" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response("", { status: 401 });
      });
      const program = makeProgram();
      await expect(runCommand(program, ["auth", "token-exchange"])).rejects.toThrow("Token exchange failed: HTTP 401");
    });
  });

  describe("hidden aliases", () => {
    it("login alias at top level works", async () => {
      process.env.GDB_EMAIL = "user@example.com";
      process.env.GDB_PASSWORD = "pass123";
      client.rawRequest.mockResolvedValue(
        mockResponse({ accessToken: "alias-token" }),
      );
      const program = makeProgram();
      await runCommand(program, ["login"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/auth/login", {
        body: { email: "user@example.com", password: "pass123" },
      });
    });

    it("logout alias at top level works", async () => {
      vi.mocked(loadConfig).mockReturnValue({} as never);
      vi.mocked(resolveOptions).mockReturnValue({
        url: undefined,
        profile: "default",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["logout"]);
      expect(printSuccess).toHaveBeenCalledWith(expect.stringContaining("Logged out"));
    });

    it("whoami alias at top level works", async () => {
      vi.mocked(resolveOptions).mockReturnValue({
        url: "http://localhost:3000",
        profile: "default",
      } as never);
      const program = makeProgram();
      await runCommand(program, ["whoami"]);
      expect(printInfo).toHaveBeenCalledWith(expect.stringContaining("Not logged in"));
    });
  });
});
