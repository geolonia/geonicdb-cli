import { InvalidArgumentError } from "commander";

/**
 * JSON-LD `@context` handling for NGSI-LD requests (#177).
 *
 * GeonicDB compacts a response using **only the `@context` that the request
 * itself supplied** (ETSI GS CIM 009 clause 5.5.5 / 5.5.7, geolonia/geonicdb#1733).
 * Terms that the supplied context does not map are rendered as Fully Qualified
 * Names. A read that sends no context therefore gets core-context compaction
 * only, so any custom vocabulary comes back as absolute URIs — which is exactly
 * what `--context` exists to fix.
 *
 * https://cim.etsi.org/NGSI-LD/official/clause-5.html
 */

/** `rel` value that marks a Link header entry as a JSON-LD context (JSON-LD 1.1 6.1). */
const JSON_LD_CONTEXT_REL = "http://www.w3.org/ns/json-ld#context";

/**
 * Characters that must never reach a Link header value. `<` / `>` / `"` would
 * terminate the link-value or its parameters early, and CR/LF would split the
 * request into forged headers. `new URL()` alone does not reject them (it
 * percent-encodes some and preserves others), so screen the raw input instead
 * of trusting normalization.
 */
// eslint-disable-next-line no-control-regex
const FORBIDDEN_URI_CHARS = /[\u0000-\u0020\u007F<>"]/;

/**
 * Validate a single `--context` value and return it unchanged (trimmed).
 *
 * The string is deliberately NOT normalized through `new URL().toString()`:
 * servers and clients compare `@context` URLs by exact string, and
 * normalization silently rewrites values (e.g. `https://example.org` becomes
 * `https://example.org/`), which would make the round-trip lie about what the
 * user asked for.
 */
export function validateContextUri(value: string): string {
  const uri = value.trim();
  if (!uri) {
    throw new InvalidArgumentError("@context URI must not be empty.");
  }
  if (FORBIDDEN_URI_CHARS.test(uri)) {
    throw new InvalidArgumentError(
      `Invalid @context URI: "${uri}". It must not contain whitespace, control characters, '<', '>' or '"'.`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new InvalidArgumentError(
      `Invalid @context URI: "${uri}". It must be an absolute URL (e.g. https://example.org/ctx.jsonld).`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidArgumentError(
      `Invalid @context URI: "${uri}". Only http:// and https:// URLs are supported — the server dereferences it.`,
    );
  }
  return uri;
}

/**
 * Split one raw `--context` occurrence into validated URIs.
 * Commas separate entries so a single flag can carry a context array, matching
 * how Link headers list multiple link-values (RFC 8288 3).
 */
export function splitContextValues(raw: string): string[] {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    throw new InvalidArgumentError("@context URI must not be empty.");
  }
  return parts.map(validateContextUri);
}

/**
 * Commander option parser for a repeatable `--context` flag.
 * Accumulates across repeats and expands comma-separated values, so
 * `--context a --context b` and `--context a,b` are equivalent.
 */
export function collectContext(raw: string, previous?: string[]): string[] {
  return [...(previous ?? []), ...splitContextValues(raw)];
}

/**
 * Coerce a persisted config value into a context list.
 * Accepts an array (canonical) or a comma-separated string (hand-edited
 * config files). Anything else is ignored rather than sent as garbage.
 *
 * Every entry is re-validated: `config set context` checks on the way in, but
 * `config.json` is a plain file anyone can edit, and the value ends up verbatim
 * in a `Link` header. Trusting it would leave the header-injection guard
 * bypassable by editing a file. Failing loudly beats dropping the entry — a
 * silently ignored context reads as "the server did not compact my terms".
 * `geonic config delete context` still works, since it does not resolve options.
 */
export function normalizeContextConfigValue(value: unknown): string[] | undefined {
  const raw = Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : typeof value === "string"
      ? value.split(",")
      : [];
  const uris = raw.map((s) => s.trim()).filter((s) => s.length > 0);
  if (uris.length === 0) {
    return undefined;
  }
  return uris.map((uri) => {
    try {
      return validateContextUri(uri);
    } catch (err) {
      throw new Error(
        `Invalid "context" in the saved config: ${err instanceof Error ? err.message : String(err)} ` +
          `Fix it with \`geonic config set context <uri>\` or remove it with \`geonic config delete context\`.`,
      );
    }
  });
}

/**
 * Build the `Link` header value carrying the JSON-LD contexts.
 * Multiple contexts become multiple link-values in one header (RFC 8288 3).
 */
export function buildContextLinkHeader(contexts: string[]): string {
  return contexts
    .map((uri) => `<${uri}>; rel="${JSON_LD_CONTEXT_REL}"; type="application/ld+json"`)
    .join(", ");
}

/**
 * Shape the contexts for an `application/ld+json` request body: a bare string
 * for one entry, an array for several — the two forms NGSI-LD accepts.
 */
export function toBodyContext(contexts: string[]): string | string[] {
  return contexts.length === 1 ? contexts[0] : [...contexts];
}
