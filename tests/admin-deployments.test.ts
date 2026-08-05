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

vi.mock("../src/output.js", async () => ({
  // Pure string helper with no console side-effects — use the real one so the
  // control-character stripping stays under test.
  sanitizeServerText: (await vi.importActual<typeof import("../src/output.js")>("../src/output.js"))
    .sanitizeServerText,
  printSuccess: vi.fn(),
  printError: vi.fn(),
  printInfo: vi.fn(),
  printWarning: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

vi.mock("../src/prompt.js", () => ({
  isInteractive: vi.fn(() => false),
  promptConfirm: vi.fn(),
}));

vi.mock("../src/commands/help.js", () => ({
  addExamples: vi.fn(),
  addNotes: vi.fn(),
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { printSuccess, printInfo, printWarning } from "../src/output.js";
import { isInteractive, promptConfirm } from "../src/prompt.js";
import { registerDeploymentsCommand } from "../src/commands/admin/deployments.js";

/** Build a response carrying the given headers, for notice/truncation checks. */
function responseWithHeaders<T>(data: T, headers: Record<string, string>, status = 200) {
  return { status, headers: new Headers(headers), data };
}

describe("admin deployments commands", () => {
  let client: MockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createMockClient();
    vi.mocked(createClient).mockReturnValue(client as never);
    vi.mocked(getFormat).mockReturnValue("json");
    vi.mocked(isInteractive).mockReturnValue(false);
  });

  function makeProgram() {
    return createTestProgram((prog) => {
      const admin = prog.command("admin");
      registerDeploymentsCommand(admin);
    });
  }

  function run(args: string[]) {
    return runCommand(makeProgram(), args);
  }

  describe("list", () => {
    it("calls GET /admin/deployments", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      await run(["admin", "deployments", "list"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/deployments", { params: {} });
      expect(outputResponse).toHaveBeenCalled();
    });

    it("filters by enabled state", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      await run(["admin", "deployments", "list", "--disabled"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/deployments", {
        params: { enabled: "false" },
      });
    });

    it("forwards pagination flags", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      await run(["admin", "deployments", "list", "--limit", "10", "--offset", "5"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/deployments", {
        params: { limit: "10", offset: "5" },
      });
    });

    it("rejects contradictory filters", async () => {
      await expect(run(["admin", "deployments", "list", "--enabled", "--disabled"])).rejects.toThrow(
        /both --enabled and --disabled/,
      );
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    // A partial inventory that looks complete is worse than an error.
    it("warns when the server reports a truncated listing", async () => {
      client.rawRequest.mockResolvedValue(
        responseWithHeaders([], { "X-Deployment-List-Truncated": "true" }),
      );
      await run(["admin", "deployments", "list"]);
      expect(printWarning).toHaveBeenCalledWith(expect.stringContaining("incomplete"));
    });

    it("does not warn for a complete listing", async () => {
      client.rawRequest.mockResolvedValue(mockResponse([]));
      await run(["admin", "deployments", "list"]);
      expect(printWarning).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("calls GET /admin/deployments/{hostname}", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ hostname: "a.example.com" }));
      await run(["admin", "deployments", "get", "a.example.com"]);
      expect(client.rawRequest).toHaveBeenCalledWith("GET", "/admin/deployments/a.example.com");
    });

    // Routing looks up a lowercased Host, so an uppercase argument must not
    // look like a missing row.
    it("lowercases the hostname before requesting it", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}));
      await run(["admin", "deployments", "get", "Tenant-A.Example.COM"]);
      expect(client.rawRequest).toHaveBeenCalledWith(
        "GET",
        "/admin/deployments/tenant-a.example.com",
      );
    });
  });

  // An empty hostname would collapse /admin/deployments/{hostname} to the
  // collection path: `get` would return the whole listing and `delete` would
  // aim a destructive request at the collection.
  describe("empty hostname", () => {
    it.each([
      ["get", ["admin", "deployments", "get", "   "]],
      ["update", ["admin", "deployments", "update", "   ", "--enable"]],
      ["delete", ["admin", "deployments", "delete", "   ", "--yes"]],
      [
        "create",
        [
          "admin", "deployments", "create", "   ",
          "--database", "db_a", "--plan", "STANDARD", "--secret", "s",
        ],
      ],
    ])("%s refuses a blank hostname without calling the server", async (_label, args) => {
      await expect(run(args)).rejects.toThrow(/hostname must not be empty/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });
  });

  describe("create", () => {
    it("builds the request body from flags", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "PREMIUM", "--secret", "geonicdb/a/uri",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/deployments", {
        body: {
          hostname: "a.example.com",
          databaseName: "db_a",
          defaultQuotaPlan: "PREMIUM",
          mongodbUriSecretArn: "geonicdb/a/uri",
        },
      });
      expect(printSuccess).toHaveBeenCalledWith("Deployment created.");
    });

    it("includes optional fields when given", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "STANDARD", "--secret", "geonicdb/a/uri",
        "--rate-limit-table", "rl-a", "--disabled", "--metadata", '{"owner":"sales"}',
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/deployments", {
        body: expect.objectContaining({
          rateLimitTableName: "rl-a",
          enabled: false,
          metadata: { owner: "sales" },
        }),
      });
    });

    it("accepts a lowercase plan and normalizes it", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "premium", "--secret", "geonicdb/a/uri",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/deployments", {
        body: expect.objectContaining({ defaultQuotaPlan: "PREMIUM" }),
      });
    });

    it("lowercases the hostname it stores", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "A.Example.COM",
        "--database", "db_a", "--plan", "STANDARD", "--secret", "geonicdb/a/uri",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("POST", "/admin/deployments", {
        body: expect.objectContaining({ hostname: "a.example.com" }),
      });
    });

    // A row with no connection source routes traffic to a cluster it cannot
    // reach, so it must never leave the CLI.
    it("refuses a row with no connection source", async () => {
      await expect(
        run(["admin", "deployments", "create", "a.example.com", "--database", "db_a", "--plan", "STANDARD"]),
      ).rejects.toThrow(/--secret or --mongodb-uri/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("requires --database", async () => {
      await expect(
        run(["admin", "deployments", "create", "a.example.com", "--plan", "STANDARD", "--secret", "s"]),
      ).rejects.toThrow(/--database is required/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("requires --plan", async () => {
      await expect(
        run(["admin", "deployments", "create", "a.example.com", "--database", "db_a", "--secret", "s"]),
      ).rejects.toThrow(/--plan is required/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("rejects an unknown quota plan", async () => {
      await expect(
        run([
          "admin", "deployments", "create", "a.example.com",
          "--database", "db_a", "--plan", "GOLD", "--secret", "s",
        ]),
      ).rejects.toThrow(/--plan must be one of/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it.each([
      ["invalid JSON", "{not json}"],
      ["an array", "[1,2]"],
      ["a scalar", '"text"'],
      ["null", "null"],
    ])("rejects metadata that is %s", async (_label, metadata) => {
      await expect(
        run([
          "admin", "deployments", "create", "a.example.com",
          "--database", "db_a", "--plan", "STANDARD", "--secret", "s", "--metadata", metadata,
        ]),
      ).rejects.toThrow(/--metadata must be a JSON object/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    // The connection string is a credential; putting it on the command line
    // leaks it into shell history and process listings.
    it("warns when a plaintext connection string is passed", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "STANDARD", "--mongodb-uri", "mongodb://u:p@host:27017",
      ]);
      expect(printWarning).toHaveBeenCalledWith(expect.stringContaining("shell history"));
    });

    it("does not warn when using a secret reference", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}, 201));
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "STANDARD", "--secret", "geonicdb/a/uri",
      ]);
      expect(printWarning).not.toHaveBeenCalled();
    });

    // "Created" must not read as "live on every instance".
    // Server-supplied text printed as text, not JSON: a hostile server must not
    // be able to rewrite the operator terminal with ANSI escapes.
    it("strips control characters from a server-supplied notice", async () => {
      client.rawRequest.mockResolvedValue(
        mockResponse({ notice: "ok\u001b[2Kinjected\u0007" }, 201),
      );
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "STANDARD", "--secret", "geonicdb/a/uri",
      ]);
      expect(printInfo).toHaveBeenCalledWith("ok[2Kinjected");
    });

    it("surfaces the convergence notice from the response body", async () => {
      client.rawRequest.mockResolvedValue(
        mockResponse({ hostname: "a.example.com", notice: "Routing caches are per-instance" }, 201),
      );
      await run([
        "admin", "deployments", "create", "a.example.com",
        "--database", "db_a", "--plan", "STANDARD", "--secret", "geonicdb/a/uri",
      ]);
      expect(printInfo).toHaveBeenCalledWith("Routing caches are per-instance");
    });
  });

  describe("update", () => {
    it("sends only the fields that were given", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}));
      await run(["admin", "deployments", "update", "a.example.com", "--plan", "ENTERPRISE"]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/deployments/a.example.com", {
        body: { defaultQuotaPlan: "ENTERPRISE" },
      });
      expect(printSuccess).toHaveBeenCalledWith("Deployment updated.");
    });

    it.each([
      ["--enable", true],
      ["--disable", false],
    ])("maps %s to the enabled flag", async (flag, expected) => {
      client.rawRequest.mockResolvedValue(mockResponse({}));
      await run(["admin", "deployments", "update", "a.example.com", flag]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/deployments/a.example.com", {
        body: { enabled: expected },
      });
    });

    // null is the server's explicit "remove this field" signal.
    it.each([
      ["--clear-secret", "mongodbUriSecretArn"],
      ["--clear-mongodb-uri", "mongodbUri"],
      ["--clear-rate-limit-table", "rateLimitTableName"],
      ["--clear-metadata", "metadata"],
    ])("%s sends an explicit null for %s", async (flag, field) => {
      client.rawRequest.mockResolvedValue(mockResponse({}));
      await run(["admin", "deployments", "update", "a.example.com", flag]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/deployments/a.example.com", {
        body: { [field]: null },
      });
    });

    it("supports migrating from a plaintext URI to a secret in one request", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({}));
      await run([
        "admin", "deployments", "update", "a.example.com",
        "--secret", "geonicdb/a/uri", "--clear-mongodb-uri",
      ]);
      expect(client.rawRequest).toHaveBeenCalledWith("PATCH", "/admin/deployments/a.example.com", {
        body: { mongodbUriSecretArn: "geonicdb/a/uri", mongodbUri: null },
      });
    });

    it("refuses an empty update", async () => {
      await expect(run(["admin", "deployments", "update", "a.example.com"])).rejects.toThrow(
        /Nothing to update/,
      );
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("refuses --enable together with --disable", async () => {
      await expect(
        run(["admin", "deployments", "update", "a.example.com", "--enable", "--disable"]),
      ).rejects.toThrow(/both --enable and --disable/);
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it.each([
      ["--secret", "value", "--clear-secret"],
      ["--mongodb-uri", "mongodb://h", "--clear-mongodb-uri"],
      ["--rate-limit-table", "rl", "--clear-rate-limit-table"],
      ["--metadata", "{}", "--clear-metadata"],
    ])("refuses %s together with %s", async (flag, value, clearFlag) => {
      await expect(
        run(["admin", "deployments", "update", "a.example.com", flag, value, clearFlag]),
      ).rejects.toThrow(new RegExp(clearFlag));
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("surfaces the convergence notice", async () => {
      client.rawRequest.mockResolvedValue(mockResponse({ notice: "cache notice" }));
      await run(["admin", "deployments", "update", "a.example.com", "--enable"]);
      expect(printInfo).toHaveBeenCalledWith("cache notice");
    });
  });

  describe("delete", () => {
    it("deletes with --yes", async () => {
      client.rawRequest.mockResolvedValue(mockResponse("", 204));
      await run(["admin", "deployments", "delete", "a.example.com", "--yes"]);
      expect(client.rawRequest).toHaveBeenCalledWith("DELETE", "/admin/deployments/a.example.com");
      expect(printSuccess).toHaveBeenCalledWith("Deployment deleted.");
    });

    // Deleting a row takes an entire hostname offline.
    it("refuses to run unconfirmed in a non-interactive shell", async () => {
      vi.mocked(isInteractive).mockReturnValue(false);
      await expect(run(["admin", "deployments", "delete", "a.example.com"])).rejects.toThrow(
        /--yes/,
      );
      expect(client.rawRequest).not.toHaveBeenCalled();
    });

    it("prompts for confirmation when interactive", async () => {
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptConfirm).mockResolvedValue(true);
      client.rawRequest.mockResolvedValue(mockResponse("", 204));
      await run(["admin", "deployments", "delete", "a.example.com"]);
      expect(promptConfirm).toHaveBeenCalled();
      expect(client.rawRequest).toHaveBeenCalled();
    });

    it("aborts without deleting when the prompt is declined", async () => {
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptConfirm).mockResolvedValue(false);
      await run(["admin", "deployments", "delete", "a.example.com"]);
      expect(client.rawRequest).not.toHaveBeenCalled();
      expect(printSuccess).not.toHaveBeenCalled();
    });

    // DELETE returns 204, so its notice travels in a header instead of a body.
    it("surfaces the convergence notice from the response header", async () => {
      client.rawRequest.mockResolvedValue(
        responseWithHeaders("", { "X-Deployment-Cache-Notice": "cache notice" }, 204),
      );
      await run(["admin", "deployments", "delete", "a.example.com", "--yes"]);
      expect(printInfo).toHaveBeenCalledWith("cache notice");
    });

    it("names the normalized hostname in the refusal", async () => {
      await expect(
        run(["admin", "deployments", "delete", "A.Example.COM"]),
      ).rejects.toThrow(/a\.example\.com/);
    });
  });
});
