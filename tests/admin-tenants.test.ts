import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn(),
  parseNonNegativeInt: (value: string): number => {
    if (!/^\d+$/.test(value)) throw new Error("Invalid non-negative integer");
    return Number(value);
  },
  buildPaginationParams: (opts: { limit?: number; offset?: number }): Record<string, string> => {
    const params: Record<string, string> = {};
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return params;
  },
  // Single-request passthrough; the real page-following logic is unit-tested
  // in tests/helpers.test.ts against the unmocked implementation.
  fetchPaginatedList: async (
    client: { rawRequest: (method: string, path: string, options?: unknown) => Promise<unknown> },
    path: string,
    opts: { limit?: number; offset?: number },
    extraParams: Record<string, string> = {},
  ): Promise<unknown> => {
    const params: Record<string, string> = { ...extraParams };
    if (opts.limit !== undefined) params["limit"] = String(opts.limit);
    if (opts.offset !== undefined) params["offset"] = String(opts.offset);
    return client.rawRequest("GET", path, { params });
  },
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
import { registerTenantsCommand } from "../src/commands/admin/tenants.js";

describe("admin tenants commands", () => {
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
      registerTenantsCommand(admin);
    });
  }

  describe("tenants list", () => {
    it("calls rawRequest GET /admin/tenants", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([{ id: "t1" }]));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants", { params: {} });
      expect(outputResponse).toHaveBeenCalled();
    });

    it("forwards --limit and --offset", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "list", "--limit", "10", "--offset", "5"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants", {
        params: { limit: "10", offset: "5" },
      });
    });
  });

  describe("tenants get", () => {
    it("calls rawRequest GET /admin/tenants/{id}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "get", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants/t1");
      expect(outputResponse).toHaveBeenCalled();
    });

    it("encodes special characters in id", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ id: "urn:t:1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "get", "urn:t:1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/tenants/urn%3At%3A1");
    });
  });

  describe("tenants create", () => {
    it("posts body and prints success", async () => {
      const body = { name: "new-tenant" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t2" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "create", '{"name":"new-tenant"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Tenant created.");
    });

    it("merges --allowed-origins into settings", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ name: "production" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t2" }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "create",
        '{"name":"production"}',
        "--allowed-origins",
        "https://a.example.com,https://b.example.com",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", {
        body: {
          name: "production",
          settings: {
            allowedOrigins: ["https://a.example.com", "https://b.example.com"],
          },
        },
      });
    });

    it("preserves existing settings keys when merging --allowed-origins", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({
        name: "production",
        settings: { someOtherFlag: true },
      });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t2" }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "create",
        '{"name":"production","settings":{"someOtherFlag":true}}',
        "--allowed-origins",
        "https://app.example.com",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", {
        body: {
          name: "production",
          settings: {
            someOtherFlag: true,
            allowedOrigins: ["https://app.example.com"],
          },
        },
      });
    });

    it("treats wildcard --allowed-origins as ['*'] on create", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ name: "dev" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t3" }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "create",
        '{"name":"dev"}',
        "--allowed-origins",
        "*",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", {
        body: { name: "dev", settings: { allowedOrigins: ["*"] } },
      });
    });

    it("treats empty --allowed-origins as [] on create", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ name: "locked" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t4" }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "create",
        '{"name":"locked"}',
        "--allowed-origins",
        "",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", {
        body: { name: "locked", settings: { allowedOrigins: [] } },
      });
    });

    it("merges --allowed-origins into stdin/interactive body (no JSON arg)", async () => {
      // Simulates `cat tenant.json | geonic admin tenants create --allowed-origins ...`
      // and the TTY interactive case — both are routed through parseJsonInput(undefined).
      vi.mocked(parseJsonInput).mockResolvedValue({ name: "from-stdin" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t5" }, 201));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "create",
        "--allowed-origins",
        "https://app.example.com",
      ]);
      expect(parseJsonInput).toHaveBeenCalledWith(undefined);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", {
        body: {
          name: "from-stdin",
          settings: { allowedOrigins: ["https://app.example.com"] },
        },
      });
    });

    it("falls back to parseJsonInput when no json and no --allowed-origins on create", async () => {
      const body = { name: "interactive" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t6" }, 201));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "create"]);
      expect(parseJsonInput).toHaveBeenCalledWith(undefined);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants", { body });
    });
  });

  describe("tenants update", () => {
    it("patches body and prints success", async () => {
      const body = { name: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "update", "t1", '{"name":"updated"}']);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", { body });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Tenant updated.");
    });

    it("falls back to parseJsonInput when no json argument", async () => {
      const body = { description: "interactive" };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "update", "t1"]);
      expect(parseJsonInput).toHaveBeenCalledWith(undefined);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", { body });
    });

    it("merges --allowed-origins into stdin/interactive body (no JSON arg)", async () => {
      // Simulates `cat patch.json | geonic admin tenants update t1 --allowed-origins ...`
      // and the TTY interactive case — both are routed through parseJsonInput(undefined).
      vi.mocked(parseJsonInput).mockResolvedValue({ description: "from-stdin" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        "--allowed-origins",
        "https://app.example.com",
      ]);
      expect(parseJsonInput).toHaveBeenCalledWith(undefined);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: {
          description: "from-stdin",
          settings: { allowedOrigins: ["https://app.example.com"] },
        },
      });
    });

    it("treats wildcard --allowed-origins as ['*']", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        "--allowed-origins",
        "*",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: { settings: { allowedOrigins: ["*"] } },
      });
    });

    it("treats empty --allowed-origins as [] (deny all)", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        "--allowed-origins",
        "",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: { settings: { allowedOrigins: [] } },
      });
    });

    it("trims whitespace and ignores empty entries in --allowed-origins", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({});
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        "--allowed-origins",
        " https://a.example.com , , https://b.example.com ",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: {
          settings: {
            allowedOrigins: ["https://a.example.com", "https://b.example.com"],
          },
        },
      });
    });

    it("preserves existing settings keys from JSON when merging --allowed-origins", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({
        settings: { someOtherFlag: true },
      });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        '{"settings":{"someOtherFlag":true}}',
        "--allowed-origins",
        "https://app.example.com",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: {
          settings: {
            someOtherFlag: true,
            allowedOrigins: ["https://app.example.com"],
          },
        },
      });
    });

    it("overwrites existing settings.allowedOrigins from JSON when --allowed-origins is given", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({
        settings: { allowedOrigins: ["https://old.example.com"] },
      });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        '{"settings":{"allowedOrigins":["https://old.example.com"]}}',
        "--allowed-origins",
        "https://new.example.com",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: {
          settings: { allowedOrigins: ["https://new.example.com"] },
        },
      });
    });

    it("does not add settings field when --allowed-origins is not provided", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ description: "no flag" });
      client.rawRequest.mockResolvedValue(mockResponse({ id: "t1" }));
      const program = makeProgram();
      await runCommand(program, [
        "admin",
        "tenants",
        "update",
        "t1",
        '{"description":"no flag"}',
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/tenants/t1", {
        body: { description: "no flag" },
      });
    });
  });

  describe("tenants delete", () => {
    it("calls DELETE and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "delete", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/tenants/t1");
      expect(printSuccess).toHaveBeenCalledWith("Tenant deleted.");
    });
  });

  describe("tenants activate", () => {
    it("calls POST activate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "activate", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants/t1/activate");
      expect(printSuccess).toHaveBeenCalledWith("Tenant activated.");
    });
  });

  describe("tenants deactivate", () => {
    it("calls POST deactivate and prints success", async () => {
      client.rawRequest.mockResolvedValue(mockResponse(undefined));
      const program = makeProgram();
      await runCommand(program, ["admin", "tenants", "deactivate", "t1"]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/tenants/t1/deactivate");
      expect(printSuccess).toHaveBeenCalledWith("Tenant deactivated.");
    });
  });
});
