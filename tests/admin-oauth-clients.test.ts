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

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerOAuthClientsCommand, registerCaddeCommand } from "../src/commands/admin/oauth-clients.js";

describe("admin oauth-clients commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      const admin = prog.command("admin");
      registerOAuthClientsCommand(admin);
      registerCaddeCommand(admin);
    });
  }

  describe("oauth-clients list", () => {
    it("calls rawRequest GET /admin/oauth-clients", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ id: "c1" }]));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/oauth-clients");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("oauth-clients get", () => {
    it("calls rawRequest GET /admin/oauth-clients/{id}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "c1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "get", "c1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/oauth-clients/c1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "urn:c:1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "get", "urn:c:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/oauth-clients/urn%3Ac%3A1");
    });
  });

  describe("oauth-clients create", () => {
    it("posts body and prints success", async () => {
      const body = { name: "my-client" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "c2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "create", '{"name":"my-client"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/oauth-clients", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("OAuth client created.");
    });
  });

  describe("oauth-clients update", () => {
    it("patches body and prints success", async () => {
      const body = { name: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "c1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "update", "c1", '{"name":"updated"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/oauth-clients/c1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("OAuth client updated.");
    });
  });

  describe("oauth-clients delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "oauth-clients", "delete", "c1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/oauth-clients/c1");
      expect(printSuccess).toHaveBeenCalledWith("OAuth client deleted.");
    });
  });
});

describe("admin cadde commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      const admin = prog.command("admin");
      registerOAuthClientsCommand(admin);
      registerCaddeCommand(admin);
    });
  }

  describe("cadde get", () => {
    it("calls rawRequest GET /admin/cadde", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ enabled: true }));
      const program = makeProgram();
      await runCommand(program, ["admin", "cadde", "get"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/cadde");
      expect(outputResponse).toHaveBeenCalled();
    });
  });

  describe("cadde set", () => {
    it("puts body and prints success", async () => {
      const body = { enabled: true, endpoint: "http://cadde.example.com" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ enabled: true }));
      const program = makeProgram();
      await runCommand(program, ["admin", "cadde", "set", '{"enabled":true}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PUT", "/admin/cadde", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("CADDE configuration set.");
    });
  });

  describe("cadde delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "cadde", "delete"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/cadde");
      expect(printSuccess).toHaveBeenCalledWith("CADDE configuration deleted.");
    });
  });
});
