import { describe, it, expect, vi, beforeEach } from "vitest";
import { DryRunSignal, GdbClient, GdbClientError } from "../src/client.js";

function createJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.fake-signature`;
}

describe("GdbClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs correct NGSI-LD headers", async () => {
    const client = new GdbClient({
      baseUrl: "http://localhost:3000",
      service: "myTenant",
      token: "test-token",
    });

    const mockResponse = new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/ld+json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await client.get("/entities");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/ngsi-ld/v1/entities"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "NGSILD-Tenant": "myTenant",
          "Content-Type": "application/ld+json",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("parses JSON response", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    const data = [{ id: "Room:001", type: "Room" }];

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(data), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await client.get("/entities");
    expect(result.status).toBe(200);
    expect(result.data).toEqual(data);
  });

  it("parses NGSILD-Results-Count header", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json",
          "NGSILD-Results-Count": "42",
        },
      }),
    );

    const result = await client.get("/entities");
    expect(result.count).toBe(42);
  });

  it("throws GdbClientError on HTTP error", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    const errorBody = { error: "NotFound", description: "Entity not found" };

    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      return new Response(JSON.stringify(errorBody), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    });

    await expect(client.get("/entities/missing")).rejects.toThrow(GdbClientError);
    await expect(client.get("/entities/missing")).rejects.toThrow("Entity not found");
  });

  it("sends POST with JSON body", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });
    const entity = { id: "Room:001", type: "Room" };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.post("/entities", entity);

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(entity),
      }),
    );
  });

  it("appends query params to URL", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await client.get("/entities", { type: "Room", limit: "10" });

    const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(calledUrl).toContain("type=Room");
    expect(calledUrl).toContain("limit=10");
  });

  describe("API key authentication", () => {
    it("uses apiKey when no token is set", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        apiKey: "sk-test-key",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Api-Key": "sk-test-key",
          }),
        }),
      );
    });

    it("prefers token over apiKey", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "jwt-token",
        apiKey: "sk-test-key",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer jwt-token",
          }),
        }),
      );

      const callHeaders = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty("X-Api-Key");
    });
  });

  describe("token refresh", () => {
    it("refreshes token on 401 and retries", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ token: "new-token", refreshToken: "new-refresh" }),
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
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(onRefresh).toHaveBeenCalledWith("new-token", "new-refresh");
    });

    it("throws 401 when refresh fails", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "invalid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      });

      await expect(client.get("/entities")).rejects.toThrow(GdbClientError);
    });

    it("does not refresh when using apiKey only (no token)", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        apiKey: "sk-test",
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow(GdbClientError);
      expect(onRefresh).not.toHaveBeenCalled();
    });

    it("refreshes token on 401 when both token and apiKey are set", async () => {
      // Root cause scenario: user has both token (from auth login) and apiKey in config.
      // buildHeaders uses token (Bearer), but canRefresh() must not block refresh due to apiKey.
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        apiKey: "sk-test",
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: "new-token", refreshToken: "new-refresh" }),
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
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(onRefresh).toHaveBeenCalledWith("new-token", "new-refresh");
    });

    it("refreshes token on 401 for rawRequest", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(JSON.stringify({ token: "new-token" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ email: "user@test.com" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.rawRequest("GET", "/me");
      expect(result.data).toEqual({ email: "user@test.com" });
      expect(onRefresh).toHaveBeenCalledWith("new-token", undefined);
    });
  });

  describe("verbose logging", () => {
    it("logs request and response to stderr", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        service: "tenant",
        token: "test-token",
        verbose: true,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities");

      const output = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
      expect(output).toContain("> GET");
      expect(output).toContain("/ngsi-ld/v1/entities");
      expect(output).toContain("< 200");
      stderrSpy.mockRestore();
    });

    it("masks Authorization header in verbose output", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "secret-token",
        verbose: true,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities");

      const output = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
      expect(output).toContain("Authorization: ***");
      expect(output).not.toContain("secret-token");
      stderrSpy.mockRestore();
    });

    it("masks sensitive fields in request body", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        verbose: true,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.post("/entities", {
        password: "secret123",
        refreshToken: "refresh-secret",
        token: "token-secret",
        client_secret: "client-secret",
        clientSecret: "client-secret2",
        username: "visible",
      });

      const output = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
      expect(output).toContain('"password":"***"');
      expect(output).toContain('"refreshToken":"***"');
      expect(output).toContain('"token":"***"');
      expect(output).toContain('"client_secret":"***"');
      expect(output).toContain('"clientSecret":"***"');
      expect(output).toContain('"username":"visible"');
      stderrSpy.mockRestore();
    });

    it("returns raw string when body is not valid JSON (maskBodySecrets catch)", () => {
      // Test maskBodySecrets directly since JSON.stringify always produces valid JSON
      const result = (GdbClient as unknown as { maskBodySecrets(raw: string): string }).maskBodySecrets("not valid json {{{");
      expect(result).toBe("not valid json {{{");
    });

    it("does not log when verbose is false", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        verbose: false,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities");
      expect(stderrSpy).not.toHaveBeenCalled();
      stderrSpy.mockRestore();
    });
  });

  describe("non-JSON responses", () => {
    it("returns text as data for non-JSON content type", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("plain text response", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      const result = await client.get("/entities");
      expect(result.data).toBe("plain text response");
    });

    it("handles empty response body", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", {
          status: 200,
          headers: {},
        }),
      );

      const result = await client.get("/entities");
      expect(result.data).toBe("");
    });
  });

  describe("error message extraction", () => {
    it("uses detail field when description is not present", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ detail: "Detailed error info" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow("Detailed error info");
    });

    it("uses title field when description and detail are not present", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ title: "Title error" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow("Title error");
    });

    it("uses error field", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Error field value" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow("Error field value");
    });

    it("falls back to HTTP status when no recognized error fields", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ unknown: "field" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow("HTTP 502");
    });

    it("handles non-JSON error response", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Gateway Timeout", {
          status: 504,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      await expect(client.get("/entities")).rejects.toThrow("HTTP 504");
    });
  });

  describe("rawRequest error propagation", () => {
    it("throws non-401 errors without attempting refresh", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "token",
        refreshToken: "refresh",
        onTokenRefresh: onRefresh,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ description: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.rawRequest("GET", "/me")).rejects.toThrow("Forbidden");
      expect(onRefresh).not.toHaveBeenCalled();
    });
  });

  describe("PATCH and PUT methods", () => {
    it("sends PATCH request", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.patch("/entities/urn:test", { temperature: { value: 25 } });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("sends PUT request", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.put("/entities/urn:test", { temperature: { value: 25 } });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("sends DELETE request", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", {
          status: 200,
          headers: {},
        }),
      );

      await client.delete("/entities/urn:test");

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  describe("extra headers", () => {
    it("passes extra headers to request", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.get("/entities", undefined, { "X-Custom": "value" });

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Custom": "value",
          }),
        }),
      );
    });
  });

  describe("rawRequest error fields for executeRawRequest", () => {
    it("uses detail field in raw request errors", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ detail: "Raw detail error" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.rawRequest("GET", "/raw-path")).rejects.toThrow("Raw detail error");
    });

    it("falls back to HTTP status for raw request with no error fields", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.rawRequest("GET", "/raw-path")).rejects.toThrow("HTTP 500");
    });

    it("handles non-JSON error in raw request", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("error text", {
          status: 502,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      await expect(client.rawRequest("GET", "/raw-path")).rejects.toThrow("HTTP 502");
    });
  });

  describe("verbose logging for rawRequest", () => {
    it("logs request and response for rawRequest", async () => {
      const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        verbose: true,
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          statusText: "OK",
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.rawRequest("GET", "/me");

      const output = stderrSpy.mock.calls.map((c) => String(c[0])).join("");
      expect(output).toContain("> GET");
      expect(output).toContain("/me");
      expect(output).toContain("< 200");
      stderrSpy.mockRestore();
    });
  });

  describe("doRefresh returns no token", () => {
    it("returns false when refresh response lacks accessToken and token", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          // Return 200 OK but no token fields
          return new Response(JSON.stringify({ message: "ok but no token" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      });

      await expect(client.get("/entities")).rejects.toThrow("Unauthorized");
    });
  });

  describe("rawRequest with params and headers", () => {
    it("appends params and extra headers to rawRequest", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.rawRequest("GET", "/api/resource", {
        params: { key: "val" },
        headers: { "X-Custom": "test" },
      });

      const calledUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
      expect(calledUrl).toContain("key=val");
      const calledOpts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledOpts.headers["X-Custom"]).toBe("test");
    });

    it("handles rawRequest with null content-type", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("plain text", {
          status: 200,
          headers: {},
        }),
      );

      const result = await client.rawRequest("GET", "/raw");
      expect(result.data).toBe("plain text");
    });

    it("handles rawRequest with empty body", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await client.rawRequest("DELETE", "/resource/1");
      expect(result.data).toBe("");
    });

    it("handles rawRequest with ld+json content type", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id: "test" }), {
          status: 200,
          headers: { "Content-Type": "application/ld+json" },
        }),
      );

      const result = await client.rawRequest("GET", "/resource");
      expect(result.data).toEqual({ id: "test" });
    });

    it("handles rawRequest with body but no params", async () => {
      const client = new GdbClient({ baseUrl: "http://localhost:3000" });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.rawRequest("POST", "/resource", { body: { key: "value" } });

      const calledOpts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledOpts.body).toBe(JSON.stringify({ key: "value" }));
    });

    it("removes NGSILD-Tenant header when skipTenantHeader is true", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        service: "my_tenant",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.rawRequest("POST", "/auth/login", {
        body: { email: "test@test.com", password: "pass" },
        skipTenantHeader: true,
      });

      const calledOpts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledOpts.headers).not.toHaveProperty("NGSILD-Tenant");
    });

    it("keeps NGSILD-Tenant header when skipTenantHeader is not set", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        service: "my_tenant",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.rawRequest("POST", "/auth/login", {
        body: { email: "test@test.com", password: "pass" },
      });

      const calledOpts = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(calledOpts.headers["NGSILD-Tenant"]).toBe("my_tenant");
    });
  });

  describe("doRefresh network error", () => {
    it("returns false when fetch throws during refresh", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          throw new Error("Network error");
        }
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      });

      await expect(client.get("/entities")).rejects.toThrow("Unauthorized");
    });
  });

  describe("dry-run mode", () => {
    it("outputs curl command for GET request without calling fetch", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        service: "myTenant",
        token: "test-token",
        dryRun: true,
      });

      await expect(client.get("/entities", { type: "Room" })).rejects.toThrow(DryRunSignal);

      expect(fetchSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("curl");
      expect(output).toContain("'http://localhost:3000/ngsi-ld/v1/entities?type=Room'");
      expect(output).toContain("-H 'Authorization: Bearer test-token'");
      expect(output).toContain("-H 'NGSILD-Tenant: myTenant'");
      expect(output).not.toContain("-X");
      logSpy.mockRestore();
    });

    it("outputs curl command for POST request with body", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        dryRun: true,
      });
      const entity = { id: "urn:test", type: "Test" };

      await expect(client.post("/entities", entity)).rejects.toThrow(DryRunSignal);

      expect(fetchSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("-X POST");
      expect(output).toContain(`-d '${JSON.stringify(entity)}'`);
      logSpy.mockRestore();
    });

    it("outputs curl command for DELETE request", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        dryRun: true,
      });

      await expect(client.delete("/entities/urn:test")).rejects.toThrow(DryRunSignal);

      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("-X DELETE");
      expect(output).toContain("/ngsi-ld/v1/entities/urn:test");
      logSpy.mockRestore();
    });

    it("outputs curl command for rawRequest in dry-run mode", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        dryRun: true,
      });

      await expect(client.rawRequest("GET", "/me")).rejects.toThrow(DryRunSignal);

      expect(fetchSpy).not.toHaveBeenCalled();
      const output = logSpy.mock.calls[0][0] as string;
      expect(output).toContain("curl");
      expect(output).toContain("/me");
      logSpy.mockRestore();
    });
  });

  describe("buildCurlCommand", () => {
    it("builds GET command without -X flag", () => {
      const result = GdbClient.buildCurlCommand(
        "GET",
        "http://localhost:3000/ngsi-ld/v1/entities",
        { "Content-Type": "application/ld+json", Accept: "application/ld+json" },
      );
      expect(result).toContain("curl");
      expect(result).not.toContain("-X");
      expect(result).toContain("-H 'Content-Type: application/ld+json'");
      expect(result).toContain("'http://localhost:3000/ngsi-ld/v1/entities'");
    });

    it("builds POST command with -X flag and body", () => {
      const body = JSON.stringify({ id: "urn:test", type: "Test" });
      const result = GdbClient.buildCurlCommand(
        "POST",
        "http://localhost:3000/ngsi-ld/v1/entities",
        { "Content-Type": "application/ld+json" },
        body,
      );
      expect(result).toContain("-X POST");
      expect(result).toContain(`-d '${body}'`);
    });

    it("formats with line continuation backslashes", () => {
      const result = GdbClient.buildCurlCommand(
        "GET",
        "http://localhost:3000/ngsi-ld/v1/entities",
        { Accept: "application/ld+json" },
      );
      expect(result).toContain(" \\\n  ");
    });

    it("escapes single quotes in header values and body", () => {
      const body = JSON.stringify({ name: "O'Reilly" });
      const result = GdbClient.buildCurlCommand(
        "POST",
        "http://localhost:3000/ngsi-ld/v1/entities",
        { "X-Custom": "it's a test" },
        body,
      );
      // Single quotes escaped via '"'"' POSIX pattern
      expect(result).toContain(`-H 'X-Custom: it'"'"'s a test'`);
      expect(result).toContain(`-d '{"name":"O'"'"'Reilly"}'`);
    });
  });

  describe("onBeforeRefresh", () => {
    it("uses token from config when another process already refreshed", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "old-refresh",
        onTokenRefresh: onRefresh,
        onBeforeRefresh: () => ({
          token: "fresh-token-from-config",
          refreshToken: "fresh-refresh-from-config",
        }),
      });

      let callCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      // Should NOT have called /auth/refresh — used config token directly
      expect(onRefresh).not.toHaveBeenCalled();
      // Only 2 calls: original 401 + retry with fresh token
      expect(callCount).toBe(2);
    });

    it("uses latest refreshToken from config when token is the same", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "stale-refresh",
        onTokenRefresh: onRefresh,
        onBeforeRefresh: () => ({
          token: "expired-token",
          refreshToken: "latest-refresh-from-config",
        }),
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: "new-token", refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      });

      // Will fail because retry also returns 401, but we can verify the refresh used latest token
      await expect(client.get("/entities")).rejects.toThrow(GdbClientError);
      expect(onRefresh).toHaveBeenCalledWith("new-token", "new-refresh");
      // Verify /auth/refresh was called with the latest refreshToken
      const refreshCall = vi.mocked(fetch).mock.calls.find(
        (call) => (typeof call[0] === "string" ? call[0] : call[0].toString()).includes("/auth/refresh"),
      );
      expect(refreshCall).toBeDefined();
      const body = JSON.parse(refreshCall![1]!.body as string);
      expect(body.refreshToken).toBe("latest-refresh-from-config");
    });
  });

  describe("concurrent refresh deduplication", () => {
    it("reuses the same refresh promise for concurrent 401 retries", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "expired-token",
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      let refreshCallCount = 0;
      let entityCallCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          refreshCallCount++;
          // Add microtask delay so second request can enter performTokenRefresh
          await new Promise((r) => setTimeout(r, 10));
          return new Response(
            JSON.stringify({ token: "new-token", refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        entityCallCount++;
        // First TWO calls return 401 (both concurrent requests fail)
        if (entityCallCount <= 2) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        // After refresh, retries succeed
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      // Fire both requests concurrently — both will get 401 and try to refresh
      const [r1, r2] = await Promise.all([
        client.get("/entities/1"),
        client.get("/entities/2"),
      ]);

      expect(r1.data).toEqual([{ id: "Room:001" }]);
      expect(r2.data).toEqual([{ id: "Room:001" }]);
      // Refresh should only be called once (deduplication via refreshPromise)
      expect(refreshCallCount).toBe(1);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("proactive token refresh", () => {
    it("refreshes expired JWT before request and sends new token in Authorization header", async () => {
      // Simulate: user logged in 2 hours ago, accessToken (1h) expired, refreshToken (7d) valid
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 3600 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      const fetchCalls: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push(urlStr);
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        // Verify the API request uses the NEW token
        const authHeader = (init as RequestInit).headers as Record<string, string>;
        expect(authHeader["Authorization"]).toBe(`Bearer ${freshToken}`);
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(onRefresh).toHaveBeenCalledWith(freshToken, "new-refresh");
      // Verify order: refresh FIRST, then API call
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0]).toContain("/auth/refresh");
      expect(fetchCalls[1]).toContain("/ngsi-ld/v1/entities");
    });

    it("avoids 401/403 round-trip when server rejects expired JWT with non-standard error", async () => {
      // This is the key scenario: server returns 403 with a message that isTokenError() does NOT match
      // Without proactive refresh, the reactive path would NOT trigger refresh for this error
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 3600 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      const fetchCalls: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push(urlStr);
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      // With proactive refresh, the server never sees the expired token
      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      // Only 2 calls: refresh + API (no failed 401/403 request)
      expect(fetchCalls).toHaveLength(2);
      expect(fetchCalls[0]).toContain("/auth/refresh");
    });

    it("without proactive refresh, 403 with unexpected message would fail (regression proof)", async () => {
      // Prove: if proactive refresh did NOT exist, a 403 with "Token expired" would not trigger
      // reactive refresh because isTokenError only matches "not assigned to any tenant" / "invalid token"
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "non-jwt-expired-token", // Not a JWT, so proactive refresh won't fire
        refreshToken: "valid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "Forbidden", description: "Token expired" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );

      // This FAILS because isTokenError() doesn't match "Token expired"
      // → refresh is never attempted → user gets an error
      const err = await client.get("/entities").catch((e) => e);
      expect(err).toBeInstanceOf(GdbClientError);
      expect(err.status).toBe(403);
      // Confirm refresh was NOT called (only 1 fetch = the failed API request)
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("with proactive refresh, expired JWT avoids 403 entirely", async () => {
      // Same scenario as above but with a proper JWT — proactive refresh kicks in
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 3600 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: vi.fn(),
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      // Succeeds because proactive refresh runs before the server ever sees the expired token
      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
    });

    it("refreshes token proactively when JWT is expiring within 5 minutes", async () => {
      const soonToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 120 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: soonToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      const fetchCalls: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push(urlStr);
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(onRefresh).toHaveBeenCalledWith(freshToken, "new-refresh");
      expect(fetchCalls[0]).toContain("/auth/refresh");
    });

    it("does not proactively refresh when token has plenty of time remaining", async () => {
      const validToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: validToken,
        refreshToken: "valid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      // Only 1 fetch call — no refresh
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("proactive refresh works for rawRequest and sends new token", async () => {
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 3600 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      const fetchCalls: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        fetchCalls.push(urlStr);
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        const authHeader = (init as RequestInit).headers as Record<string, string>;
        expect(authHeader["Authorization"]).toBe(`Bearer ${freshToken}`);
        return new Response(JSON.stringify({ email: "user@test.com" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.rawRequest("GET", "/me");
      expect(result.data).toEqual({ email: "user@test.com" });
      expect(fetchCalls[0]).toContain("/auth/refresh");
      expect(fetchCalls[1]).toContain("/me");
    });

    it("falls back to reactive refresh when proactive refresh fails", async () => {
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 60 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: onRefresh,
      });

      let refreshCallCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          refreshCallCount++;
          if (refreshCallCount === 1) {
            // Proactive refresh fails (e.g., network glitch)
            return new Response("", { status: 500 });
          }
          // Reactive refresh succeeds
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (refreshCallCount < 2) {
          // API request with expired token → 401
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(refreshCallCount).toBe(2);
    });

    it("skips proactive refresh when token has no exp claim", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: "opaque-token-without-exp",
        refreshToken: "valid-refresh",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify([{ id: "Room:001" }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await client.get("/entities");
      expect(result.data).toEqual([{ id: "Room:001" }]);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("saves refreshed tokens to config via onTokenRefresh callback", async () => {
      const expiredToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) - 3600 });
      const freshToken = createJwt({ sub: "user", exp: Math.floor(Date.now() / 1000) + 3600 });
      const savedTokens: { token: string; refreshToken?: string }[] = [];
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        token: expiredToken,
        refreshToken: "valid-refresh",
        onTokenRefresh: (token, refreshToken) => {
          savedTokens.push({ token, refreshToken });
        },
      });

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : url.toString();
        if (urlStr.includes("/auth/refresh")) {
          return new Response(
            JSON.stringify({ accessToken: freshToken, refreshToken: "rotated-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });

      await client.get("/entities");
      expect(savedTokens).toEqual([{ token: freshToken, refreshToken: "rotated-refresh" }]);
    });
  });
});
