import { Given } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import type { GdbWorld } from "../support/world.js";

/**
 * Steps for the JSON-LD @context feature (#177).
 *
 * The fixtures are written over plain HTTP rather than through the CLI on
 * purpose: the bug only shows up for data authored elsewhere with a custom
 * vocabulary, since anything the CLI writes on its own carries the core context.
 */

const CUSTOM_VOCAB = {
  Vehicle: "https://example-vocab/ns#Vehicle",
  plateNumber: "https://example-vocab/ns#plateNumber",
} as const;

function authToken(world: GdbWorld): string {
  const token = world.readProfileConfig().token;
  assert.ok(typeof token === "string" && token, "Not logged in — no token in the CLI config.");
  return token;
}

async function apiRequest(
  world: GdbWorld,
  method: string,
  path: string,
  body: unknown,
): Promise<{ status: number; text: string }> {
  const res = await fetch(new URL(path, world.serverUrl).toString(), {
    method,
    headers: {
      "Content-Type": "application/ld+json",
      Authorization: `Bearer ${authToken(world)}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, text: await res.text() };
}

/**
 * Register a context in the tenant so the server resolves it locally. Its SSRF
 * hardening blocks loopback URLs, so a context served from the test process
 * could never be fetched — a registered document is the only workable fixture.
 */
Given(
  /^a JSON-LD context "([^"]+)" is registered with:$/,
  async function (this: GdbWorld, url: string, docString: string) {
    const { status, text } = await apiRequest(this, "POST", "/ngsi-ld/v1/jsonldContexts", {
      url,
      kind: "cached",
      body: { "@context": JSON.parse(docString) },
    });
    assert.equal(status, 201, `Registering ${url} failed: HTTP ${status} ${text}`);
  },
);

/**
 * Temporal history is not derived from a plain entity create here, so the
 * temporal representation is written directly — with the same custom vocabulary.
 */
Given(
  /^a temporal entity "([^"]+)" exists using the custom vocabulary$/,
  async function (this: GdbWorld, entityId: string) {
    const { status, text } = await apiRequest(this, "POST", "/ngsi-ld/v1/temporal/entities", {
      "@context": [
        CUSTOM_VOCAB,
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
      ],
      id: entityId,
      type: "Vehicle",
      plateNumber: [
        { type: "Property", value: "ABC-123", observedAt: "2026-01-01T00:00:00.000Z" },
      ],
    });
    assert.ok(
      status === 201 || status === 204,
      `Creating temporal ${entityId} failed: HTTP ${status} ${text}`,
    );
  },
);

Given(
  /^an entity "([^"]+)" exists using the custom vocabulary$/,
  async function (this: GdbWorld, entityId: string) {
    const { status, text } = await apiRequest(this, "POST", "/ngsi-ld/v1/entities", {
      "@context": [
        CUSTOM_VOCAB,
        "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld",
      ],
      id: entityId,
      type: "Vehicle",
      plateNumber: { type: "Property", value: "ABC-123" },
    });
    assert.equal(status, 201, `Creating ${entityId} failed: HTTP ${status} ${text}`);
  },
);
