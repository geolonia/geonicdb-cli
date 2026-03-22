import { describe, it, expect, vi, beforeEach } from "vitest";
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
  addNotes: vi.fn(),
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
import { printSuccess, printInfo, printWarning } from "../src/output.js";
import { saveConfig } from "../src/config.js";
import { clientCredentialsGrant } from "../src/oauth.js";
import { registerAuthCommands } from "../src/commands/auth.js";

describe("me oauth-clients commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      registerAuthCommands(prog);
    });
  }

  describe("oauth-clients list", () => {
    it("calls rawRequest GET /me/oauth-clients", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ clientId: "c1" }]));
      const program = makeProgram();
      await runCommand(program, ["me", "oauth-clients", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/me/oauth-clients");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("oauth-clients create", () => {
    it("posts body from JSON input and prints success", async () => {
      const body = { name: "my-bot", policyId: "p1" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(
        mockResponse({ clientId: "c2", clientSecret: "secret" }, 201),
      );
      const program = makeProgram();
      await runCommand(program, [
        "me",
        "oauth-clients",
        "create",
        '{"name":"my-bot","policyId":"p1"}',
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/oauth-clients", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printWarning).toHaveBeenCalledWith(
        "Save the clientSecret now — it will not be shown again.",
      );
      expect(printSuccess).toHaveBeenCalledWith("OAuth client created.");
    });

    it("builds body from --name and --policy flags", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(
          mockResponse({ clientId: "c3", clientSecret: "secret" }, 201),
        );
        const program = makeProgram();
        await runCommand(program, [
          "me",
          "oauth-clients",
          "create",
          "--name",
          "my-ci",
          "--policy",
          "my-policy",
        ]);
        expect(client.rawRequest).toHaveBeenCalledWith("POST", "/me/oauth-clients", {
          body: {
            name: "my-ci",
            policyId: "my-policy",
          },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("saves credentials to config with --save", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        vi.mocked(resolveOptions).mockReturnValue({
          url: "https://example.com/",
          profile: "default",
        });
        client.rawRequest.mockResolvedValue(
          mockResponse(
            {
              clientId: "c4",
              clientSecret: "s3cret",
            },
            201,
          ),
        );
        vi.mocked(clientCredentialsGrant).mockResolvedValue({
          access_token: "new-token",
          token_type: "Bearer",
        });

        const program = makeProgram();
        await runCommand(program, [
          "me",
          "oauth-clients",
          "create",
          "--name",
          "my-saved",
          "--save",
        ]);

        expect(clientCredentialsGrant).toHaveBeenCalledWith({
          baseUrl: "https://example.com/",
          clientId: "c4",
          clientSecret: "s3cret",
        });
        expect(saveConfig).toHaveBeenCalledWith(
          expect.objectContaining({
            clientId: "c4",
            clientSecret: "s3cret",
            token: "new-token",
          }),
          "default",
        );
        expect(printInfo).toHaveBeenCalledWith(
          "Client credentials saved to config. Auto-reauth enabled.",
        );
        expect(printWarning).not.toHaveBeenCalled();
        expect(printSuccess).toHaveBeenCalledWith("OAuth client created.");
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });
  });

  describe("oauth-clients update", () => {
    it("patches with JSON input and prints success", async () => {
      const body = { name: "renamed" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ clientId: "c1", name: "renamed" }));
      const program = makeProgram();
      await runCommand(program, ["me", "oauth-clients", "update", "c1", '{"name":"renamed"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/oauth-clients/c1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("OAuth client updated.");
    });

    it("builds body from --name and --description flags", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(mockResponse({ clientId: "c1" }));
        const program = makeProgram();
        await runCommand(program, [
          "me", "oauth-clients", "update", "c1",
          "--name", "new-name", "--description", "my desc",
        ]);
        expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/oauth-clients/c1", {
          body: { name: "new-name", description: "my desc" },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("sets policyId to null with --policy-id null", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(mockResponse({ clientId: "c1" }));
        const program = makeProgram();
        await runCommand(program, ["me", "oauth-clients", "update", "c1", "--policy-id", "null"]);
        expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/oauth-clients/c1", {
          body: { policyId: null },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("sets isActive false with --inactive", async () => {
      const isTTY = process.stdin.isTTY;
      process.stdin.isTTY = true;
      try {
        client.rawRequest.mockResolvedValue(mockResponse({ clientId: "c1" }));
        const program = makeProgram();
        await runCommand(program, ["me", "oauth-clients", "update", "c1", "--inactive"]);
        expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/oauth-clients/c1", {
          body: { isActive: false },
        });
      } finally {
        process.stdin.isTTY = isTTY;
      }
    });

    it("encodes special characters in clientId", async () => {
      const body = { name: "x" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ clientId: "urn:c:1" }));
      const program = makeProgram();
      await runCommand(program, ["me", "oauth-clients", "update", "urn:c:1", '{"name":"x"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/me/oauth-clients/urn%3Ac%3A1", { body });
    });
  });

  describe("oauth-clients delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "oauth-clients", "delete", "c1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/oauth-clients/c1");
      expect(printSuccess).toHaveBeenCalledWith("OAuth client deleted.");
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["me", "oauth-clients", "delete", "urn:c:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/me/oauth-clients/urn%3Ac%3A1");
    });
  });
});
