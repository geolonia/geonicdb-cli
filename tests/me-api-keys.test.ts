import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn().mockReturnValue({ profile: "default" }),
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
  loadConfig: vi.fn().mockImplementation(() => ({})),
  saveConfig: vi.fn(),
  validateUrl: vi.fn().mockImplementation((url: string) => url),
  getCurrentProfile: vi.fn().mockReturnValue("default"),
}));

vi.mock("../src/token.js", () => ({
  getTokenStatus: vi.fn().mockReturnValue({}),
  formatDuration: vi.fn(),
}));

vi.mock("../src/oauth.js", () => ({
  clientCredentialsGrant: vi.fn(),
}));

import { createClient, getFormat, outputResponse, resolveOptions } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printError, printWarning } from "../src/output.js";
import { saveConfig } from "../src/config.js";
import { registerAuthCommands } from "../src/commands/auth.js";

describe("me api-keys commands", () => {
  let client: MockClient;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
    consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      registerAuthCommands(prog);
    });
  }

  describe("api-keys list", () => {
    it("calls rawRequest GET /me/api-keys", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ keyId: "k1" }]));
      const program = makeProgram();
      await runCommand(program, ["me", "api-keys", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me/api-keys");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("api-keys create", () => {
    it("posts body from JSON input and prints success", async () => {
      const body = { name: "my-key", allowedScopes: ["read:entities"] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(
        mockResponse({ keyId: "k2", key: "gdb_abc123" }, 201),
      );
      const program = makeProgram();
      await runCommand(program, [
        "me", "api-keys", "create",
        '{"name":"my-key","allowedScopes":["read:entities"]}',
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/api-keys", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printWarning).toHaveBeenCalledWith(
        "Save the API key now — it will not be shown again. Use --save to store it automatically.",
      );
      expect(consoleSpy).toHaveBeenCalledWith("API key created.");
    });

    it("builds body from flags", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(
          mockResponse({ keyId: "k3", key: "gdb_xyz" }, 201),
        );
        const program = makeProgram();
        await runCommand(program, [
          "me", "api-keys", "create",
          "--name", "my-key",
          "--scopes", "read:entities,write:entities",
        ]);
        expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/api-keys", {
          body: {
            name: "my-key",
            allowedScopes: ["read:entities", "write:entities"],
          },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("saves API key to config with --save", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        vi.mocked(resolveOptions).mockReturnValue({
          url: "https://example.com/",
          profile: "default",
        });
        client.rawRequest.mockResolvedValue(
          mockResponse({ keyId: "k4", key: "gdb_saved123" }, 201),
        );

        const program = makeProgram();
        await runCommand(program, [
          "me", "api-keys", "create",
          "--name", "saved-key",
          "--save",
        ]);

        expect(saveConfig).toHaveBeenCalledWith(
          expect.objectContaining({ apiKey: "gdb_saved123" }),
          "default",
        );
        expect(consoleSpy).toHaveBeenCalledWith(
          "API key saved to config. X-Api-Key header will be sent automatically.",
        );
        expect(printWarning).not.toHaveBeenCalled();
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("rejects empty allowedOrigins from JSON input", async () => {
      const body = { name: "bad-key", allowedOrigins: [] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      const program = makeProgram();
      await expect(
        runCommand(program, ["me", "api-keys", "create", '{"name":"bad"}'])
      ).rejects.toThrow("process.exit");

      expect(printError).toHaveBeenCalledWith(
        "allowedOrigins must contain at least 1 item. Use '*' to allow all origins.",
      );
      exitSpy.mockRestore();
    });

    it("rejects empty --origins flag", async () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });

      const program = makeProgram();
      await expect(
        runCommand(program, ["me", "api-keys", "create", "--name", "bad", "--origins", ""])
      ).rejects.toThrow("process.exit");

      expect(printError).toHaveBeenCalledWith(
        "allowedOrigins must contain at least 1 item. Use '*' to allow all origins.",
      );
      exitSpy.mockRestore();
    });

    it("handles --save when response is missing key field", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        vi.mocked(resolveOptions).mockReturnValue({
          url: "https://example.com/",
          profile: "default",
        });
        client.rawRequest.mockResolvedValue(
          mockResponse({ keyId: "k5" }, 201),
        );

        const program = makeProgram();
        await runCommand(program, [
          "me", "api-keys", "create",
          "--name", "no-key-response",
          "--save",
        ]);

        expect(printError).toHaveBeenCalledWith("Response missing key. Cannot save API key.");
        expect(saveConfig).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith("API key created.");
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("reads from stdin when no json arg and no flags", async () => {
      const body = { name: "stdin-key" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(
        mockResponse({ keyId: "k6", key: "gdb_stdin" }, 201),
      );
      const program = makeProgram();
      await runCommand(program, ["me", "api-keys", "create"]);
      expect(parseJsonInput).toHaveBeenCalledWith();
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/api-keys", { body });
    });

    it("builds body with origins, entity-types and rate-limit flags", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(
          mockResponse({ keyId: "k7", key: "gdb_full" }, 201),
        );
        const program = makeProgram();
        await runCommand(program, [
          "me", "api-keys", "create",
          "--name", "full-key",
          "--origins", "https://a.com,https://b.com",
          "--entity-types", "Sensor,Device",
          "--rate-limit", "120",
        ]);
        expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/api-keys", {
          body: {
            name: "full-key",
            allowedOrigins: ["https://a.com", "https://b.com"],
            allowedEntityTypes: ["Sensor", "Device"],
            rateLimit: { perMinute: 120 },
          },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("accepts valid allowedOrigins in JSON body", async () => {
      const body = { name: "ok", allowedOrigins: ["*"] };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(
        mockResponse({ keyId: "k8", key: "gdb_ok" }, 201),
      );
      const program = makeProgram();
      await runCommand(program, ["me", "api-keys", "create", '{"name":"ok"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/api-keys", { body });
    });
  });

  describe("api-keys delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "api-keys", "delete", "k1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/api-keys/k1");
      expect(consoleSpy).toHaveBeenCalledWith("API key deleted.");
    });

    it("encodes special characters in keyId", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "api-keys", "delete", "urn:k:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/api-keys/urn%3Ak%3A1");
    });
  });
});
