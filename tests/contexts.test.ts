import { describe, it, expect, vi, beforeEach } from "vitest";
import { InvalidArgumentError } from "commander";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
  resolveOptions: vi.fn().mockReturnValue({ url: "http://localhost:3000" }),
  parseNonNegativeInt: (value: string): number => {
    if (!/^\d+$/.test(value)) throw new Error("Invalid non-negative integer");
    return Number(value);
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

import { createClient, getFormat, outputResponse, resolveOptions } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess, printOutput, printError } from "../src/output.js";
import {
  parseJsonLdContextKind,
  resolveRegisteredContextUrl,
  registerContextsCommand,
} from "../src/commands/contexts.js";

describe("contexts (jsonldContexts) command (#241)", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    vi.mocked(resolveOptions).mockReturnValue({ url: "http://localhost:3000" });
    program = createTestProgram(registerContextsCommand);
  });

  describe("parseJsonLdContextKind", () => {
    it.each(["Cached", "Hosted", "ImplicitlyCreated", "cached", "hosted", "implicitlyCreated"])(
      "accepts %s",
      (kind) => {
        expect(parseJsonLdContextKind(kind)).toBe(kind);
      },
    );

    // near-miss: one character off / wrong case mixture that the server would 400
    it.each(["Hostedd", "host", "Implicit", "Cached ", "HOSTED", ""])(
      "rejects near-miss kind %j",
      (kind) => {
        expect(() => parseJsonLdContextKind(kind)).toThrow(InvalidArgumentError);
      },
    );
  });

  describe("resolveRegisteredContextUrl", () => {
    it("resolves a relative Location against the CLI base URL", () => {
      expect(
        resolveRegisteredContextUrl(
          "/ngsi-ld/v1/jsonldContexts/urn:ngsi-ld:JsonLdContext:abc",
          "http://localhost:3000",
        ),
      ).toBe("http://localhost:3000/ngsi-ld/v1/jsonldContexts/urn:ngsi-ld:JsonLdContext:abc");
    });

    it("keeps an absolute Location unchanged", () => {
      const abs =
        "https://broker.example/ngsi-ld/v1/jsonldContexts/urn:ngsi-ld:JsonLdContext:abc";
      expect(resolveRegisteredContextUrl(abs, "http://localhost:3000")).toBe(abs);
    });
  });

  describe("list", () => {
    it("calls GET /jsonldContexts with no params by default", async () => {
      mockClient.get.mockResolvedValue(mockResponse(["http://localhost:3000/ngsi-ld/v1/jsonldContexts/a"]));
      await runCommand(program, ["contexts", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/jsonldContexts", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("works with jsonld-contexts alias", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["jsonld-contexts", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/jsonldContexts", {});
    });

    it("forwards --details as details=true", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["contexts", "list", "--details"]);

      expect(mockClient.get).toHaveBeenCalledWith("/jsonldContexts", { details: "true" });
    });

    it("forwards --kind Hosted", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["contexts", "list", "--kind", "Hosted"]);

      expect(mockClient.get).toHaveBeenCalledWith("/jsonldContexts", { kind: "Hosted" });
    });

    it("forwards --details and --kind together", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["contexts", "list", "--details", "--kind", "Cached"]);

      expect(mockClient.get).toHaveBeenCalledWith("/jsonldContexts", {
        details: "true",
        kind: "Cached",
      });
    });

    it("rejects an invalid --kind before the request", async () => {
      await expect(runCommand(program, ["contexts", "list", "--kind", "Hostedd"])).rejects.toThrow();
      expect(mockClient.get).not.toHaveBeenCalled();
    });
  });

  describe("get", () => {
    it("calls GET /jsonldContexts/{id} with encoded id", async () => {
      const id = "urn:ngsi-ld:JsonLdContext:abc";
      mockClient.get.mockResolvedValue(mockResponse({ "@context": {} }));
      await runCommand(program, ["contexts", "get", id]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/jsonldContexts/${encodeURIComponent(id)}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("POSTs the @context document and prints the registered URL from Location", async () => {
      const body = { "@context": { Vehicle: "https://example.org/ns#Vehicle" } };
      vi.mocked(parseJsonInput).mockResolvedValue(body);
      const location = "/ngsi-ld/v1/jsonldContexts/urn:ngsi-ld:JsonLdContext:abc";
      mockClient.post.mockResolvedValue({
        status: 201,
        headers: new Headers({ Location: location }),
        data: "",
      });

      await runCommand(program, [
        "contexts",
        "create",
        '{"@context":{"Vehicle":"https://example.org/ns#Vehicle"}}',
      ]);

      expect(parseJsonInput).toHaveBeenCalledWith(
        '{"@context":{"Vehicle":"https://example.org/ns#Vehicle"}}',
      );
      expect(mockClient.post).toHaveBeenCalledWith("/jsonldContexts", body);
      expect(printOutput).toHaveBeenCalledWith(
        {
          url: "http://localhost:3000/ngsi-ld/v1/jsonldContexts/urn:ngsi-ld:JsonLdContext:abc",
        },
        "json",
      );
      expect(printSuccess).toHaveBeenCalledWith("Context created.");
    });

    it("fails loudly when Location is missing", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ "@context": {} });
      mockClient.post.mockResolvedValue(mockResponse("", 201));

      await runCommand(program, ["contexts", "create", '{"@context":{}}']);

      expect(printError).toHaveBeenCalledWith(
        "Context created but the Location header was missing.",
      );
      expect(printOutput).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
    });
  });

  describe("delete", () => {
    it("calls DELETE /jsonldContexts/{id}", async () => {
      const id = "urn:ngsi-ld:JsonLdContext:abc";
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["contexts", "delete", id]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/jsonldContexts/${encodeURIComponent(id)}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Context deleted.");
    });
  });
});
