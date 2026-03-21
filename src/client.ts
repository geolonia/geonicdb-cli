import type { ClientOptions, ClientResponse, NgsiError } from "./types.js";
import { clientCredentialsGrant } from "./oauth.js";

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
  private verbose: boolean;
  private dryRun: boolean;
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
    this.verbose = options.verbose ?? false;
    this.dryRun = options.dryRun ?? false;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {};

    headers["Content-Type"] = "application/ld+json";
    headers["Accept"] = "application/ld+json";
    if (this.service) headers["NGSILD-Tenant"] = this.service;

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
    return (!!this.refreshToken || (!!this.clientId && !!this.clientSecret)) && !this.apiKey;
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

  private async executeRequest<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<ClientResponse<T>> {
    const url = this.buildUrl(`${this.getBasePath()}${path}`, options?.params);
    const headers = this.buildHeaders(options?.headers);
    const body = options?.body ? JSON.stringify(options.body) : undefined;

    this.logRequest(method, url, headers, body);
    this.handleDryRun(method, url, headers, body);
    const response = await fetch(url, { method, headers, body });
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
      throw new GdbClientError(message, response.status, err);
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
    },
  ): Promise<ClientResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options?.headers);
    if (options?.skipTenantHeader) {
      delete headers["NGSILD-Tenant"];
    }
    const body = options?.body ? JSON.stringify(options.body) : undefined;

    this.logRequest(method, url, headers, body);
    this.handleDryRun(method, url, headers, body);
    const response = await fetch(url, { method, headers, body });
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
      throw new GdbClientError(message, response.status, err);
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
    },
  ): Promise<ClientResponse<T>> {
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
  ): Promise<ClientResponse<T>> {
    return this.request<T>("POST", path, { body, params });
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
    },
  ): Promise<ClientResponse<T>> {
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
  ) {
    super(message);
    this.name = "GdbClientError";
  }
}
