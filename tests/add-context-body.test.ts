import { describe, it, expect } from "vitest";
import { buildAddContextBody } from "./e2e/support/add-context-body.js";

describe("buildAddContextBody (#203)", () => {
  it("omits kind so Add @context stays Hosted (geonicdb #2297)", () => {
    const body = buildAddContextBody("https://example.org/e2e-vocab.jsonld", {
      Vehicle: "https://example-vocab/ns#Vehicle",
    });

    expect(body).toEqual({
      url: "https://example.org/e2e-vocab.jsonld",
      body: {
        "@context": { Vehicle: "https://example-vocab/ns#Vehicle" },
      },
    });
    // Any client-supplied kind (cached / hosted / implicitlyCreated) is 400.
    expect(body).not.toHaveProperty("kind");
  });

  // near-miss: URL-only registration is schema-valid, but E2E needs an embedded
  // body — SSRF hardening blocks fetching the fixture URL from loopback.
  it("embeds the @context body for local resolver use", () => {
    const body = buildAddContextBody("https://example.org/e2e-vocab.jsonld", {
      plateNumber: "https://example-vocab/ns#plateNumber",
    });
    expect(body.body["@context"]).toEqual({
      plateNumber: "https://example-vocab/ns#plateNumber",
    });
  });
});
