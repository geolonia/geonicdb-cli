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
  apiKey?: string;
}

export interface GdbConfigV2 {
  version?: number;
  activeProfile: string;
  profiles: Record<string, GdbConfig>;
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
  profile?: string;
  apiKey?: string;
}

export interface ClientOptions {
  baseUrl: string;
  service?: string;
  servicePath?: string;
  api: ApiVersion;
  token?: string;
  verbose?: boolean;
  apiKey?: string;
  refreshToken?: string;
  onTokenRefresh?: (token: string, refreshToken?: string) => void;
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
