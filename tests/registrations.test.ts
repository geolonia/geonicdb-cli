import { describe, it, expect, vi, beforeEach } from "vitest";
import "./setup-command-mocks.js";
import { createMockClient, mockResponse, createTestProgram, runCommand } from "./test-helpers.js";
import type { MockClient } from "./test-helpers.js";

import { createClient, getFormat, outputResponse } from "../src/helpers.js";
import { parseJsonInput } from "../src/input.js";
import { printSuccess } from "../src/output.js";
import { registerRegistrationsCommand } from "../src/commands/registrations.js";

describe("registrations command", () => {
  let mockClient: MockClient;
  let program: ReturnType<typeof createTestProgram>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    vi.mocked(createClient).mockReturnValue(mockClient as never);
    vi.mocked(getFormat).mockReturnValue("json");
    program = createTestProgram(registerRegistrationsCommand);
  });

  describe("list", () => {
    it("calls client.get with no params when no options given", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["registrations", "list"]);

      expect(mockClient.get).toHaveBeenCalledWith("/csourceRegistrations", {});
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", false);
    });

    it("passes limit and offset params", async () => {
      mockClient.get.mockResolvedValue(mockResponse([]));
      await runCommand(program, ["registrations", "list", "--limit", "10", "--offset", "5"]);

      expect(mockClient.get).toHaveBeenCalledWith("/csourceRegistrations", {
        limit: "10",
        offset: "5",
      });
    });

    it("passes count param and sets showCount to true", async () => {
      mockClient.get.mockResolvedValue(mockResponse([], 200, 3));
      await runCommand(program, ["registrations", "list", "--count"]);

      expect(mockClient.get).toHaveBeenCalledWith("/csourceRegistrations", { count: "true" });
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json", true);
    });
  });

  describe("get", () => {
    it("calls client.get with encoded registration ID", async () => {
      mockClient.get.mockResolvedValue(mockResponse({ id: "reg1" }));
      await runCommand(program, ["registrations", "get", "urn:ngsi-ld:Reg:001"]);

      expect(mockClient.get).toHaveBeenCalledWith(
        `/csourceRegistrations/${encodeURIComponent("urn:ngsi-ld:Reg:001")}`,
      );
      expect(outputResponse).toHaveBeenCalledWith(expect.anything(), "json");
    });
  });

  describe("create", () => {
    it("parses JSON input and posts to /csourceRegistrations", async () => {
      const regData = { type: "ContextSourceRegistration" };
      vi.mocked(parseJsonInput).mockResolvedValue(regData);
      mockClient.post.mockResolvedValue(mockResponse({ id: "reg1" }, 201));

      await runCommand(program, ["registrations", "create", '{"type":"ContextSourceRegistration"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"type":"ContextSourceRegistration"}');
      expect(mockClient.post).toHaveBeenCalledWith("/csourceRegistrations", regData);
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Registration created.");
    });
  });

  describe("update", () => {
    it("parses JSON input and patches registration", async () => {
      const patchData = { description: "updated" };
      vi.mocked(parseJsonInput).mockResolvedValue(patchData);
      mockClient.patch.mockResolvedValue(mockResponse(undefined, 204));

      await runCommand(program, ["registrations", "update", "reg1", '{"description":"updated"}']);

      expect(parseJsonInput).toHaveBeenCalledWith('{"description":"updated"}');
      expect(mockClient.patch).toHaveBeenCalledWith(
        `/csourceRegistrations/${encodeURIComponent("reg1")}`,
        patchData,
      );
      expect(outputResponse).toHaveBeenCalled();
      expect(printSuccess).toHaveBeenCalledWith("Registration updated.");
    });
  });

  describe("delete", () => {
    it("deletes registration by ID", async () => {
      mockClient.delete.mockResolvedValue(mockResponse(undefined, 204));
      await runCommand(program, ["registrations", "delete", "urn:ngsi-ld:Reg:001"]);

      expect(mockClient.delete).toHaveBeenCalledWith(
        `/csourceRegistrations/${encodeURIComponent("urn:ngsi-ld:Reg:001")}`,
      );
      expect(printSuccess).toHaveBeenCalledWith("Registration deleted.");
    });
  });
});
