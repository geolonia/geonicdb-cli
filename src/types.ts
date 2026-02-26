export type ApiVersion = "v2" | "ld";
export type OutputFormat = "json" | "table" | "keyValues" | "geojson";

export interface GdbConfig {
  url?: string;
  service?: string;
  servicePath?: string;
  api?: ApiVersion;
  token?: string;
  refreshToken?: string;
  format?: OutputFormat;
}

export interface GlobalOptions {
  url?: string;
  service?: string;
  servicePath?: string;
  api?: ApiVersion;
  token?: string;
  format?: OutputFormat;
  color?: boolean;
  verbose?: boolean;
}

export interface ClientOptions {
  baseUrl: string;
  service?: string;
  servicePath?: string;
  api: ApiVersion;
  token?: string;
  verbose?: boolean;
}

export interface ClientResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
  count?: number;
}

export interface NgsiError {
  error?: string;
  description?: string;
  type?: string;
  title?: string;
  detail?: string;
}

export interface EntityListOptions {
  type?: string;
  idPattern?: string;
  query?: string;
  attrs?: string;
  georel?: string;
  geometry?: string;
  coords?: string;
  spatialId?: string;
  limit?: number;
  offset?: number;
  orderBy?: string;
  count?: boolean;
}
