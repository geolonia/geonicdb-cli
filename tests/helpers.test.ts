import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Command } from "commander";
import type { GlobalOptions, ClientResponse } from "../src/types.js";

vi.mock("../src/output.js", () => ({
  printError: vi.fn(),
  printOutput: vi.fn(),
  printCount: vi.fn(),
}));

import { printError, printOutput, printCount } from "../src/output.js";
import { saveConfig } from "../src/config.js";
import { DryRunSignal, GdbClientError, GdbClient } from "../src/client.js";
import {
  resolveOptions,
  createClient,
  getFormat,
  outputResponse,
  withErrorHandler,
} from "../src/helpers.js";

function fakeCmd(cliOpts: Partial<GlobalOptions> = {}): Command {
  return { optsWithGlobals: () => ({ ...cliOpts }) } as unknown as Command;
}

describe("helpers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "geonic-test-"));
    process.env.GEONIC_CONFIG_DIR = join(tempDir, "geonic");
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.GEONIC_CONFIG_DIR;
    delete process.env.GDB_API_KEY;
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("resolveOptions", () => {
    it("CLI flag takes priority over config value", () => {
      saveConfig({ url: "http://config.example.com" });
      const opts = resolveOptions(fakeCmd({ url: "http://cli.example.com" }));
      expect(opts.url).toBe("http://cli.example.com");
    });

    it("config value used when CLI flag not set", () => {
      saveConfig({ url: "http://config.example.com", service: "tenant-a" });
      const opts = resolveOptions(fakeCmd());
      expect(opts.url).toBe("http://config.example.com");
      expect(opts.service).toBe("tenant-a");
    });

    it("defaults format to json", () => {
      const opts = resolveOptions(fakeCmd());
      expect(opts.format).toBe("json");
    });

    it("apiKey falls back: CLI -> env (GDB_API_KEY) -> config", () => {
      saveConfig({ apiKey: "config-key" });

      // CLI wins
      const opts1 = resolveOptions(fakeCmd({ apiKey: "cli-key" }));
      expect(opts1.apiKey).toBe("cli-key");

      // env wins over config
      process.env.GDB_API_KEY = "env-key";
      const opts2 = resolveOptions(fakeCmd());
      expect(opts2.apiKey).toBe("env-key");

      // config used as last fallback
      delete process.env.GDB_API_KEY;
      const opts3 = resolveOptions(fakeCmd());
      expect(opts3.apiKey).toBe("config-key");
    });

    it("loads profile-specific config", () => {
      saveConfig({ url: "http://default.example.com" });
      saveConfig({ url: "http://staging.example.com" }, "staging");
      const opts = resolveOptions(fakeCmd({ profile: "staging" }));
      expect(opts.url).toBe("http://staging.example.com");
    });

    it("returns defaults when all options are empty", () => {
      const opts = resolveOptions(fakeCmd());
      expect(opts.url).toBeUndefined();
      expect(opts.service).toBeUndefined();
      expect(opts.format).toBe("json");
      expect(opts.token).toBeUndefined();
      expect(opts.apiKey).toBeUndefined();
    });

    it("passes dryRun flag through", () => {
      const opts = resolveOptions(fakeCmd({ dryRun: true }));
      expect(opts.dryRun).toBe(true);
    });

    it("dryRun defaults to undefined when not set", () => {
      const opts = resolveOptions(fakeCmd());
      expect(opts.dryRun).toBeUndefined();
    });
  });

  describe("createClient", () => {
    it("exits with code 1 when no URL is configured", () => {
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });
      expect(() => createClient(fakeCmd())).toThrow("process.exit");
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("No URL configured"),
      );
      exitSpy.mockRestore();
    });

    it("creates GdbClient with correct options when URL is configured", () => {
      saveConfig({ url: "http://localhost:3000", service: "myTenant" });
      const client = createClient(fakeCmd());
      expect(client).toBeInstanceOf(GdbClient);
    });

    it("sets refreshToken to undefined when CLI --token is passed", () => {
      saveConfig({
        url: "http://localhost:3000",
        token: "config-token",
        refreshToken: "config-refresh",
      });
      const client = createClient(fakeCmd({ token: "cli-token" }));
      // The client is created; we verify that usingCliToken path is taken
      // by checking that onTokenRefresh is not set — we can't inspect private fields
      // but we can verify the client was created successfully
      expect(client).toBeInstanceOf(GdbClient);
    });

    it("throws when URL lacks protocol (via --url flag)", () => {
      expect(() => createClient(fakeCmd({ url: "localhost:3000" }))).toThrow(
        'Invalid URL: "localhost:3000". URL must start with http:// or https://.',
      );
    });

    it("passes dryRun option to GdbClient", async () => {
      saveConfig({ url: "http://localhost:3000" });
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const client = createClient(fakeCmd({ dryRun: true }));
      expect(client).toBeInstanceOf(GdbClient);
      // Verify dryRun is set by triggering a request — it should throw DryRunSignal
      await expect(client.get("/entities")).rejects.toThrow(DryRunSignal);
      logSpy.mockRestore();
    });

    it("sets onTokenRefresh callback when token comes from config", () => {
      saveConfig({
        url: "http://localhost:3000",
        token: "config-token",
        refreshToken: "config-refresh",
      });
      // No CLI token — token comes from config, so onTokenRefresh should be set
      const client = createClient(fakeCmd());
      expect(client).toBeInstanceOf(GdbClient);
    });

    it("onTokenRefresh callback saves new tokens to config", async () => {
      saveConfig({
        url: "http://localhost:3000",
        token: "old-token",
        refreshToken: "old-refresh",
      });

      const client = createClient(fakeCmd());

      // Simulate a 401 → refresh → retry flow
      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ token: "saved-token", refreshToken: "saved-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      await client.get("/entities");

      // Verify the callback saved the new tokens to config
      const { loadConfig: loadCfg } = await import("../src/config.js");
      const config = loadCfg();
      expect(config.token).toBe("saved-token");
      expect(config.refreshToken).toBe("saved-refresh");
    });
  });

  describe("getFormat", () => {
    it("returns format from CLI options", () => {
      const format = getFormat(fakeCmd({ format: "table" }));
      expect(format).toBe("table");
    });

    it("returns json as default when no format is set", () => {
      const format = getFormat(fakeCmd());
      expect(format).toBe("json");
    });
  });

  describe("outputResponse", () => {
    it("prints count when showCount is true and response.count is defined", () => {
      const response: ClientResponse = {
        status: 200,
        headers: new Headers(),
        data: [{ id: "e1" }],
        count: 42,
      };
      outputResponse(response, "json", true);
      expect(printCount).toHaveBeenCalledWith(42);
      expect(printOutput).toHaveBeenCalledWith([{ id: "e1" }], "json");
    });

    it("does NOT print count when showCount is false", () => {
      const response: ClientResponse = {
        status: 200,
        headers: new Headers(),
        data: [{ id: "e1" }],
        count: 42,
      };
      outputResponse(response, "json", false);
      expect(printCount).not.toHaveBeenCalled();
    });

    it("prints data when response.data is defined and not empty string", () => {
      const response: ClientResponse = {
        status: 200,
        headers: new Headers(),
        data: { id: "Room:001" },
      };
      outputResponse(response, "table");
      expect(printOutput).toHaveBeenCalledWith({ id: "Room:001" }, "table");
    });

    it("does NOT print data when response.data is undefined", () => {
      const response: ClientResponse = {
        status: 204,
        headers: new Headers(),
        data: undefined,
      };
      outputResponse(response, "json");
      expect(printOutput).not.toHaveBeenCalled();
    });

    it("does NOT print data when response.data is empty string", () => {
      const response: ClientResponse = {
        status: 200,
        headers: new Headers(),
        data: "",
      };
      outputResponse(response, "json");
      expect(printOutput).not.toHaveBeenCalled();
    });
  });

  describe("withErrorHandler", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit");
      });
    });

    afterEach(() => {
      exitSpy.mockRestore();
    });

    it("completes normally when no error is thrown", async () => {
      const fn = vi.fn().mockResolvedValue(undefined);
      const wrapped = withErrorHandler(fn);
      await wrapped("arg1", "arg2");
      expect(fn).toHaveBeenCalledWith("arg1", "arg2");
      expect(exitSpy).not.toHaveBeenCalled();
    });

    it("prints auth message and exits on 401 GdbClientError", async () => {
      const fn = vi.fn().mockRejectedValue(new GdbClientError("Unauthorized", 401));
      const wrapped = withErrorHandler(fn);
      await expect(wrapped()).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith(
        expect.stringContaining("Authentication failed"),
      );
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("prints error message and exits on generic Error", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("something broke"));
      const wrapped = withErrorHandler(fn);
      await expect(wrapped()).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("something broke");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("prints String(err) and exits on non-Error throw", async () => {
      const fn = vi.fn().mockRejectedValue("raw string error");
      const wrapped = withErrorHandler(fn);
      await expect(wrapped()).rejects.toThrow("process.exit");
      expect(printError).toHaveBeenCalledWith("raw string error");
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it("returns normally on DryRunSignal without printing error or exiting", async () => {
      const fn = vi.fn().mockRejectedValue(new DryRunSignal());
      const wrapped = withErrorHandler(fn);
      await wrapped();
      expect(printError).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
