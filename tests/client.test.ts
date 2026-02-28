import { describe, it, expect, vi, beforeEach } from "vitest";
import { GdbClient, GdbClientError } from "../src/client.js";

describe("GdbClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs correct v2 headers", async () => {
    const client = new GdbClient({
      baseUrl: "http://localhost:3000",
      service: "myTenant",
      servicePath: "/sub",
      api: "v2",
      token: "test-token",
    });

    const mockResponse = new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockResponse);

    await client.get("/entities");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v2/entities"),
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "Fiware-Service": "myTenant",
          "Fiware-ServicePath": "/sub",
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("constructs correct NGSI-LD headers", async () => {
    const client = new GdbClient({
      baseUrl: "http://localhost:3000",
      service: "myTenant",
      api: "ld",
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
        headers: expect.objectContaining({
          "NGSILD-Tenant": "myTenant",
          "Content-Type": "application/ld+json",
        }),
      }),
    );
  });

  it("parses JSON response", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000", api: "v2" });
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

  it("parses count header for v2", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000", api: "v2" });

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Fiware-Total-Count": "42",
        },
      }),
    );

    const result = await client.get("/entities");
    expect(result.count).toBe(42);
  });

  it("throws GdbClientError on HTTP error", async () => {
    const client = new GdbClient({ baseUrl: "http://localhost:3000", api: "v2" });
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
    const client = new GdbClient({ baseUrl: "http://localhost:3000", api: "v2" });
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
    const client = new GdbClient({ baseUrl: "http://localhost:3000", api: "v2" });

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
        api: "v2",
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
            Authorization: "Bearer sk-test-key",
          }),
        }),
      );
    });

    it("prefers token over apiKey", async () => {
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        api: "v2",
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
    });
  });

  describe("token refresh", () => {
    it("refreshes token on 401 and retries", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        api: "v2",
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
        api: "v2",
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

    it("does not refresh when using apiKey", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        api: "v2",
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

    it("refreshes token on 401 for rawRequest", async () => {
      const onRefresh = vi.fn();
      const client = new GdbClient({
        baseUrl: "http://localhost:3000",
        api: "v2",
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
});
