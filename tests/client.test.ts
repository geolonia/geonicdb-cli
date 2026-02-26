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
});
