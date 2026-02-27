import { describe, it, expect, vi, beforeEach } from "vitest";
import { clientCredentialsGrant } from "../src/oauth.js";

describe("OAuth", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("clientCredentialsGrant", () => {
    it("sends correct request and returns token", async () => {
      const tokenResponse = {
        access_token: "test-access-token",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "read:entities",
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(tokenResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await clientCredentialsGrant({
        baseUrl: "http://localhost:3000",
        clientId: "my-client",
        clientSecret: "my-secret",
        scope: "read:entities",
      });

      expect(result.access_token).toBe("test-access-token");
      expect(result.token_type).toBe("Bearer");
      expect(result.expires_in).toBe(3600);

      const [calledUrl, calledOpts] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(calledUrl).toBe("http://localhost:3000/oauth/token");
      expect(calledOpts.method).toBe("POST");
      expect(calledOpts.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");

      // Check Basic Auth header
      const expectedAuth = Buffer.from("my-client:my-secret").toString("base64");
      expect(calledOpts.headers.Authorization).toBe(`Basic ${expectedAuth}`);

      // Check body
      const body = calledOpts.body as string;
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("scope=read%3Aentities");
    });

    it("sends request without scope when not provided", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ access_token: "token", token_type: "Bearer" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await clientCredentialsGrant({
        baseUrl: "http://localhost:3000",
        clientId: "my-client",
        clientSecret: "my-secret",
      });

      const body = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string;
      expect(body).toBe("grant_type=client_credentials");
    });

    it("throws on error response with error_description", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: "Client authentication failed",
          }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        ),
      );

      await expect(
        clientCredentialsGrant({
          baseUrl: "http://localhost:3000",
          clientId: "bad-client",
          clientSecret: "bad-secret",
        }),
      ).rejects.toThrow("OAuth token request failed: Client authentication failed");
    });

    it("throws on error response with plain text", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain" },
        }),
      );

      await expect(
        clientCredentialsGrant({
          baseUrl: "http://localhost:3000",
          clientId: "client",
          clientSecret: "secret",
        }),
      ).rejects.toThrow("OAuth token request failed: Internal Server Error");
    });
  });
});
