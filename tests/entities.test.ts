import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

vi.mock("../src/helpers.js", () => ({
  createClient: vi.fn(),
  getFormat: vi.fn(),
  outputResponse: vi.fn(),
  withErrorHandler: (fn: (...args: unknown[]) => unknown) => fn,
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

vi.mock("../src/commands/attrs.js", () => ({
  registerAttrsSubcommand: vi.fn(),
}));

vi.mock("../src/prompt.js", () => ({
  isInteractive: vi.fn(),
  promptConfirm: vi.fn(),
}));

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printCount, printError, printSuccess } from "../src/output.js";
import { isInteractive, promptConfirm } from "../src/prompt.js";
import { registerEntitiesCommand } from "../src/commands/entities.js";

describe("entities command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    vi.mocked(isInteractive).mockReturnValue(false);
    vi.mocked(promptConfirm).mockResolvedValue(false);
    program = createTestProgram(registerEntitiesCommand);
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  describe("list", () => {
    it("calls client.get with no params when no options given", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list"]);

      expect(createClient).toHaveBeenCalled();
      expect(mockClient.get).toHaveBeenCalledWith("/entities", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", false);
    });

    it("passes type option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--type", "Sensor"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ type: "Sensor" }));
    });

    it("passes idPattern option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--id-pattern", "urn:.*"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ idPattern: "urn:.*" }));
    });

    it("passes query option as q", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--query", "temperature>30"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ q: "temperature>30" }));
    });

    it("passes attrs option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--attrs", "temperature,humidity"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ attrs: "temperature,humidity" }));
    });

    it("passes geo-query options", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, [
        "entities", "list",
        "--georel", "near;maxDistance==1000",
        "--geometry", "Point",
        "--coords", "[139.7,35.6]",
      ]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({
        georel: "near;maxDistance==1000",
        geometry: "Point",
        coordinates: "[139.7,35.6]",
      }));
    });

    it("passes spatialId option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--spatial-id", "15/0/29101/12903"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ spatialId: "15/0/29101/12903" }));
    });

    it("passes limit and offset options", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--limit", "10", "--offset", "20"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({
        limit: "10",
        offset: "20",
      }));
    });

    it("passes orderBy option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--order-by", "temperature"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ orderBy: "temperature" }));
    });

    it("passes count option and sets showCount to true", async () => {
      mockClient.get.mockResolvedValue(mockResponse([], 200, 42));
      await runCommand(program, ["entities", "list", "--count"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ count: "true" }));
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", true);
    });

    it("passes count-only option with limit=0 and only shows count", async () => {
      mockClient.get.mockResolvedValue(mockResponse([], 200, 42));
      await runCommand(program, ["entities", "list", "--count-only"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({
        count: "true",
        limit: "0",
      }));
      expect(printCount).toHaveBeenCalledWith(42);
      expect(outputResponse).not.toHaveBeenCalled();
    });

    it("count-only defaults to 0 when response has no count", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--count-only"]);

      expect(printCount).toHaveBeenCalledWith(0);
      expect(outputResponse).not.toHaveBeenCalled();
    });

    it("passes keyValues option as options=keyValues", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--key-values"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ options: "keyValues" }));
    });

    it("passes sysAttrs option as options=sysAttrs", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--sys-attrs"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ options: "sysAttrs" }));
    });

    it("combines keyValues and sysAttrs options", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--key-values", "--sys-attrs"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ options: "keyValues,sysAttrs" }));
    });

    it("passes scopeQ option", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--scope-q", "/restaurants/#"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", expect.objectContaining({ scopeQ: "/restaurants/#" }));
    });

    // #246 / geonicdb#3524: scopeQ AND requires parentheses; levels are letter-first.
    it("documents scopeQ AND parentheses and letter-first levels in --scope-q help (#246)", () => {
      const listCmd = program.commands
        .find((c) => c.name() === "entities")!
        .commands.find((c) => c.name() === "list")!;
      const scopeQ = listCmd.options.find((o) => o.long === "--scope-q");
      expect(scopeQ).toBeDefined();
      const desc = scopeQ!.description;
      expect(desc).toContain("parentheses required");
      expect(desc).toContain("(/A;/B)");
      expect(desc).toMatch(/start with a letter/i);
      expect(desc).toContain("/Madrid/1st");
      // near-miss: bare AND without parens must not be shown as the legal form
      expect(desc).not.toMatch(/(?<!\()\/A;\/B(?!\))/);
      // near-miss: digit-leading level must only appear as a rejected example
      expect(desc).toMatch(/\/Madrid\/1st.*reject/i);
    });

    // #214: selector-less list is a too-wide 400 unless ?local=true.
    it("passes --local as local=true query param (#214)", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--local"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", { local: "true" });
    });

    // near-miss: without --local the params must stay empty —
    // accidentally always sending local=true would change federation semantics.
    it("does not send local when --local is omitted (near-miss)", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", {});
      expect(mockClient.get.mock.calls[0]?.[1]).not.toHaveProperty("local");
    });

    // near-miss: --local must compose with other filters, not replace them.
    it("composes --local with type filter (near-miss)", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["entities", "list", "--type", "Sensor", "--local"]);

      expect(mockClient.get).toHaveBeenCalledWith("/entities", {
        type: "Sensor",
        local: "true",
      });
    });
  });

  describe("get", () => {
    it("calls client.get with encoded entity ID", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "urn:ngsi-ld:Sensor:001" }));
      await runCommand(program, ["entities", "get", "urn:ngsi-ld:Sensor:001"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
        {},
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("passes keyValues option", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "e1" }));
      await runCommand(program, ["entities", "get", "e1", "--key-values"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("e1")}`,
        { options: "keyValues" },
      );
    });

    it("passes sysAttrs option", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "e1" }));
      await runCommand(program, ["entities", "get", "e1", "--sys-attrs"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("e1")}`,
        { options: "sysAttrs" },
      );
    });

    it("combines keyValues and sysAttrs options", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "e1" }));
      await runCommand(program, ["entities", "get", "e1", "--key-values", "--sys-attrs"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("e1")}`,
        { options: "keyValues,sysAttrs" },
      );
    });
  });

  describe("create", () => {
    it("parses JSON input and posts to /entities", async () => {
      const entityData = { id: "urn:ngsi-ld:Sensor:001", type: "Sensor" };
      vi.mocked(parseJsonInput).mockResolvedValue(entityData);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 201));

      await runCommand(program, ["entities", "create", '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor"}');
      expect(mockClient.post).toHaveBeenCalledWith("/entities", entityData);
      expect(printSuccess).toHaveBeenCalledWith("Entity created.");
    });

    it("rejects --key-values without calling the API", async () => {
      await expect(
        runCommand(program, ["entities", "create", "{}", "--key-values"]),
      ).rejects.toThrow("exit:1");
      expect(printError).toHaveBeenCalledWith("server does not accept keyValues on create");
      expect(mockClient.post).not.toHaveBeenCalled();
      expect(parseJsonInput).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("parses JSON input and patches entity attrs", async () => {
      const attrData = { temperature: { value: 25 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "update", "urn:ngsi-ld:Sensor:001", '{"temperature":{"value":25}}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"temperature":{"value":25}}');
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity updated.");
    });

    it("passes options=keyValues when --key-values is set", async () => {
      const attrData = { temperature: 25 };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, [
        "entities",
        "update",
        "urn:ngsi-ld:Sensor:001",
        '{"temperature":25}',
        "--key-values",
      ]);

      expect(mockClient.patch).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}/attrs`,
        attrData,
        { options: "keyValues" },
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity updated.");
    });

    // near-miss: omitting --key-values must not send options at all
    // (accidentally always attaching options=keyValues would break normalized writes).
    it("does not send options when --key-values is omitted (near-miss)", async () => {
      const attrData = { temperature: { type: "Property", value: 25 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, [
        "entities",
        "update",
        "urn:ngsi-ld:Sensor:001",
        '{"temperature":{"type":"Property","value":25}}',
      ]);

      expect(mockClient.patch).toHaveBeenCalledTimes(1);
      expect(mockClient.patch.mock.calls[0]).toHaveLength(2);
      expect(mockClient.patch.mock.calls[0]?.[2]).toBeUndefined();
    });
  });

  describe("replace", () => {
    it("parses JSON input and puts to /entities/{id} (NGSI-LD 5.6.4 Replace Entity)", async () => {
      const attrData = { temperature: { value: 30 } };
      vi.mocked(parseJsonInput).mockResolvedValue(attrData);
      mockClient.put.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "replace", "urn:ngsi-ld:Sensor:001", '{"temperature":{"value":30}}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"temperature":{"value":30}}');
      expect(mockClient.put).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
        attrData,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity replaced.");
    });

    it("passes options=keyValues when --key-values is set", async () => {
      const entityData = { id: "urn:ngsi-ld:Sensor:001", type: "Sensor", temperature: 20 };
      vi.mocked(parseJsonInput).mockResolvedValue(entityData);
      mockClient.put.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, [
        "entities",
        "replace",
        "urn:ngsi-ld:Sensor:001",
        '{"id":"urn:ngsi-ld:Sensor:001","type":"Sensor","temperature":20}',
        "--key-values",
      ]);

      expect(mockClient.put).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
        entityData,
        { options: "keyValues" },
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity replaced.");
    });

    // near-miss: omitting --key-values must not send options at all.
    it("does not send options when --key-values is omitted (near-miss)", async () => {
      const entityData = { id: "e1", type: "Sensor", temperature: { type: "Property", value: 20 } };
      vi.mocked(parseJsonInput).mockResolvedValue(entityData);
      mockClient.put.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "replace", "e1", "{}"]);

      expect(mockClient.put).toHaveBeenCalledTimes(1);
      expect(mockClient.put.mock.calls[0]).toHaveLength(2);
      expect(mockClient.put.mock.calls[0]?.[2]).toBeUndefined();
    });
  });

  describe("upsert", () => {
    it("parses JSON input and posts to /entityOperations/upsert", async () => {
      const entities = [{ id: "e1", type: "T" }];
      vi.mocked(parseJsonInput).mockResolvedValue(entities);
      mockClient.post.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "upsert", '[{"id":"e1","type":"T"}]']);

      expect(parseJsonInput).toHaveBeenCalledWith('[{"id":"e1","type":"T"}]');
      expect(mockClient.post).toHaveBeenCalledWith("/entityOperations/upsert", entities);
      expect(printSuccess).toHaveBeenCalledWith("Entity upserted.");
    });

    it("rejects --key-values without calling the API", async () => {
      await expect(
        runCommand(program, ["entities", "upsert", "[]", "--key-values"]),
      ).rejects.toThrow("exit:1");
      expect(printError).toHaveBeenCalledWith("server does not accept keyValues on upsert");
      expect(mockClient.post).not.toHaveBeenCalled();
      expect(parseJsonInput).not.toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("deletes entity by ID", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "delete", "urn:ngsi-ld:Sensor:001"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/entities/${encodeURIComponent("urn:ngsi-ld:Sensor:001")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Entity deleted.");
    });
  });

  describe("purge", () => {
    it("deletes with assembled selector and mutation params", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, [
        "entities", "purge",
        "--type", "Room",
        "--id", "urn:1,urn:2",
        "--id-pattern", "urn:.*",
        "--query", "temperature>30",
        "--attrs", "temperature,humidity",
        "--georel", "near;maxDistance==1000",
        "--geometry", "Point",
        "--coords", "[139.7,35.6]",
        "--scope-q", "/Japan/#",
        "--local",
        "--drop", "temperature",
        "--yes",
      ]);

      expect(mockClient.delete).toHaveBeenCalledWith("/entities", {
        type: "Room",
        id: "urn:1,urn:2",
        idPattern: "urn:.*",
        q: "temperature>30",
        attrs: "temperature,humidity",
        georel: "near;maxDistance==1000",
        geometry: "Point",
        coordinates: "[139.7,35.6]",
        scopeQ: "/Japan/#",
        local: "true",
        drop: "temperature",
      });
      expect(printSuccess).toHaveBeenCalledWith("Purge completed.");
      expect(promptConfirm).not.toHaveBeenCalled();
    });

    it("refuses without --yes in non-interactive mode", async () => {
      vi.mocked(isInteractive).mockReturnValue(false);

      await expect(
        runCommand(program, ["entities", "purge", "--type", "Room"]),
      ).rejects.toThrow("Refusing to purge without confirmation. Re-run with --yes.");

      expect(mockClient.delete).not.toHaveBeenCalled();
      expect(promptConfirm).not.toHaveBeenCalled();
    });

    it("asks for confirmation in interactive mode and aborts when declined", async () => {
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptConfirm).mockResolvedValue(false);

      await runCommand(program, ["entities", "purge", "--type", "Room"]);

      expect(promptConfirm).toHaveBeenCalledWith(
        "This operation can permanently delete entities or attributes. Continue?",
      );
      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it("proceeds after confirmation in interactive mode", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptConfirm).mockResolvedValue(true);

      await runCommand(program, ["entities", "purge", "--type", "Room"]);

      expect(mockClient.delete).toHaveBeenCalledWith("/entities", { type: "Room" });
      expect(printSuccess).toHaveBeenCalledWith("Purge completed.");
    });

    it("rejects mutually exclusive keep and drop options", async () => {
      await expect(
        runCommand(program, ["entities", "purge", "--type", "Room", "--keep", "a", "--drop", "b", "--yes"]),
      ).rejects.toThrow("Cannot specify both --keep and --drop.");

      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it("refuses an under-specified purge (no type/attrs/query/georel/keep/drop/local) before any server call", async () => {
      await expect(
        runCommand(program, ["entities", "purge", "--id-pattern", ".*", "--yes"]),
      ).rejects.toThrow("specify at least one selector");

      expect(mockClient.delete).not.toHaveBeenCalled();
    });

    it("allows keep-only as a sufficient selector (#225 / geonicdb#2432)", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "purge", "--keep", "name", "--yes"]);

      expect(mockClient.delete).toHaveBeenCalledWith("/entities", { keep: "name" });
    });

    it("allows drop-only as a sufficient selector (#225)", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "purge", "--drop", "temperature", "--yes"]);

      expect(mockClient.delete).toHaveBeenCalledWith("/entities", { drop: "temperature" });
    });

    it("allows local-only as a sufficient selector (#225)", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["entities", "purge", "--local", "--yes"]);

      expect(mockClient.delete).toHaveBeenCalledWith("/entities", { local: "true" });
    });

    // #246 / geonicdb#3524: same scopeQ contract as entities list (same-file twin).
    it("documents scopeQ AND parentheses and letter-first levels in purge --scope-q help (#246)", () => {
      const purgeCmd = program.commands
        .find((c) => c.name() === "entities")!
        .commands.find((c) => c.name() === "purge")!;
      const scopeQ = purgeCmd.options.find((o) => o.long === "--scope-q");
      expect(scopeQ).toBeDefined();
      const desc = scopeQ!.description;
      expect(desc).toContain("parentheses required");
      expect(desc).toContain("(/A;/B)");
      expect(desc).toMatch(/start with a letter/i);
      expect(desc).toContain("/Madrid/1st");
      expect(desc).not.toMatch(/(?<!\()\/A;\/B(?!\))/);
      expect(desc).toMatch(/\/Madrid\/1st.*reject/i);
    });
  });
});
