import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess, printWarning, printError, printOutput } from "../src/output.js";
import { GdbClientError } from "../src/client.js";
import {
  applyModelUpdateDryRunResult,
  isModelPatchUnchanged,
  registerModelsCommand,
  rethrowModelApplyPatchError,
  stripTypeFromModelBody,
} from "../src/commands/models.js";

describe("models (custom-data-models) command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerModelsCommand);
  });

  describe("list", () => {
    it("calls rawRequest GET /custom-data-models", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([{ id: "model1" }]));
      await runCommand(program, ["custom-data-models", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", { params: {} });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });

    it("works with models alias", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["models", "list"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", { params: {} });
    });

    it("forwards --limit and --offset", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["models", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("GET", "/custom-data-models", {
        params: { limit: "10", offset: "5" },
      });
    });
  });

  describe("get", () => {
    it("calls rawRequest GET with encoded model ID", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "model1" }));
      await runCommand(program, ["custom-data-models", "get", "model1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/custom-data-models/${encodeURIComponent("model1")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("parses JSON and posts via rawRequest", async () => {
      const modelData = { name: "TestModel", schema: {} };
      vi.mocked(parseJsonInput).mockResolvedValue(modelData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ id: "model1" }, 201));

      await runCommand(program, ["custom-data-models", "create", '{"name":"TestModel"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"TestModel"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith("POST", "/custom-data-models", { body: modelData });
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Model created.");
    });
  });

  describe("create with uniqueConstraints (#136)", () => {
    it("passes uniqueConstraints through in the request body", async () => {
      const modelData = {
        type: "RoomReservation",
        domain: "building",
        description: "Room reservation",
        propertyDetails: {
          room: { ngsiType: "Property", valueType: "string", example: "R1" },
          date: { ngsiType: "Property", valueType: "string", example: "2026-07-15" },
          startTime: { ngsiType: "Property", valueType: "string", example: "10:00" },
        },
        uniqueConstraints: [{ name: "no-double-booking", fields: ["room", "date", "startTime"] }],
      };
      vi.mocked(parseJsonInput).mockResolvedValue(modelData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ type: "RoomReservation" }, 201));

      await runCommand(program, ["models", "create", JSON.stringify(modelData)]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith("POST", "/custom-data-models", { body: modelData });
      expect(printSuccess).toHaveBeenCalledWith("Model created.");
    });
  });

  describe("update", () => {
    it("parses JSON and patches via rawRequest", async () => {
      const patchData = { name: "UpdatedModel" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["custom-data-models", "update", "model1", '{"name":"UpdatedModel"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"name":"UpdatedModel"}');
      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("model1")}`,
        { body: patchData },
      );
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Model updated.");
    });
  });

  describe("update uniqueConstraints (#136)", () => {
    it("replaces the constraint list via PATCH", async () => {
      const patchData = { uniqueConstraints: [{ name: "unique-code", fields: ["code"] }] };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ type: "Slot" }, 200));

      await runCommand(program, ["models", "update", "Slot", JSON.stringify(patchData)]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("Slot")}`,
        { body: patchData },
      );
    });

    it("removes all constraints with an empty array", async () => {
      const patchData = { uniqueConstraints: [] };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ type: "Slot" }, 200));

      await runCommand(program, ["models", "update", "Slot", JSON.stringify(patchData)]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("Slot")}`,
        { body: patchData },
      );
    });
  });

  describe("update --api-dry-run (#198)", () => {
    const originalExitCode = process.exitCode;

    afterEach(() => {
      process.exitCode = originalExitCode;
    });

    const conformingReport = {
      type: "TemperatureSensor",
      dryRun: true,
      conformance: {
        scanned: 2,
        violating: 0,
        undetermined: 0,
        truncated: false,
        maxScan: 10000,
        scopeLimited: false,
        samples: [],
      },
    };

    const violatingReport = {
      type: "TemperatureSensor",
      dryRun: true,
      conformance: {
        scanned: 2,
        violating: 1,
        undetermined: 0,
        truncated: false,
        maxScan: 10000,
        scopeLimited: false,
        samples: [
          {
            entityId: "Sensor001",
            errors: ["temperature: Value (50) exceeds maximum (30)"],
          },
        ],
      },
    };

    it("sends PATCH with dryRun=true and does not print Model updated.", async () => {
      const patchData = {
        propertyDetails: {
          temperature: {
            ngsiType: "Property",
            valueType: "Number",
            validation: { maximum: 30 },
          },
        },
      };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse(conformingReport));
      process.exitCode = undefined;

      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        JSON.stringify(patchData),
        "--api-dry-run",
      ]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("TemperatureSensor")}`,
        { body: patchData, params: { dryRun: "true" } },
      );
      expect(outputResponse).toHaveBeenCalledWith(
        expect.objectContaining({ data: conformingReport }),
        "json",
      );
      expect(printSuccess).not.toHaveBeenCalled();
      expect(process.exitCode).toBeUndefined();
    });

    it("sets exitCode=1 when conformance.violating > 0", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue({ description: "strict" });
      mockClient.rawRequest.mockResolvedValue(mockResponse(violatingReport));
      process.exitCode = undefined;

      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        '{"description":"strict"}',
        "--api-dry-run",
      ]);

      expect(printSuccess).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
    });

    it("near-miss: violating=0 keeps exit success even when truncated", async () => {
      const truncatedClean = {
        type: "TemperatureSensor",
        dryRun: true,
        conformance: {
          scanned: 10000,
          violating: 0,
          undetermined: 0,
          truncated: true,
          maxScan: 10000,
          scopeLimited: false,
          samples: [],
        },
      };
      vi.mocked(parseJsonInput).mockResolvedValue({ description: "x" });
      mockClient.rawRequest.mockResolvedValue(mockResponse(truncatedClean));
      process.exitCode = undefined;

      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        '{"description":"x"}',
        "--api-dry-run",
      ]);

      expect(printWarning).toHaveBeenCalledWith(expect.stringContaining("truncated"));
      expect(process.exitCode).toBeUndefined();
      expect(printSuccess).not.toHaveBeenCalled();
    });

    it("warns when scopeLimited without failing on zero violations", async () => {
      const scoped = {
        type: "TemperatureSensor",
        dryRun: true,
        conformance: {
          scanned: 1,
          violating: 0,
          undetermined: 0,
          truncated: false,
          maxScan: 10000,
          scopeLimited: true,
          samples: [],
        },
      };
      vi.mocked(parseJsonInput).mockResolvedValue({ description: "x" });
      mockClient.rawRequest.mockResolvedValue(mockResponse(scoped));
      process.exitCode = undefined;

      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        '{"description":"x"}',
        "--api-dry-run",
      ]);

      expect(printWarning).toHaveBeenCalledWith(expect.stringContaining("scopeLimited"));
      expect(process.exitCode).toBeUndefined();
    });

    it("without --api-dry-run does not send dryRun param", async () => {
      const patchData = { description: "live" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.rawRequest.mockResolvedValue(mockResponse({ type: "TemperatureSensor" }));

      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        '{"description":"live"}',
      ]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "PATCH",
        `/custom-data-models/${encodeURIComponent("TemperatureSensor")}`,
        { body: patchData },
      );
      expect(printSuccess).toHaveBeenCalledWith("Model updated.");
    });

    it("rejects combining --api-dry-run with global --dry-run", async () => {
      process.exitCode = undefined;
      await runCommand(program, [
        "models",
        "update",
        "TemperatureSensor",
        '{"description":"x"}',
        "--api-dry-run",
        "--dry-run",
      ]);

      expect(mockClient.rawRequest).not.toHaveBeenCalled();
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("Cannot combine"));
      expect(process.exitCode).toBe(1);
    });
  });

  describe("applyModelUpdateDryRunResult (#198)", () => {
    const originalExitCode = process.exitCode;

    afterEach(() => {
      process.exitCode = originalExitCode;
      vi.mocked(printWarning).mockClear();
    });

    it("returns 1 and sets exitCode when violating > 0", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({
        dryRun: true,
        conformance: { violating: 1, truncated: false, scopeLimited: false },
      });
      expect(code).toBe(1);
      expect(process.exitCode).toBe(1);
    });

    it("near-miss: violating=0 returns 0 and does not set exitCode", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({
        dryRun: true,
        conformance: { violating: 0, truncated: false, scopeLimited: false },
      });
      expect(code).toBe(0);
      expect(process.exitCode).toBeUndefined();
    });

    it("sets exitCode=1 when uniqueConstraintViolations is non-empty even if violating=0", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({
        dryRun: true,
        conformance: {
          violating: 0,
          uniqueConstraintViolations: ["constraint 'unique-code' already violated"],
        },
      });
      expect(code).toBe(1);
      expect(process.exitCode).toBe(1);
    });

    it("near-miss: empty uniqueConstraintViolations does not fail", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({
        dryRun: true,
        conformance: { violating: 0, uniqueConstraintViolations: [] },
      });
      expect(code).toBe(0);
      expect(process.exitCode).toBeUndefined();
    });

    it("warns and fails when response is not a dry-run report", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({ type: "X", description: "applied" });
      expect(code).toBe(1);
      expect(process.exitCode).toBe(1);
      expect(printWarning).toHaveBeenCalledWith(
        expect.stringContaining("may not support ?dryRun=true"),
      );
    });

    it("warns when undetermined > 0 without failing on zero violations", () => {
      process.exitCode = undefined;
      const code = applyModelUpdateDryRunResult({
        dryRun: true,
        conformance: { violating: 0, undetermined: 3, truncated: false, scopeLimited: false },
      });
      expect(code).toBe(0);
      expect(process.exitCode).toBeUndefined();
      expect(printWarning).toHaveBeenCalledWith(
        expect.stringContaining("could not determine conformance"),
      );
    });
  });

  describe("delete", () => {
    it("deletes model via rawRequest", async () => {
      mockClient.rawRequest.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["custom-data-models", "delete", "model1"]);

      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "DELETE",
        `/custom-data-models/${encodeURIComponent("model1")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Model deleted.");
    });
  });

  describe("stripTypeFromModelBody / isModelPatchUnchanged (#238)", () => {
    it("strips type and leaves other fields", () => {
      expect(
        stripTypeFromModelBody({
          type: "Sensor",
          domain: "iot",
          description: "x",
        }),
      ).toEqual({ domain: "iot", description: "x" });
    });

    it("near-miss: unchanged when patch is a matching subset of existing", () => {
      const existing = {
        type: "Sensor",
        domain: "iot",
        description: "IoT Sensor",
        propertyDetails: { temperature: { ngsiType: "Property", valueType: "Number" } },
        version: 3,
        tenantId: "t1",
      };
      const patch = {
        domain: "iot",
        description: "IoT Sensor",
        propertyDetails: { temperature: { ngsiType: "Property", valueType: "Number" } },
      };
      expect(isModelPatchUnchanged(existing, patch)).toBe(true);
    });

    it("near-miss: not unchanged when a nested value differs by one field", () => {
      const existing = {
        propertyDetails: { temperature: { ngsiType: "Property", valueType: "Number", example: 25 } },
      };
      const patch = {
        propertyDetails: { temperature: { ngsiType: "Property", valueType: "Number", example: 26 } },
      };
      expect(isModelPatchUnchanged(existing, patch)).toBe(false);
    });
  });

  describe("rethrowModelApplyPatchError (#238)", () => {
    it("appends dry-run hint on PATCH 400", () => {
      expect(() =>
        rethrowModelApplyPatchError(new GdbClientError("entities violate model", 400), "Sensor"),
      ).toThrow(/entities violate model[\s\S]*models update Sensor --api-dry-run/);
    });

    it("near-miss: does not rewrite non-400 errors", () => {
      const err = new GdbClientError("Custom data model already exists", 409);
      expect(() => rethrowModelApplyPatchError(err, "Sensor")).toThrow(err);
    });
  });

  describe("apply (#238)", () => {
    const originalExitCode = process.exitCode;
    const modelBody = {
      type: "ApplySensor",
      domain: "iot",
      description: "Apply sensor",
      propertyDetails: {
        temperature: { ngsiType: "Property", valueType: "Number", example: 25 },
      },
    };

    afterEach(() => {
      process.exitCode = originalExitCode;
    });

    it("GETs by type then POSTs when missing → created", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockRejectedValueOnce(new GdbClientError("Not Found", 404))
        .mockResolvedValueOnce(mockResponse({ type: "ApplySensor" }, 201));

      await runCommand(program, ["models", "apply", JSON.stringify(modelBody)]);

      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(
        1,
        "GET",
        `/custom-data-models/${encodeURIComponent("ApplySensor")}`,
      );
      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(2, "POST", "/custom-data-models", {
        body: modelBody,
      });
      expect(printOutput).toHaveBeenCalledWith(
        { type: "ApplySensor", result: "created" },
        "json",
      );
    });

    it("strips type and PATCHes when present and changed → updated", async () => {
      const existing = {
        ...modelBody,
        description: "old",
        version: 1,
        id: "x",
      };
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockResolvedValueOnce(mockResponse(existing))
        .mockResolvedValueOnce(mockResponse({ type: "ApplySensor" }));

      await runCommand(program, ["models", "apply", JSON.stringify(modelBody)]);

      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(
        2,
        "PATCH",
        `/custom-data-models/${encodeURIComponent("ApplySensor")}`,
        {
          body: {
            domain: "iot",
            description: "Apply sensor",
            propertyDetails: modelBody.propertyDetails,
          },
        },
      );
      expect(printOutput).toHaveBeenCalledWith(
        { type: "ApplySensor", result: "updated" },
        "json",
      );
    });

    it("skips PATCH when fields already match → unchanged", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest.mockResolvedValueOnce(
        mockResponse({
          ...modelBody,
          version: 2,
          tenantId: "e2e_test",
          createdAt: "2026-01-01T00:00:00.000Z",
        }),
      );

      await runCommand(program, ["models", "apply", JSON.stringify(modelBody)]);

      expect(mockClient.rawRequest).toHaveBeenCalledTimes(1);
      expect(mockClient.rawRequest).toHaveBeenCalledWith(
        "GET",
        `/custom-data-models/${encodeURIComponent("ApplySensor")}`,
      );
      expect(printOutput).toHaveBeenCalledWith(
        { type: "ApplySensor", result: "unchanged" },
        "json",
      );
    });

    it("passes datamodels.jp-style body with type through create without stripping", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockRejectedValueOnce(new GdbClientError("Not Found", 404))
        .mockResolvedValueOnce(mockResponse(modelBody, 201));

      await runCommand(program, ["models", "apply", JSON.stringify(modelBody)]);

      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(2, "POST", "/custom-data-models", {
        body: modelBody,
      });
      expect(modelBody).toHaveProperty("type", "ApplySensor");
    });

    it("--api-dry-run when missing prints would create without POST", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest.mockRejectedValueOnce(new GdbClientError("Not Found", 404));

      await runCommand(program, [
        "models",
        "apply",
        JSON.stringify(modelBody),
        "--api-dry-run",
      ]);

      expect(mockClient.rawRequest).toHaveBeenCalledTimes(1);
      expect(printOutput).toHaveBeenCalledWith(
        { type: "ApplySensor", result: "would create" },
        "json",
      );
    });

    it("--api-dry-run when changed sends PATCH dryRun=true", async () => {
      const conformingReport = {
        type: "ApplySensor",
        dryRun: true,
        conformance: {
          scanned: 0,
          violating: 0,
          undetermined: 0,
          truncated: false,
          maxScan: 10000,
          scopeLimited: false,
          samples: [],
        },
      };
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockResolvedValueOnce(mockResponse({ ...modelBody, description: "old" }))
        .mockResolvedValueOnce(mockResponse(conformingReport));
      process.exitCode = undefined;

      await runCommand(program, [
        "models",
        "apply",
        JSON.stringify(modelBody),
        "--api-dry-run",
      ]);

      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(
        2,
        "PATCH",
        `/custom-data-models/${encodeURIComponent("ApplySensor")}`,
        {
          body: {
            domain: "iot",
            description: "Apply sensor",
            propertyDetails: modelBody.propertyDetails,
          },
          params: { dryRun: "true" },
        },
      );
      expect(outputResponse).toHaveBeenCalledWith(
        expect.objectContaining({ data: conformingReport }),
        "json",
      );
      expect(process.exitCode).toBeUndefined();
    });

    it("retries PATCH once when POST races with 409", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockRejectedValueOnce(new GdbClientError("Not Found", 404))
        .mockRejectedValueOnce(new GdbClientError("Custom data model already exists", 409))
        .mockResolvedValueOnce(mockResponse({ type: "ApplySensor" }));

      await runCommand(program, ["models", "apply", JSON.stringify(modelBody)]);

      expect(mockClient.rawRequest).toHaveBeenNthCalledWith(
        3,
        "PATCH",
        `/custom-data-models/${encodeURIComponent("ApplySensor")}`,
        {
          body: {
            domain: "iot",
            description: "Apply sensor",
            propertyDetails: modelBody.propertyDetails,
          },
        },
      );
      expect(printOutput).toHaveBeenCalledWith(
        { type: "ApplySensor", result: "updated" },
        "json",
      );
    });

    it("near-miss: POST 400 already-exists wording is not treated as success", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockRejectedValueOnce(new GdbClientError("Not Found", 404))
        .mockRejectedValueOnce(new GdbClientError("Custom data model already exists", 400));

      await expect(
        runCommand(program, ["models", "apply", JSON.stringify(modelBody)]),
      ).rejects.toThrow(/Custom data model already exists/);
      expect(mockClient.rawRequest).toHaveBeenCalledTimes(2);
      expect(printOutput).not.toHaveBeenCalled();
    });

    it("near-miss: GET non-404 errors are not treated as missing", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest.mockRejectedValueOnce(new GdbClientError("forbidden", 403));

      await expect(
        runCommand(program, ["models", "apply", JSON.stringify(modelBody)]),
      ).rejects.toThrow(/forbidden/);
      expect(mockClient.rawRequest).toHaveBeenCalledTimes(1);
      expect(printOutput).not.toHaveBeenCalled();
    });

    it("rejects body without type", async () => {
      process.exitCode = undefined;
      vi.mocked(parseJsonInput).mockResolvedValue({ domain: "iot" });

      await runCommand(program, ["models", "apply", '{"domain":"iot"}']);

      expect(mockClient.rawRequest).not.toHaveBeenCalled();
      expect(printError).toHaveBeenCalledWith(expect.stringContaining('"type"'));
      expect(process.exitCode).toBe(1);
    });

    it("rejects combining --api-dry-run with global --dry-run", async () => {
      process.exitCode = undefined;
      await runCommand(program, [
        "models",
        "apply",
        JSON.stringify(modelBody),
        "--api-dry-run",
        "--dry-run",
      ]);

      expect(mockClient.rawRequest).not.toHaveBeenCalled();
      expect(printError).toHaveBeenCalledWith(expect.stringContaining("Cannot combine"));
      expect(process.exitCode).toBe(1);
    });

    it("on PATCH 400 appends api-dry-run hint", async () => {
      vi.mocked(parseJsonInput).mockResolvedValue(modelBody);
      mockClient.rawRequest
        .mockResolvedValueOnce(mockResponse({ ...modelBody, description: "old" }))
        .mockRejectedValueOnce(new GdbClientError("existing entities violate constraints", 400));

      await expect(
        runCommand(program, ["models", "apply", JSON.stringify(modelBody)]),
      ).rejects.toThrow(/existing entities violate constraints[\s\S]*--api-dry-run/);
    });
  });
});
