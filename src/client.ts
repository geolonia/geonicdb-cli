import type { ApiVersion, ClientOptions, ClientResponse, NgsiError } from "./types.js";

export class GdbClient {
  private baseUrl: string;
  private service?: string;
  private servicePath?: string;
  private api: ApiVersion;
  private token?: string;
  private apiKey?: string;
  private refreshToken?: string;
  private onTokenRefresh?: (token: string, refreshToken?: string) => void;
  private verbose: boolean;

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.service = options.service;
    this.servicePath = options.servicePath;
    this.api = options.api;
    this.token = options.token;
    this.apiKey = options.apiKey;
    this.refreshToken = options.refreshToken;
    this.onTokenRefresh = options.onTokenRefresh;
    this.verbose = options.verbose ?? false;
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.api === "ld") {
      headers["Content-Type"] = "application/ld+json";
      headers["Accept"] = "application/ld+json";
      if (this.service) headers["NGSILD-Tenant"] = this.service;
    } else {
      headers["Content-Type"] = "application/json";
      headers["Accept"] = "application/json";
      if (this.service) headers["Fiware-Service"] = this.service;
      if (this.servicePath) headers["Fiware-ServicePath"] = this.servicePath;
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
    return this.api === "ld" ? "/ngsi-ld/v1" : "/v2";
  }

  private async doFetch<T = unknown>(
    method: string,
    fullPath: string,
    options?: {
      body?: unknown;
      params?: Record<string, string>;
      headers?: Record<string, string>;
    },
  ): Promise<ClientResponse<T>> {
    const url = this.buildUrl(fullPath, options?.params);
    const headers = this.buildHeaders(options?.headers);
    const body = options?.body ? JSON.stringify(options.body) : undefined;

    if (this.verbose) {
      process.stderr.write(`> ${method} ${url}\n`);
      for (const [k, v] of Object.entries(headers)) {
        process.stderr.write(`> ${k}: ${v}\n`);
      }
      if (body) {
        process.stderr.write(`> Body: ${body}\n`);
      }
      process.stderr.write("\n");
    }

    const response = await fetch(url, { method, headers, body });

    if (this.verbose) {
      process.stderr.write(`< ${response.status} ${response.statusText}\n`);
      response.headers.forEach((v, k) => {
        process.stderr.write(`< ${k}: ${v}\n`);
      });
      process.stderr.write("\n");
    }

    const countHeader =
      this.api === "ld"
        ? response.headers.get("NGSILD-Results-Count")
        : response.headers.get("Fiware-Total-Count");
    const count = countHeader ? parseInt(countHeader, 10) : undefined;

    let data: T;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("json") || contentType.includes("ld+json")) {
      data = (await response.json()) as T;
    } else {
      const text = await response.text();
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

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const url = this.buildUrl("/auth/tokens/refresh");
      const headers = this.buildHeaders();
      const body = JSON.stringify({ refreshToken: this.refreshToken });
      const response = await fetch(url, { method: "POST", headers, body });
      if (!response.ok) return false;
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) return false;
      const data = (await response.json()) as Record<string, unknown>;
      const newToken = data.token as string | undefined;
      const newRefresh = data.refreshToken as string | undefined;
      if (!newToken) return false;
      this.token = newToken;
      if (newRefresh) this.refreshToken = newRefresh;
      if (this.onTokenRefresh) {
        this.onTokenRefresh(newToken, newRefresh);
      }
      return true;
    } catch {
      return false;
    }
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
    const fullPath = `${this.getBasePath()}${path}`;
    try {
      return await this.doFetch<T>(method, fullPath, options);
    } catch (err) {
      if (err instanceof GdbClientError && err.status === 401 && this.refreshToken) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          return await this.doFetch<T>(method, fullPath, options);
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
    },
  ): Promise<ClientResponse<T>> {
    return this.doFetch<T>(method, path, options);
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
