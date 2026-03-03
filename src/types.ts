export type OutputFormat = "json" | "table" | "geojson";

export interface GdbConfig {
  url?: string;
  service?: string;
  token?: string;
  refreshToken?: string;
  format?: OutputFormat;
  apiKey?: string;
}

export interface GdbConfigFile {
  version: number;
  currentProfile: string;
  profiles: Record<string, GdbConfig>;
}

export interface GlobalOptions {
  url?: string;
  service?: string;
  token?: string;
  format?: OutputFormat;
  color?: boolean;
  verbose?: boolean;
  profile?: string;
  apiKey?: string;
  dryRun?: boolean;
}

export interface ClientOptions {
  baseUrl: string;
  service?: string;
  token?: string;
  refreshToken?: string;
  apiKey?: string;
  onTokenRefresh?: (token: string, refreshToken?: string) => void;
  verbose?: boolean;
  dryRun?: boolean;
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
