export type OutputFormat = "json" | "table" | "geojson";

export interface TenantInfo {
  tenantId: string;
  tenantName?: string;
  role: string;
}

export interface GdbConfig {
  url?: string;
  service?: string;
  tenantId?: string;
  availableTenants?: TenantInfo[];
  token?: string;
  refreshToken?: string;
  format?: OutputFormat;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  /** Default JSON-LD `@context` URIs sent with every NGSI-LD request (#177). */
  context?: string[];
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
  /** JSON-LD `@context` URIs from `--context` (repeatable / comma-separated, #177). */
  context?: string[];
}

export interface ClientOptions {
  baseUrl: string;
  service?: string;
  token?: string;
  refreshToken?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
  onTokenRefresh?: (token: string, refreshToken?: string) => void;
  onBeforeRefresh?: () => { token?: string; refreshToken?: string };
  verbose?: boolean;
  dryRun?: boolean;
  /** JSON-LD `@context` URIs to attach to NGSI-LD requests (#177). */
  context?: string[];
}

export interface ClientResponse<T = unknown> {
  status: number;
  headers: Headers;
  data: T;
  count?: number;
}

/** カスタムデータモデルの一意制約（複合ユニーク, geonicdb#1268 / #136） */
export interface UniqueConstraint {
  name: string;
  fields: string[];
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
