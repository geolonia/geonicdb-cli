import type { ClientOptions, ClientResponse, NgsiError } from "./types.js";
import { clientCredentialsGrant } from "./oauth.js";
import { getTokenStatus } from "./token.js";
import { buildContextLinkHeader, toBodyContext } from "./context.js";

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
    // context the request supplied (ETSI GS CIM 009 clause 5.5.7).
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
    process.stderr.write(`< ${response.status} ${response.statusText}\n`);
    response.headers.forEach((v, k) => {
      process.stderr.write(`< ${k}: ${v}\n`);
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

  /**
   * #168: NGSI-LD entity writes require an inline JSON-LD `@context` under
   * `application/ld+json` (server geolonia/geonicdb#1583). The CLI always sends
   * `application/ld+json`, so inject the core context when an entity-write object
   * body omits it; otherwise the server returns 400 BadRequestData. A
   * caller-supplied `@context` is preserved (never overwritten). Arrays (batch
   * bodies) and non-object bodies are left untouched.
   *
   * Scoped to the `/entities` endpoints ONLY, mirroring the exact range where the
   * server enforces `@context` (geonicdb#1583: create/replace/append/patch-attrs).
   * Other resources must not receive an injected `@context`:
   *   - admin/auth/... use strict server schemas that reject the unexpected key.
   *   - batch (`/entityOperations`, array bodies), temporal, subscriptions and
   *     registrations are not yet `@context`-required server-side (tracked in
   *     geonicdb#1599); extend this scope when the server does.
   */
  private maybeInjectCoreContext(resourcePath: string, body: unknown): unknown {
    const isEntityWrite = resourcePath.startsWith(`${this.getBasePath()}/entities`);
    if (
      !isEntityWrite ||
      body === null ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      "@context" in (body as Record<string, unknown>)
    ) {
      return body;
    }
    return { ...(body as Record<string, unknown>), "@context": NGSI_LD_CORE_CONTEXT };
  }

  /**
   * Batch endpoints whose body is an array of entity objects. Their `@context`
   * lives on each element, not on the request: the server reads it per entity
   * (`attachContextRef` in geonicdb's batch controller). `entityOperations/delete`
   * is excluded because its array holds ID strings, and `entityOperations/query`
   * because its body is a Query object — the Link header carries the context there.
   */
  private static readonly ENTITY_ARRAY_WRITE_PATHS = [
    "/entityOperations/create",
    "/entityOperations/upsert",
    "/entityOperations/update",
    "/entityOperations/merge",
  ];

  /**
   * #177: apply a user-supplied `--context` to entity-write bodies.
   *
   * Under `application/ld+json` — which this CLI always sends — the server takes
   * the `@context` from the **body** and ignores the Link header
   * (`extractContextRef`, ETSI GS CIM 009 clause 6.3.5). Without this, `--context`
   * would be accepted on a write and then silently do nothing, which is the same
   * class of quiet failure this flag exists to remove.
   *
   * Scope mirrors where the server actually reads a body `@context` for entity
   * writes: `/entities...` (object body) and the batch endpoints listed above
   * (per-element). A caller-supplied `@context` always wins — an explicit
   * `@context` in the payload is a deliberate choice.
   */
  private applyContextToBody(resourcePath: string, body: unknown): unknown {
    if (!this.context) return body;
    const relative = resourcePath.slice(this.getBasePath().length);
    const injected = toBodyContext(this.context);

    if (relative.startsWith("/entities")) {
      return GdbClient.withContext(body, injected);
    }
    if (GdbClient.ENTITY_ARRAY_WRITE_PATHS.includes(relative) && Array.isArray(body)) {
      return body.map((entry) => GdbClient.withContext(entry, injected));
    }
    return body;
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
    // #177: NGSI-LD requests carry the @context; raw admin/auth paths never do.
    const headers = this.buildHeaders(options?.headers, { contextLink: true });
    const injectedBody = options?.body
      ? this.maybeInjectCoreContext(
          resourcePath,
          this.applyContextToBody(resourcePath, options.body),
        )
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
    // in maybeInjectCoreContext leaves non-/entities paths untouched, so this is a
    // no-op for those; kept for consistency in case an entities path is ever routed here.
    const injectedBody = options?.body
      ? this.maybeInjectCoreContext(path, options.body)
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
    super(message);
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
