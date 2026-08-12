import type { ClientOptions, ClientResponse, NgsiError } from "./types.js";
import { clientCredentialsGrant } from "./oauth.js";
import { getTokenStatus } from "./token.js";
import { buildContextLinkHeader, toBodyContext } from "./context.js";
import { sanitizeServerText } from "./sanitize.js";

/**
 * NGSI-LD core @context. Injected into `application/ld+json` entity-write bodies
 * that omit `@context` so writes stay spec-compliant (#168): the server requires
 * an inline `@context` for `application/ld+json` (ETSI GS CIM 009 clause 6.3.5).
 */
const NGSI_LD_CORE_CONTEXT = "https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld";

export class DryRunSignal extends Error {
  constructor() {
    super("dry-run");
    this.name = "DryRunSignal";
  }
}

export class GdbClient {
  private baseUrl: string;
  private service?: string;
  private token?: string;
  private refreshToken?: string;
  private apiKey?: string;
  private clientId?: string;
  private clientSecret?: string;
  private onTokenRefresh?: (token: string, refreshToken?: string) => void;
  private onBeforeRefresh?: () => { token?: string; refreshToken?: string };
  private verbose: boolean;
  private dryRun: boolean;
  private context?: string[];
  private refreshPromise?: Promise<boolean>;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.service = options.service;
    this.token = options.token;
    this.refreshToken = options.refreshToken;
    this.apiKey = options.apiKey;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.onTokenRefresh = options.onTokenRefresh;
    this.onBeforeRefresh = options.onBeforeRefresh;
    this.verbose = options.verbose ?? false;
    this.dryRun = options.dryRun ?? false;
    this.context = options.context && options.context.length > 0 ? options.context : undefined;
  }

  private buildHeaders(
    extra?: Record<string, string>,
    options?: { contextLink?: boolean },
  ): Record<string, string> {
    const headers: Record<string, string> = {};

    headers["Content-Type"] = "application/ld+json";
    headers["Accept"] = "application/ld+json";
    if (this.service) headers["NGSILD-Tenant"] = this.service;
    // #177: reads carry the JSON-LD @context in a Link header — it is the only
    // channel a GET has, and the server compacts the response using exactly the
    // context the request supplied (ETSI GS CIM 009 clause 5.5.7). Every value
    // is applied: the server merges all link-values (geolonia/geonicdb#1818 is
    // fixed), so no "only the first is used" warning is needed anymore.
    if (options?.contextLink && this.context) {
      headers["Link"] = buildContextLinkHeader(this.context);
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    } else if (this.apiKey) {
      headers["X-Api-Key"] = this.apiKey;
    }

    if (extra) {
      Object.assign(headers, extra);
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== "") {
          url.searchParams.set(key, value);
        }
      }
    }
    return url.toString();
  }

  private getBasePath(): string {
    return "/ngsi-ld/v1";
  }

  private static readonly SENSITIVE_HEADERS = new Set(["authorization", "x-api-key"]);
  private static readonly SENSITIVE_BODY_KEYS = new Set([
    "password",
    "refreshToken",
    "token",
    "client_secret",
    "clientSecret",
    "key",
    "apiKey",
    // #176: `admin deployments` sends a MongoDB connection string — credentials
    // and all — in the body. Without this, `--verbose` would print it to stderr,
    // straight into terminal scrollback and CI logs.
    "mongodbUri",
  ]);

  private logRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
  ): void {
    if (!this.verbose) return;
    process.stderr.write(`> ${method} ${url}\n`);
    for (const [k, v] of Object.entries(headers)) {
      if (GdbClient.SENSITIVE_HEADERS.has(k.toLowerCase())) {
        process.stderr.write(`> ${k}: ***\n`);
      } else {
        process.stderr.write(`> ${k}: ${v}\n`);
      }
    }
    if (body) {
      process.stderr.write(`> Body: ${GdbClient.maskBodySecrets(body)}\n`);
    }
    process.stderr.write("\n");
  }

  private static maskBodySecrets(raw: string): string {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      for (const key of Object.keys(obj)) {
        if (GdbClient.SENSITIVE_BODY_KEYS.has(key)) {
          obj[key] = "***";
        }
      }
      return JSON.stringify(obj);
    } catch {
      return raw;
    }
  }

  private logResponse(response: Response): void {
    if (!this.verbose) return;
    // Everything here is server-controlled and goes straight to the terminal as
    // text, so strip control characters first — otherwise a hostile or
    // compromised server could embed ANSI escapes and rewrite what the operator
    // sees (same guard as `surfaceNgsiWarning` and the deployment notice).
    process.stderr.write(
      `< ${response.status} ${sanitizeServerText(response.statusText)}\n`,
    );
    response.headers.forEach((v, k) => {
      process.stderr.write(`< ${sanitizeServerText(k)}: ${sanitizeServerText(v)}\n`);
    });
    process.stderr.write("\n");
  }

  private static shellQuote(value: string): string {
    return `'${value.split("'").join("'\"'\"'")}'`;
  }

  static buildCurlCommand(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
  ): string {
    const parts: string[] = ["curl"];
    if (method !== "GET") {
      parts.push(`-X ${method}`);
    }
    for (const [key, value] of Object.entries(headers)) {
      parts.push(`-H ${GdbClient.shellQuote(`${key}: ${value}`)}`);
    }
    if (body) {
      parts.push(`-d ${GdbClient.shellQuote(body)}`);
    }
    parts.push(GdbClient.shellQuote(url));
    return parts.join(" \\\n  ");
  }

  private handleDryRun(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
  ): void {
    if (!this.dryRun) return;
    console.log(GdbClient.buildCurlCommand(method, url, headers, body));
    throw new DryRunSignal();
  }

  private canRefresh(): boolean {
    if (!this.refreshToken && !(this.clientId && this.clientSecret)) return false;
    // When authenticating solely via apiKey (no token), token refresh is unnecessary
    if (!this.token && this.apiKey) return false;
    return true;
  }

  /** Proactively refresh the token before making a request if it is expired or about to expire. */
  private async proactiveRefresh(): Promise<void> {
    if (!this.token || !this.canRefresh()) return;
    const status = getTokenStatus(this.token);
    if (status.isExpired || status.isExpiringSoon) {
      await this.performTokenRefresh();
    }
  }

  /** Check whether an error indicates an authentication/token problem that may be resolved by refreshing. */
  private static isTokenError(err: GdbClientError): boolean {
    if (err.status === 401) return true;
    // The server returns 403 for malformed / expired JWTs in some cases
    if (err.status === 403) {
      const msg = (err.message ?? "").toLowerCase();
      return msg.includes("not assigned to any tenant") || msg.includes("invalid token");
    }
    return false;
  }

  private async performTokenRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.doRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = undefined;
    }
  }

  private async doRefresh(): Promise<boolean> {
    // Re-read config to pick up tokens saved by another process
    if (this.onBeforeRefresh) {
      const latest = this.onBeforeRefresh();
      if (latest.token && latest.token !== this.token) {
        // Another process already refreshed — use the new token
        this.token = latest.token;
        if (latest.refreshToken) this.refreshToken = latest.refreshToken;
        return true;
      }
      if (latest.refreshToken) {
        this.refreshToken = latest.refreshToken;
      }
    }

    // Try refreshToken first
    if (this.refreshToken) {
      try {
        const url = this.buildUrl("/auth/refresh");
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: this.refreshToken }),
        });

        if (response.ok) {
          const data = (await response.json()) as Record<string, unknown>;
          const newToken = (data.accessToken ?? data.token) as string | undefined;
          const newRefreshToken = data.refreshToken as string | undefined;

          if (newToken) {
            this.token = newToken;
            if (newRefreshToken) this.refreshToken = newRefreshToken;
            this.onTokenRefresh?.(newToken, newRefreshToken);
            return true;
          }
        }
      } catch {
        // Fall through to client credentials
      }
    }

    // Fallback: client_credentials grant
    if (this.clientId && this.clientSecret) {
      try {
        const result = await clientCredentialsGrant({
          baseUrl: this.baseUrl,
          clientId: this.clientId,
          clientSecret: this.clientSecret,
        });
        this.token = result.access_token;
        this.onTokenRefresh?.(result.access_token);
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }

  /** Verbs whose `@context` must come from the body under `application/ld+json` (clause 6.3.5). */
  private static readonly CONTEXT_SOURCE_VERBS = new Set(["POST", "PATCH", "PUT"]);

  private isContextSourceVerb(method: string): boolean {
    return GdbClient.CONTEXT_SOURCE_VERBS.has(method.toUpperCase());
  }

  /**
   * #186/#189: make every NGSI-LD write body carry its JSON-LD `@context` inline.
   *
   * Under `Content-Type: application/ld+json` — which this CLI always sends —
   * ETSI GS CIM 009 clause 6.3.5 requires the `@context` of a POST/PATCH/PUT to
   * come from the request body itself, and GeonicDB enforces this on every
   * NGSI-LD write path (geolonia/geonicdb#1924, #2065): a body without `@context`
   * is 400 BadRequestData (batch elements: a per-element 207 error). So the
   * `@context` is resolved per JSON-LD document, in this order:
   *
   *   1. an explicit `@context` already in the payload (a deliberate choice — never overwritten),
   *   2. the user-supplied `--context` (without this the flag would be accepted
   *      on a write and silently do nothing),
   *   3. the NGSI-LD core context (so a plain payload stays valid, #168).
   *
   * Array bodies are handled per element, because each element is an independent
   * JSON-LD document (clause 5.6.7.3). Non-object elements are left untouched —
   * `entityOperations/delete` sends ID strings that have no place for a
   * `@context`. Exclusion is decided by the SHAPE of the data, not by path,
   * mirroring the server (`contextComplianceErrorForElement`).
   *
   * Out of scope, and deliberately untouched:
   *   - GET/DELETE — clause 6.3.5 covers POST/PATCH/PUT only; reads carry their
   *     context in the Link header (see `buildHeaders`).
   *   - `/jsonldContexts` — its body IS a context document, not a JSON-LD
   *     document with a `@context` term (the server excludes it the same way).
   *   - non-NGSI-LD paths (admin/auth/rules/...) — they go through
   *     `executeRawRequest` with absolute paths that never match the base path,
   *     and their strict server schemas would reject the unexpected key.
   *
   * https://cim.etsi.org/NGSI-LD/official/clause-6.html
   */
  private prepareNgsiLdWriteBody(method: string, resourcePath: string, body: unknown): unknown {
    if (!this.isContextSourceVerb(method)) return body;
    if (!resourcePath.startsWith(`${this.getBasePath()}/`)) return body;
    // Exact match, mirroring the server's CONTEXT_DOCUMENT_PATHS: only the
    // collection body IS a context document. A future /jsonldContexts/{id}
    // write would fall under the normal clause 6.3.5 rule on the server, so a
    // prefix match here would withhold the @context it requires.
    if (resourcePath === `${this.getBasePath()}/jsonldContexts`) return body;

    const context = this.context ? toBodyContext(this.context) : NGSI_LD_CORE_CONTEXT;
    if (Array.isArray(body)) {
      return body.map((element) => GdbClient.withContext(element, context));
    }
    return GdbClient.withContext(body, context);
  }

  /** Add `@context` to a plain-object payload, leaving anything else untouched. */
  private static withContext(body: unknown, context: string | string[]): unknown {
    if (
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      "@context" in (body as Record<string, unknown>)
    ) {
      return body;
    }
    return { ...(body as Record<string, unknown>), "@context": context };
  }

  private async executeRequest<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<ClientResponse<T>> {
    const resourcePath = `${this.getBasePath()}${path}`;
    const url = this.buildUrl(resourcePath, options?.params);
    // #177/#186: NGSI-LD READS carry the @context in a Link header; raw
    // admin/auth paths never do. Writes must NOT — under application/ld+json a
    // JSON-LD Link header on POST/PATCH/PUT is a 400 (clause 6.3.5 "No mixes",
    // geolonia/geonicdb#1924); their @context travels in the body instead
    // (`prepareNgsiLdWriteBody`).
    const headers = this.buildHeaders(options?.headers, {
      contextLink: !this.isContextSourceVerb(method),
    });
    const injectedBody = options?.body
      ? this.prepareNgsiLdWriteBody(method, resourcePath, options.body)
      : undefined;
    const body = injectedBody ? JSON.stringify(injectedBody) : undefined;

    this.logRequest(method, url, headers, body);
    this.handleDryRun(method, url, headers, body);
    const response = await fetch(url, { method, headers, body, signal: options?.signal });
    this.logResponse(response);

    const countHeader = response.headers.get("NGSILD-Results-Count");
    const count = countHeader ? parseInt(countHeader, 10) : undefined;

    let data: T;
    /* v8 ignore next -- null coalescing for missing content-type header */
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (text && (contentType.includes("json") || contentType.includes("ld+json"))) {
      data = JSON.parse(text) as T;
    } else {
      data = text as unknown as T;
    }

    if (!response.ok) {
      const err = data as unknown as NgsiError;
      const message =
        err?.description || err?.detail || err?.error || err?.title || `HTTP ${response.status}`;
      throw new GdbClientError(
        message,
        response.status,
        err,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }

    return { status: response.status, headers: response.headers, data, count };
  }

  private async executeRawRequest<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      skipTenantHeader?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<ClientResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options?.headers);
    if (options?.skipTenantHeader) {
      delete headers["NGSILD-Tenant"];
    }
    // executeRawRequest takes absolute paths (auth/admin/health). The scope check
    // in prepareNgsiLdWriteBody leaves non-NGSI-LD paths untouched, so this is a
    // no-op for those; kept for consistency in case an NGSI-LD path is ever routed here.
    const injectedBody = options?.body
      ? this.prepareNgsiLdWriteBody(method, path, options.body)
      : undefined;
    const body = injectedBody ? JSON.stringify(injectedBody) : undefined;

    this.logRequest(method, url, headers, body);
    this.handleDryRun(method, url, headers, body);
    const response = await fetch(url, { method, headers, body, signal: options?.signal });
    this.logResponse(response);

    let data: T;
    /* v8 ignore next -- null coalescing for missing content-type header */
    const contentType = response.headers.get("content-type") ?? "";
    const text = await response.text();
    if (text && (contentType.includes("json") || contentType.includes("ld+json"))) {
      data = JSON.parse(text) as T;
    } else {
      data = text as unknown as T;
    }

    if (!response.ok) {
      const err = data as unknown as NgsiError;
      const message =
        err?.description || err?.detail || err?.error || err?.title || `HTTP ${response.status}`;
      throw new GdbClientError(
        message,
        response.status,
        err,
        parseRetryAfter(response.headers.get("retry-after")),
      );
    }

    return { status: response.status, headers: response.headers, data };
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      signal?: AbortSignal;
    },
  ): Promise<ClientResponse<T>> {
    await this.proactiveRefresh();
    try {
      return await this.executeRequest<T>(method, path, options);
    } catch (err) {
      if (err instanceof GdbClientError && GdbClient.isTokenError(err) && this.canRefresh()) {
        const refreshed = await this.performTokenRefresh();
        if (refreshed) {
          return await this.executeRequest<T>(method, path, options);
        }
      }
      throw err;
    }
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>,
    headers?: Record<string, string>,
  ): Promise<ClientResponse<T>> {
    return this.request<T>("GET", path, { params, headers });
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    options?: { signal?: AbortSignal },
  ): Promise<ClientResponse<T>> {
    return this.request<T>("POST", path, { body, params, signal: options?.signal });
  }

  async patch<T = unknown>(
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PATCH", path, { body, params });
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<ClientResponse<T>> {
    return this.request<T>("PUT", path, { body, params });
  }

  async delete<T = unknown>(
    path: string,
    params?: Record<string, string>,
  ): Promise<ClientResponse<T>> {
    return this.request<T>("DELETE", path, { params });
  }

  /** Make a request to a raw URL path (not prefixed with API base path) */
  async rawRequest<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
      skipTenantHeader?: boolean;
      signal?: AbortSignal;
    },
  ): Promise<ClientResponse<T>> {
    await this.proactiveRefresh();
    try {
      return await this.executeRawRequest<T>(method, path, options);
    } catch (err) {
      if (err instanceof GdbClientError && GdbClient.isTokenError(err) && this.canRefresh()) {
        const refreshed = await this.performTokenRefresh();
        if (refreshed) {
          return await this.executeRawRequest<T>(method, path, options);
        }
      }
      throw err;
    }
  }
}

export class GdbClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly ngsiError?: NgsiError,
    /** Parsed Retry-After (ms) from a 429/503 response, if present. */
    public readonly retryAfterMs?: number,
  ) {
    // #183: the message is built from the server's error body and is printed
    // verbatim — deliberately so, since flattening a 400/409 into a generic
    // string would destroy the reason the operator needs. Sanitizing in the
    // constructor closes the ANSI-injection route at the single point every
    // construction passes through, so no future call site can reopen it.
    // Only control characters are removed, so the substring matching in
    // `isTokenError` and the 403/409 hint checks keeps working.
    super(sanitizeServerText(message));
    this.name = "GdbClientError";
  }
}

/**
 * Parse an HTTP `Retry-After` header into milliseconds.
 * Supports both delta-seconds (e.g. "120") and an HTTP-date. Returns undefined
 * when the header is absent or unparseable.
 */
export function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * 1000;
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}
