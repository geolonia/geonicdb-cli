import { describe, it, expect } from "vitest";
import { InvalidArgumentError } from "commander";
import {
  validateContextUri,
  splitContextValues,
  collectContext,
  normalizeContextConfigValue,
  buildContextLinkHeader,
  toBodyContext,
} from "../src/context.js";

describe("validateContextUri", () => {
  it("accepts an absolute https URL unchanged", () => {
    expect(validateContextUri("https://example.org/ctx.jsonld")).toBe(
      "https://example.org/ctx.jsonld",
    );
  });

  it("accepts http and trims surrounding whitespace", () => {
    expect(validateContextUri("  http://example.org/ctx.jsonld  ")).toBe(
      "http://example.org/ctx.jsonld",
    );
  });

  it("preserves the exact string instead of normalizing it", () => {
    // `new URL(...).toString()` would rewrite this to `https://example.org/`.
    // @context URLs are compared by exact string, so normalization must not happen.
    expect(validateContextUri("https://example.org")).toBe("https://example.org");
  });

  it("rejects an empty value", () => {
    expect(() => validateContextUri("   ")).toThrow(InvalidArgumentError);
  });

  it("rejects a relative or non-absolute value", () => {
    expect(() => validateContextUri("./ctx.jsonld")).toThrow(/absolute URL/);
  });

  it("rejects non-http(s) schemes the server cannot dereference", () => {
    expect(() => validateContextUri("file:///etc/passwd")).toThrow(/http:\/\/ and https:\/\//);
    expect(() => validateContextUri("ftp://example.org/ctx.jsonld")).toThrow(
      /http:\/\/ and https:\/\//,
    );
  });

  // Header-injection guard: these characters would terminate the link-value or
  // split the request into forged headers.
  it.each([
    ["CR", "https://example.org/a\r.jsonld"],
    ["LF", "https://example.org/a\n.jsonld"],
    ["CRLF + forged header", "https://example.org/a\r\nX-Injected: 1"],
    ["angle bracket", "https://example.org/a>.jsonld"],
    ["double quote", 'https://example.org/a".jsonld'],
    ["NUL", "https://example.org/a\u0000.jsonld"],
    ["space", "https://example.org/a b.jsonld"],
  ])("rejects a URI containing %s", (_label, uri) => {
    expect(() => validateContextUri(uri)).toThrow(InvalidArgumentError);
  });
});

describe("splitContextValues", () => {
  it("splits comma-separated URIs", () => {
    expect(splitContextValues("https://a.example/1.jsonld,https://b.example/2.jsonld")).toEqual([
      "https://a.example/1.jsonld",
      "https://b.example/2.jsonld",
    ]);
  });

  it("ignores empty segments from sloppy input", () => {
    expect(splitContextValues("https://a.example/1.jsonld, ,")).toEqual([
      "https://a.example/1.jsonld",
    ]);
  });

  it("rejects input with no usable URI", () => {
    expect(() => splitContextValues(" , ")).toThrow(InvalidArgumentError);
  });

  it("rejects the whole flag when one entry is invalid", () => {
    expect(() => splitContextValues("https://a.example/1.jsonld,not-a-url")).toThrow(
      InvalidArgumentError,
    );
  });
});

describe("collectContext", () => {
  it("accumulates repeated flags", () => {
    const first = collectContext("https://a.example/1.jsonld", undefined);
    const second = collectContext("https://b.example/2.jsonld", first);
    expect(second).toEqual(["https://a.example/1.jsonld", "https://b.example/2.jsonld"]);
  });

  it("treats repeats and comma-separated values as equivalent", () => {
    const repeated = collectContext(
      "https://b.example/2.jsonld",
      collectContext("https://a.example/1.jsonld", undefined),
    );
    const commas = collectContext(
      "https://a.example/1.jsonld,https://b.example/2.jsonld",
      undefined,
    );
    expect(commas).toEqual(repeated);
  });

  it("does not mutate the accumulated array in place", () => {
    const first = collectContext("https://a.example/1.jsonld", undefined);
    collectContext("https://b.example/2.jsonld", first);
    expect(first).toEqual(["https://a.example/1.jsonld"]);
  });
});

describe("normalizeContextConfigValue", () => {
  it("passes an array through", () => {
    expect(normalizeContextConfigValue(["https://a.example/1.jsonld"])).toEqual([
      "https://a.example/1.jsonld",
    ]);
  });

  it("accepts a comma-separated string from a hand-edited config", () => {
    expect(
      normalizeContextConfigValue("https://a.example/1.jsonld, https://b.example/2.jsonld"),
    ).toEqual(["https://a.example/1.jsonld", "https://b.example/2.jsonld"]);
  });

  it("drops non-string array members", () => {
    expect(normalizeContextConfigValue(["https://a.example/1.jsonld", 42, null])).toEqual([
      "https://a.example/1.jsonld",
    ]);
  });

  it.each([
    ["undefined", undefined],
    ["empty array", []],
    ["empty string", "  "],
    ["a number", 42],
    ["an object", { url: "https://a.example/1.jsonld" }],
  ])("returns undefined for %s", (_label, value) => {
    expect(normalizeContextConfigValue(value)).toBeUndefined();
  });

  // config.json is a plain file: `config set` validation must not be the only gate,
  // or editing the file by hand would bypass the Link-header injection guard.
  it.each([
    ["a relative URI", "./ctx.jsonld"],
    ["a non-http scheme", "file:///etc/passwd"],
    ["a CRLF injection attempt", "https://example.org/a\r\nX-Injected: 1"],
    ["an angle bracket", "https://example.org/a>.jsonld"],
  ])("rejects %s stored as a string", (_label, value) => {
    expect(() => normalizeContextConfigValue(value)).toThrow(/saved config/);
  });

  it("rejects an invalid entry inside a stored array", () => {
    expect(() =>
      normalizeContextConfigValue(["https://a.example/1.jsonld", "not-a-url"]),
    ).toThrow(/saved config/);
  });

  it("points at the commands that fix the saved value", () => {
    expect(() => normalizeContextConfigValue("not-a-url")).toThrow(/config delete context/);
  });
});

describe("buildContextLinkHeader", () => {
  it("builds a JSON-LD context link-value", () => {
    expect(buildContextLinkHeader(["https://example.org/ctx.jsonld"])).toBe(
      '<https://example.org/ctx.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
    );
  });

  it("joins several contexts as comma-separated link-values (RFC 8288)", () => {
    const header = buildContextLinkHeader([
      "https://a.example/1.jsonld",
      "https://b.example/2.jsonld",
    ]);
    expect(header).toBe(
      '<https://a.example/1.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json", ' +
        '<https://b.example/2.jsonld>; rel="http://www.w3.org/ns/json-ld#context"; type="application/ld+json"',
    );
  });
});

describe("toBodyContext", () => {
  it("uses a bare string for a single context", () => {
    expect(toBodyContext(["https://example.org/ctx.jsonld"])).toBe(
      "https://example.org/ctx.jsonld",
    );
  });

  it("uses an array for several contexts", () => {
    expect(toBodyContext(["https://a.example/1.jsonld", "https://b.example/2.jsonld"])).toEqual([
      "https://a.example/1.jsonld",
      "https://b.example/2.jsonld",
    ]);
  });

  it("copies the array so later mutation cannot leak into a request body", () => {
    const source = ["https://a.example/1.jsonld", "https://b.example/2.jsonld"];
    const body = toBodyContext(source) as string[];
    source.push("https://c.example/3.jsonld");
    expect(body).toHaveLength(2);
  });
});
