# @geolonia/geonicdb-cli

CLI tool for [GeonicDB](https://geonicdb.geolonia.com/) — a FIWARE Orion compatible Context Broker.

Supports the **NGSI-LD** API.

## Install

```bash
npm install -g @geolonia/geonicdb-cli
```

Or run directly with npx:

```bash
npx @geolonia/geonicdb-cli <command>
```

The CLI is available as `geonic`.

## Quick Start

```bash
# Set the server URL
geonic config set url http://localhost:3000

# Create an entity
geonic entities create '{"id":"Room1","type":"Room","temperature":{"value":23,"type":"Number"}}'

# List entities (local scope — exempts too-wide query check)
geonic entities list --local

# Get an entity by ID
geonic entities get Room1

# Update attributes
geonic entities update Room1 '{"temperature":{"value":25,"type":"Number"}}'

# Delete an entity
geonic entities delete Room1
```

## Getting Help

The CLI provides built-in help in wp-cli style. Use `geonic help` to explore available commands:

```bash
# Show all available commands
geonic help

# Get help on a specific command
geonic help entities

# Get help on a subcommand
geonic help entities list

# Works with nested commands too
geonic help admin tenants
```

You can also use `--help` on any command:

```bash
geonic entities --help
geonic entities list --help
```

## Global Options

| Option | Description |
|---|---|
| `-u, --url <url>` | Base URL of the GeonicDB server |
| `-s, --service <name>` | `NGSILD-Tenant` header |
| `--token <token>` | Authentication token |
| `-p, --profile <name>` | Use a named profile |
| `--api-key <key>` | API key for authentication |
| `--context <uri>` | JSON-LD `@context` URI for NGSI-LD requests (repeatable, or comma-separated) |
| `-f, --format <fmt>` | Output format: `json`, `table`, `geojson` |
| `--no-color` | Disable color output |
| `-v, --verbose` | Verbose output |
| `--dry-run` | Print the equivalent `curl` command without executing |

Options are resolved in this order (first wins):

1. Command-line flags
2. Config file (`~/.config/geonic/config.json`)
3. Defaults (`format=json`)

## Pagination

All `list` subcommands accept `--limit <n>` and `--offset <n>` to paginate through results:

```bash
geonic types list --limit 50 --offset 100
geonic admin users list --limit 100 --offset 0
```

Supported on: `entities list`, `temporal entities list`, `subscriptions list`, `registrations list`, `snapshots list`, `types list`, `rules list`, `catalog datasets list`, `custom-data-models list`, `me policies list`, `me api-keys list`, `me oauth-clients list`, and all `admin <resource> list` commands.

Server-side maximum limits: 1000 for NGSI endpoints, 100 for admin endpoints. Omit both flags to use server defaults.

## Commands

### help — Get help on commands

```bash
geonic help [<command>] [<subcommand>]
```

### config — Manage CLI configuration

| Subcommand | Description |
|---|---|
| `config set <key> <value>` | Save a config value |
| `config get <key>` | Get a config value |
| `config list` | List all config values |
| `config delete <key>` | Delete a config value |

### profile — Manage connection profiles

| Subcommand | Description |
|---|---|
| `profile list` | List all profiles |
| `profile use <name>` | Switch active profile |
| `profile create <name> [--tenant <id\|name>] [--url <url>]` | Create a new profile. `--tenant` always sets `tenantId`; `service` (`NGSILD-Tenant`) is set only when the value is a tenant name (`^[a-z0-9_]+$`) |
| `profile delete <name>` | Delete a profile |
| `profile show [name]` | Show profile settings |

When the same account belongs to multiple tenants, create one profile per tenant and switch between them with `profile use`:

```bash
# One-time setup
geonic profile create miya --tenant miya --url https://geonicdb.geolonia.com
geonic profile create geolonia --tenant geolonia --url https://geonicdb.geolonia.com
geonic --profile miya auth login
geonic --profile geolonia auth login

# Daily use
geonic profile use miya       # operate as miya tenant
geonic profile use geolonia   # operate as geolonia tenant
```

`--tenant <name|id>` accepts either a tenant ID or a tenant name. The value is always stored as `tenantId` on the profile. `service` (sent in `NGSILD-Tenant` headers) is set **only when the value matches the tenant-name pattern `^[a-z0-9_]+$`** — UUIDs and other ID forms are never written to `service` (they would make subsequent API calls return 400). The same rule applies to `auth login` when it persists `config.service` from `availableTenants[].tenantName`. For multi-tenant accounts, pass the tenant again on `auth login` via `--tenant` / `-s` — a saved `service` is not used as an implicit login tenant.

### auth — Authentication

| Subcommand | Description |
|---|---|
| `auth login` | Authenticate and save token |
| `auth logout` | Clear saved authentication token |
| `auth nonce` | Get a nonce and PoW challenge for API key authentication |
| `auth token-exchange` | Exchange API key for a session JWT via nonce + PoW |

#### Email/Password Login

`auth login` uses interactive prompts for email and password. A TTY is required — credentials are never accepted via environment variables or command-line arguments to prevent leaking secrets in shell history.

```bash
geonic auth login
```

| Option | Description |
|---|---|
| `--tenant <name\|id>` | Log in to a specific tenant. When the account returns `availableTenants` (multi-tenant), resolved client-side by name or ID; otherwise the value is sent to the server for validation (`tenantName` or `tenantId`) |
| `--tenant-id <id>` | Log in by tenant ID only. Multi-tenant: resolved client-side against `availableTenants` (rejects names — use `--tenant`). Single-membership: sent to the server as `tenantId`. Wins when both `--tenant` and `--tenant-id` are supplied |
| `-s, --service <id\|name>` | Same resolution as `--tenant` (name or ID). Must be passed explicitly on the CLI — a profile-saved `service` is not used as an implicit login tenant |

**Multi-tenant support**: When you belong to multiple tenants, `auth login` requires explicit tenant selection via `--tenant`, `--tenant-id`, or `-s/--service`. There is no interactive picker — if neither flag is provided and the account has multiple tenants, the command lists the available tenants and exits with an error. A profile-saved `service` is not treated as an implicit login tenant (explicit CLI flag required).

A common workflow is to create one profile per tenant (`geonic profile create <name> --tenant <tenant>`) and pass the same tenant on login (`geonic --profile <name> auth login --tenant <tenant>`). The profile's saved `service` still applies to subsequent API calls via `NGSILD-Tenant`.

```text
$ geonic auth login
Email: user@example.com
Password: ********
Error: Multiple tenants are available for this account. Specify one with --tenant <name|id>, --tenant-id <id>, or -s/--service <name|id>:
  - my_city (tid-aaa) [tenant_admin]
  - another_city (tid-bbb) [user]

$ geonic auth login --tenant my_city
Login successful (tenant: my_city). Token saved to config.
```

#### OAuth Client Credentials

For machine-to-machine authentication (CI/CD, scripts), use the OAuth Client Credentials flow:

```bash
geonic auth login --client-credentials --client-id MY_ID --client-secret MY_SECRET
```

| Option | Description |
|---|---|
| `--client-credentials` | Use OAuth 2.0 Client Credentials flow |
| `--client-id <id>` | OAuth client ID (or `GDB_OAUTH_CLIENT_ID` env var) |
| `--client-secret <secret>` | OAuth client secret (or `GDB_OAUTH_CLIENT_SECRET` env var) |
| `--scope <scopes>` | OAuth scopes (space-separated) |

#### API Key Token Exchange

`auth token-exchange` performs a complete API key to JWT exchange:

1. Requests a nonce from the server (`POST /auth/nonce`)
2. Solves the Proof-of-Work challenge (SHA-256)
3. Exchanges the API key + solved PoW for a session JWT (`POST /oauth/token`)

```bash
# Exchange API key for JWT and save to config
geonic auth token-exchange --api-key gdb_abcdef... --save

# Just display the token without saving
geonic auth token-exchange --api-key gdb_abcdef...
```

### me — Current user and self-service resources

```bash
geonic me
```

Displays the current authenticated user, token expiry, and active profile.

#### me oauth-clients

| Subcommand | Description |
|---|---|
| `me oauth-clients list` | List your OAuth clients |
| `me oauth-clients create [json]` | Create a new OAuth client |
| `me oauth-clients update <clientId> [json]` | Update an OAuth client |
| `me oauth-clients regenerate-secret <clientId>` | Regenerate client secret |
| `me oauth-clients delete <id>` | Delete an OAuth client |

`me oauth-clients create` supports flag options: `--name`, `--policy`, `--save`. Use `--save` to store client credentials in config for automatic re-authentication.

`me oauth-clients update` supports: `--name`, `--description`, `--policy-id` (use `null` to unbind), `--active`, `--inactive`.

```bash
# Create with flags
geonic me oauth-clients create --name my-ci-bot --policy <policy-id>

# Create from JSON (note: field is "name", not "clientName")
geonic me oauth-clients create '{"name":"my-bot","policyId":"<policy-id>"}'

# Attach a personal policy
geonic me oauth-clients update <client-id> --policy-id my-readonly

# Unbind policy
geonic me oauth-clients update <client-id> --policy-id null
```

**Note**: `--policy-id` on update accepts only policies created by yourself (`/me/policies`). Policies created via `admin policies` cannot be bound here.

**Note on flag naming**: On `me api-keys` and `me oauth-clients`, the option is `--policy` for `create` and `--policy-id` for `update`. The `admin api-keys` counterpart uses `--policy` for both. Run `geonic me api-keys update --help` (or `geonic me oauth-clients update --help`) to confirm the exact flag for each subcommand.

#### me api-keys

| Subcommand | Description |
|---|---|
| `me api-keys list` | List your API keys |
| `me api-keys create [json]` | Create a new API key |
| `me api-keys update <keyId> [json]` | Update an API key |
| `me api-keys delete <keyId>` | Delete an API key |

`me api-keys create` supports flag options:

| Flag | Description |
|---|---|
| `--name <name>` | Key name |
| `--policy <policyId>` | Policy ID to attach (XACML policy) |
| `--origins <origins>` | Allowed origins (comma-separated, at least 1 required) |
| `--rate-limit <n>` | Rate limit (requests per minute) |
| `--dpop-required` | Require DPoP token binding (RFC 9449) |
| `--save` | Save the API key to profile config |

`me api-keys update` supports: `--name`, `--policy-id` (use `null` to unbind), `--origins`, `--rate-limit`, `--dpop-required` / `--no-dpop-required`, `--active`, `--inactive`.

```bash
# Create an API key with a policy and save to config
geonic me api-keys create --name my-app --policy <policy-id> --save

# Create from JSON
geonic me api-keys create '{"name":"my-app","policyId":"<policy-id>"}'

# Attach a personal policy
geonic me api-keys update <key-id> --policy-id my-readonly

# Unbind policy
geonic me api-keys update <key-id> --policy-id null
```

`me api-keys list` output includes a `dpopRequired` field (boolean).

**Note**: `--policy-id` on update accepts only policies created by yourself (`/me/policies`). Policies created via `admin policies` cannot be bound here.

**Note on flag naming**: On `me api-keys` and `me oauth-clients`, the option is `--policy` for `create` and `--policy-id` for `update`. The `admin api-keys` counterpart uses `--policy` for both. Run `geonic me api-keys update --help` (or `geonic me oauth-clients update --help`) to confirm the exact flag for each subcommand.

#### me policies

| Subcommand | Description |
|---|---|
| `me policies list` | List your personal policies |
| `me policies get <policyId>` | Get a personal policy by ID |
| `me policies create [json]` | Create a personal policy |
| `me policies update <policyId> [json]` | Update a personal policy |
| `me policies delete <policyId>` | Delete a personal policy |

Personal policies (`scope: personal`) are created by `user` role accounts for self-service access control. They can be bound to your own API keys and OAuth clients.

**Constraints (enforced server-side)**:
- `priority` is fixed at 100 (user role minimum — cannot escalate)
- `scope` is always `personal` — not applied tenant-wide
- `target` is required
- Data API paths only (`/v2/**`, `/ngsi-ld/**` etc.) — admin/me paths are not allowed

```bash
# Create a GET-only policy
geonic me policies create @readonly-policy.json

# Bind to an API key
geonic me api-keys update <key-id> --policy-id my-readonly

# Bind to an OAuth client
geonic me oauth-clients update <client-id> --policy-id my-readonly
```

### entities — Manage context entities

| Subcommand | Description |
|---|---|
| `entities list` | List entities |
| `entities get <id>` | Get an entity by ID |
| `entities create [json]` | Create a new entity |
| `entities update <id> [json]` | Update attributes (PATCH) |
| `entities replace <id> [json]` | Replace all attributes (PUT) |
| `entities upsert [json]` | Create or update entities |
| `entities delete <id>` | Delete an entity by ID |
| `entities purge <selectors> [--keep\|--drop] --yes` | Purge entities/attributes by selector (destructive) |

`entities list` supports filtering options: `--type`, `--id-pattern`, `--query`, `--attrs`, `--georel`, `--geometry`, `--coords`, `--spatial-id`, `--limit`, `--offset`, `--order-by`, `--count`, `--local`.

`--local` (`?local=true`) limits the request to local scope and exempts the too-wide query check, so a selector-less `geonic entities list --local` is allowed.

`entities purge` requires **at least one primary selector** — `--type`, `--attrs`, `--query`, or `--georel` (the latter together with `--geometry`/`--coords`). These can be narrowed with the refinement filters `--id`, `--id-pattern`, `--scope-q`, `--local`. A refinement filter **on its own is not sufficient**: `--id`/`--id-pattern`/`--scope-q` alone are rejected by both the CLI and the server — to remove a single entity use `entities delete <id>`. Mutation flags `--keep`/`--drop` (mutually exclusive) remove/retain attributes on matched entities instead of deleting the entities. `--attrs` on purge is a selector ("entities having any listed attributes"), not an output projection.

For safety, `entities purge` requires confirmation. In non-interactive contexts (CI/pipes), it refuses to run unless `--yes` is provided.

`--order-by` uses NGSI-LD v1.9.1 inline direction grammar: `name`, `name;desc`, `type;asc,name;desc` (quote `;` in shell, e.g. `--order-by 'name;desc'`). There is no `--order-direction` flag. Legacy `!attr` (e.g. `--order-by '!temperature'`) is still accepted server-side but deprecated; prefer `attr;desc`.

#### entities attrs — Manage entity attributes

| Subcommand | Description |
|---|---|
| `entities attrs list <entityId>` | List all attributes |
| `entities attrs get <entityId> <attrName>` | Get a specific attribute |
| `entities attrs add <entityId> [json]` | Add attributes |
| `entities attrs update <entityId> <attrName> [json]` | Update an attribute |
| `entities attrs delete <entityId> <attrName>` | Delete an attribute |

### entityOperations (batch) — Batch operations

| Subcommand | Description |
|---|---|
| `entityOperations create [json]` | Batch create entities |
| `entityOperations upsert [json]` | Batch upsert entities |
| `entityOperations update [json]` | Batch update entities |
| `entityOperations delete [json]` | Batch delete entities |
| `entityOperations query [json]` | Batch query entities |
| `entityOperations merge [json]` | Batch merge entities |

`batch` is available as an alias for `entityOperations`.

`entityOperations query` posts the JSON body as-is to `POST /entityOperations/query`. After geolonia/geonicdb#2290 (ETSI GS CIM 009 clause 5.7.2.4), a **too-wide** body returns **400 BadRequestData**: the payload must include at least one of `type`, a non-system `attrs`, a non-system `q`, or `geoQ`. `id` / `idPattern` alone are **not** enough. Use `--local` (`?local=true`) for a local-scope scan or id-only lookup.

```bash
# Restricted by type + attrs (sufficient selector)
geonic batch query '{"entities":[{"type":"Sensor"}],"attrs":["temperature"]}'

# Id-only lookup — requires --local (otherwise 400 Too wide query)
geonic batch query '{"entities":[{"id":"urn:ngsi-ld:Sensor:001"}]}' --local
```

### import — Bulk-load entities (large datasets)

`entityOperations upsert` sends the whole payload in a single request, so it is bounded by the
server's batch size and the API Gateway 29-second timeout. For nationwide-scale loads
(hundreds of thousands to millions of entities), use `import`, which streams the input, splits it
into batch-upsert requests (by entity count **and** byte size), retries transient failures, and
can resume after an interruption.

```bash
# Load an NDJSON file (one entity per line)
geonic import entities.ndjson

# Resumable load with error capture
geonic import entities.ndjson \
  --resume .import.ckpt \
  --errors-out failed.ndjson \
  --errors-log errors.log

# Re-submit only the entities that failed
geonic import failed.ndjson

# Preview the plan without sending anything
geonic import entities.ndjson --dry-run
```

| Option | Description |
|---|---|
| `--input-format <fmt>` | `ndjson` (default, streamed) or `json` (a JSON array, loaded into memory) |
| `--mode <mode>` | `upsert` (merge, default) or `replace` |
| `--batch-size <n>` | Entities per request (default 100 = safe on every plan; raise it up to your plan's batch limit — T30 500, T40 1,000, absolute max 1,000) |
| `--max-bytes <n>` | Max request body bytes per chunk (default 1,000,000) |
| `--concurrency <n>` | Concurrent requests (default 1 = sequential; a shared cooldown honors 429s) |
| `--retries <n>` | Max retries per chunk on 429/5xx/timeout (default 5) |
| `--timeout <ms>` | Per-request timeout (default 60,000) |
| `--continue-on-error` | Keep going after failures (default: stop at the first failure) |
| `--resume <checkpoint>` | Resume from a checkpoint file (upsert + file input only) |
| `--errors-out <file>` | Write failed entities as re-submittable NDJSON |
| `--errors-log <file>` | Write failure details (reason/status/line) as NDJSON |
| `--bisect` / `--bisect-max <n>` | On a `400`/`413` chunk, binary-split to isolate the offending entity |

Notes:
- **Batch size is plan-dependent** (geolonia/geonicdb#2082): T0/T5 plans allow 100 entities per
  batch request, T30 500, T40 1,000 (1,000 is also the absolute ceiling; a tenant-specific
  `maxBatchSize` quota overrides the plan value). The default `--batch-size 100` works on every
  plan; on a higher plan, raising it reduces HTTP round-trips (the rate-quota weight is per
  entity, so the total cost is unchanged). Exceeding your plan's limit fails the chunk with
  `400` `"Batch size N cannot exceed the plan limit of M entities per batch"` — the CLI shows the
  server message as-is, so the remedy is to lower `--batch-size` (or raise the plan). With
  `--bisect`, a `400`/`413` chunk is binary-split (up to `--bisect-max`) to isolate the
  offending entities; anything that still fails is recorded as failed (use `--errors-out`
  to capture it for re-submission).
- Input is read from a file path or, with `-` / a pipe, from stdin. **Resume is only available for
  file input** (stdin cannot be replayed) and **only with `--mode upsert`** (replaying a `replace`
  would overwrite newer state).
- Retries and resume are **at-least-once**: a re-sent chunk re-runs the upsert (and its change
  events / notifications). Upserts are idempotent in value but not in side effects — see the
  warning printed for `--mode replace`.

### subscriptions (sub) — Manage context subscriptions

| Subcommand | Description |
|---|---|
| `sub list` | List subscriptions |
| `sub get <id>` | Get a subscription by ID |
| `sub create [json]` | Create a subscription |
| `sub update <id> [json]` | Update a subscription |
| `sub delete <id>` | Delete a subscription |

### registrations (reg) — Manage context registrations

| Subcommand | Description |
|---|---|
| `reg list --type WeatherStation` | List registrations (requires a selector) |
| `reg get <id>` | Get a registration by ID |
| `reg create [json]` | Create a registration |
| `reg update <id> [json]` | Update a registration |
| `reg delete <id>` | Delete a registration |

`reg list` requires **at least one selector** — `--type`, `--attrs`, `--query`, or a geoquery (`--georel` / `--geometry` / `--coords`). Pagination (`--limit` / `--offset` / `--count`) alone is not enough; without a selector the CLI refuses the request (ETSI GS CIM 009 clause 5.10.2.4 / too wide query) instead of forwarding a bare `GET /csourceRegistrations` that the broker would reject with 400.

### types — Browse entity types

| Subcommand | Description |
|---|---|
| `types list` | List available entity type names |
| `types list --details` | Show full `EntityType` objects (typeName, attributeNames, etc.) |
| `types get <typeName>` | Get details for a type |

### temporal — Temporal entity operations

#### temporal entities

| Subcommand | Description |
|---|---|
| `temporal entities list` | List temporal entities |
| `temporal entities get <id>` | Get a temporal entity by ID |
| `temporal entities create [json]` | Create a temporal entity |
| `temporal entities delete <id>` | Delete a temporal entity |

Temporal entities list supports: `--time-rel`, `--time-at`, `--end-time-at`, `--time-property`, `--last-n`, `--order-by`, `--options`, `--aggr-methods`, `--aggr-period`, `--local` (`?local=true`). After geolonia/geonicdb#2290 (ETSI GS CIM 009 clause 5.7.4.4), a **too-wide** GET returns **400 BadRequestData** unless at least one of `--type`, non-system `--attrs`, non-system `--query`, or a geoquery is present — `--time-rel` / `--time-at` alone are not enough. Use `--local` for a local-scope scan.

Temporal entities get supports: `--time-rel`, `--time-at`, `--end-time-at`, `--time-property`, `--last-n`, `--options`, `--aggr-methods`, `--aggr-period`.

`--time-property` selects which temporal property the time filter compares against (NGSI-LD `timeproperty`; ETSI clause 4.11): `observedAt` (default), `createdAt`, `modifiedAt`, or `deletedAt`. Unknown values are rejected by the server with `400 BadRequestData`.
Temporal `--order-by` follows NGSI-LD v1.9.1 grammar (`name`, `name;desc`, composites like `a;asc,b;desc`). The server returns `400` for `dist-*`/`geo:distance` and nested paths like `a.b`; combining it with `--aggr-methods` is rejected by the CLI before a request is sent (aggregations are sorted by entity ID server-side).

`--options` selects the NGSI-LD temporal representation (ETSI GS CIM 009 clause 6.3.12): `temporalValues` (alias `simplified`) for `[value, timestamp]` pairs, `aggregatedValues` for aggregations, `sysAttrs` (clause 6.3.11) to include `createdAt`/`modifiedAt` (and `expiresAt` where set). It maps to the NGSI-LD `options` query parameter — unrelated to the CLI's own `--format` (json/table). The CLI rejects the deterministic server-side `400`s before sending a request: only one of `temporalValues`/`aggregatedValues` may be present (clause 6.3.12); `aggregatedValues` requires `--aggr-methods`; and `--aggr-methods` / `--aggr-period` must be given together (e.g. `--aggr-methods avg --aggr-period PT1H` — a period alone would be silently ignored by the server, methods alone is a server 400).

> **History truncation**: Without `--last-n`, the server caps the returned history to the **100 most recent instances per attribute** (default). When it does, the server returns an `NGSILD-Warning` header and the CLI echoes it as a `Warning:` line on **stderr** so truncation is never a silent drop. To retrieve more, set `--last-n` (**max 1000**) or narrow the window with `--time-at`/`--end-time-at` — with an explicit `--last-n` the server does not truncate, so no warning is emitted. The CLI surfaces whatever `NGSILD-Warning` the server sends, verbatim.

#### temporal entityOperations

| Subcommand | Description |
|---|---|
| `temporal entityOperations query [json]` | Query temporal entities (POST) |

Supports the same representation flags as the GET paths: `--options`, `--aggr-methods`, `--aggr-period` (same fail-fast guards), plus `--local` (`?local=true`). The flags are sent in the query string; the server also accepts the spec-canonical `temporalQ` object in the request body (ETSI GS CIM 009 Table 5.2.21-1), which takes precedence over the flags. Aggregation on this POST route requires a GeonicDB with geolonia/geonicdb#1816 (after v0.16.0) — older servers silently ignore it here, so use `temporal entities list --options aggregatedValues` against those. `--order-by` is intentionally unsupported on this POST route.

After geolonia/geonicdb#2290 (ETSI GS CIM 009 clause 5.7.4.4), a **too-wide** POST body returns **400 BadRequestData** — same contract as `entityOperations query` (`type` / non-system `attrs` / non-system `q` / `geoQ`, or `--local`). `id` / `idPattern` alone are not enough.

### snapshots — Snapshot operations

| Subcommand | Description |
|---|---|
| `snapshots list` | List snapshots |
| `snapshots get <id>` | Get a snapshot by ID |
| `snapshots create` | Create a new snapshot |
| `snapshots delete <id>` | Delete a snapshot |
| `snapshots clone <id>` | Clone a snapshot |

### rules — Rule engine management

| Subcommand | Description |
|---|---|
| `rules list` | List all rules |
| `rules get <id>` | Get a rule by ID |
| `rules create [json]` | Create a new rule |
| `rules update <id> [json]` | Update a rule |
| `rules delete <id>` | Delete a rule |
| `rules activate <id>` | Activate a rule |
| `rules deactivate <id>` | Deactivate a rule |

### custom-data-models (models) — Custom data model management

| Subcommand | Description |
|---|---|
| `custom-data-models list` | List all models |
| `custom-data-models get <id>` | Get a model by ID |
| `custom-data-models create [json]` | Create a new model |
| `custom-data-models update <id> [json]` | Update a model |
| `custom-data-models delete <id>` | Delete a model |

`models` is available as an alias for `custom-data-models`.

#### 一意制約（複合ユニーク）

データモデルに `uniqueConstraints` を宣言すると、指定した属性の組み合わせの一意性がサーバ側（DB レベル）で強制されます。重複するエンティティの作成・更新は `409 AlreadyExists` となり、違反した制約名がエラーメッセージに含まれます。

```console
$ geonic models create '{
  "type": "RoomReservation",
  "domain": "building",
  "description": "Room reservation",
  "propertyDetails": {
    "room": {"ngsiType": "Property", "valueType": "string", "example": "R1"},
    "date": {"ngsiType": "Property", "valueType": "string", "example": "2026-07-15"},
    "startTime": {"ngsiType": "Property", "valueType": "string", "example": "10:00"}
  },
  "uniqueConstraints": [
    {"name": "no-double-booking", "fields": ["room", "date", "startTime"]}
  ]
}'
```

- `fields` は `propertyDetails` に定義済みの scalar 型属性（string / number / integer / boolean / uri / datetime）のみ指定できます（1 制約 1〜8 個、モデルあたり最大 10 制約）
- 制約は宣言フィールドを**すべて**持つエンティティにのみ適用されます
- `models update` の `uniqueConstraints` は全置換です（`[]` で全削除）
- 既存エンティティが重複している状態で制約を追加すると `400` になります（先に重複を解消してください）
- 定義済みの制約は `geonic models get <model-id>` で確認できます（table 形式では `制約名(フィールド, ...)` 表記）

重複作成時のエラー表示例:

```console
$ geonic entities create '{"id":"urn:ngsi-ld:RoomReservation:002","type":"RoomReservation","room":{"type":"Property","value":"R1"},"date":{"type":"Property","value":"2026-07-15"},"startTime":{"type":"Property","value":"10:00"}}'
Error: Entity already exists: violates unique constraint 'no-double-booking' on fields [room, date, startTime]
Hint: inspect the model's unique constraints with `geonic models get <model-id>`.
```

### catalog — DCAT-AP catalog

| Subcommand | Description |
|---|---|
| `catalog get` | Get the catalog |
| `catalog datasets list` | List all datasets |
| `catalog datasets get <id>` | Get a dataset by ID |
| `catalog datasets sample <id>` | Get sample data for a dataset |

### admin — Administration

#### admin tenants

| Subcommand | Description |
|---|---|
| `admin tenants list` | List all tenants |
| `admin tenants get <id>` | Get a tenant by ID |
| `admin tenants create [json]` | Create a new tenant |
| `admin tenants update <id> [json]` | Update a tenant |
| `admin tenants delete <id>` | Delete a tenant |
| `admin tenants activate <id>` | Activate a tenant |
| `admin tenants deactivate <id>` | Deactivate a tenant |

`admin tenants create` / `admin tenants update` support `--allowed-origins <origins>` for tenant-scoped CORS control. The flag maps to `settings.allowedOrigins`:

| Value | Behavior |
|---|---|
| Flag omitted | All origins allowed (backward-compatible default) |
| `--allowed-origins ""` | Empty array — deny all |
| `--allowed-origins "*"` | Wildcard — allow all origins (including non-browser / S2S clients) |
| `--allowed-origins "https://a,https://b"` | Exact-match list (max 50 entries) |

```bash
# Restrict to specific origins
geonic admin tenants update <tenant-id> --allowed-origins "https://app.example.com,https://admin.example.com"

# Wildcard for development tenants
geonic admin tenants update <tenant-id> --allowed-origins "*"

# Deny all
geonic admin tenants update <tenant-id> --allowed-origins ""
```

When combined with a JSON payload, the flag merges into `settings` without dropping other `settings.*` keys.

#### admin users

| Subcommand | Description |
|---|---|
| `admin users list` | List all users |
| `admin users get <id>` | Get a user by ID |
| `admin users create [json]` | Create a new user (add `--force-reset` to issue a temporary password and force a first-login change) |
| `admin users update <id> [json]` | Update a user |
| `admin users delete <id>` | Delete a user |
| `admin users activate <id>` | Activate a user |
| `admin users deactivate <id>` | Deactivate a user |
| `admin users unlock <id>` | Unlock a user |
| `admin users reset-password <id>` | Issue a one-time temporary password and force a change on next login |

#### admin policies

| Subcommand | Description |
|---|---|
| `admin policies list` | List all policies |
| `admin policies get <id>` | Get a policy by ID |
| `admin policies create [json]` | Create a new policy |
| `admin policies update <id> [json]` | Update a policy |
| `admin policies delete <id>` | Delete a policy |
| `admin policies activate <id>` | Activate a policy |
| `admin policies deactivate <id>` | Deactivate a policy |

**XACML Authorization Model**: All authorization is unified under XACML policies. Default role policies:

| Role | Default Behavior | Default priority |
|---|---|---|
| `user` | `/v2/**` and `/ngsi-ld/**` — all methods (CRUD) Permit. Other data APIs (`/catalog`, `/rules`, etc.) — GET only. | 100 |
| `api_key` | All Deny | 100 |
| `anonymous` | All Deny | 100 |

**Priority**: Smaller `priority` value = higher precedence (e.g. `priority: 10` overrides the user default at `priority: 100`).

| priority range | Who creates | Notes |
|---|---|---|
| -1 | System | deny-fence (e.g. super_admin data API block) — cannot be overridden |
| 0 | System | super_admin default — tenant_admin and below cannot override |
| 10–99 | `tenant_admin` | Custom tenant-wide policies |
| 100 | System / `user` (self-service via `/me/policies`) | `user` / `api_key` / `anonymous` defaults and personal policies — server fixes personal policy priority at 100 |

Custom `tenant_admin` policies (priority 10–99) override the user defaults. Target resource attributes include: `path`, `entityType`, `entityId`, `entityOwner`, `tenantService`, `servicePath`. The `servicePath` attribute supports glob patterns (e.g. `/opendata/**`) and regex matching.

#### admin oauth-clients

| Subcommand | Description |
|---|---|
| `admin oauth-clients list` | List all OAuth clients |
| `admin oauth-clients get <id>` | Get an OAuth client by ID |
| `admin oauth-clients create [json]` | Create a new OAuth client |
| `admin oauth-clients update <id> [json]` | Update an OAuth client |
| `admin oauth-clients delete <id>` | Delete an OAuth client |

#### admin api-keys

| Subcommand | Description |
|---|---|
| `admin api-keys list` | List all API keys |
| `admin api-keys get <keyId>` | Get an API key by ID |
| `admin api-keys create [json]` | Create a new API key |
| `admin api-keys update <keyId> [json]` | Update an API key |
| `admin api-keys delete <keyId>` | Delete an API key |

`admin api-keys list` supports `--tenant-id` to filter by tenant. `admin api-keys create` supports flag options: `--name`, `--policy`, `--origins`, `--rate-limit`, `--dpop-required`, `--tenant-id`, `--save`. `admin api-keys update` supports `--name`, `--policy`, `--origins`, `--rate-limit`, `--dpop-required` / `--no-dpop-required`.

**Policy**: Use `--policy <policyId>` to attach an existing XACML policy to the API key. Manage policies with `geonic admin policies` commands.

**Note**: `allowedOrigins` must contain at least 1 item when specified. Use `*` to allow all origins. `admin api-keys list` / `admin api-keys get` output includes a `dpopRequired` field (boolean).

#### admin deployments

Hostname → MongoDB cluster routing rows, used to isolate large tenants onto dedicated clusters. **super_admin only.**

| Subcommand | Description |
|---|---|
| `admin deployments list` | List routing rows (disabled ones included) |
| `admin deployments get <hostname>` | Get a routing row |
| `admin deployments create <hostname>` | Create a routing row |
| `admin deployments update <hostname>` | Update a routing row |
| `admin deployments delete <hostname>` | Delete a routing row |

```bash
# Point a hostname at a dedicated cluster (secret reference — recommended)
geonic admin deployments create tenant-a.geonicdb.com \
  --database tenant_a --plan PREMIUM --secret geonicdb/tenant-a/mongodb-uri

# Create it disabled, verify, then enable
geonic admin deployments create tenant-a.geonicdb.com \
  --database tenant_a --plan PREMIUM --secret geonicdb/tenant-a/mongodb-uri --disabled
geonic admin deployments update tenant-a.geonicdb.com --enable

# Migrate a plaintext URI to a Secrets Manager reference
geonic admin deployments update tenant-a.geonicdb.com \
  --secret geonicdb/tenant-a/mongodb-uri --clear-mongodb-uri
```

`list` supports `--enabled` / `--disabled` and `--limit` / `--offset`.
`create` supports `--database`, `--plan`, `--secret`, `--mongodb-uri`, `--rate-limit-table`, `--disabled`, `--metadata`.
`update` supports the same fields plus `--enable` / `--disable` and `--clear-secret`, `--clear-mongodb-uri`, `--clear-rate-limit-table`, `--clear-metadata` (each sends an explicit `null`, which removes the field).
`delete` requires confirmation; pass `--yes` in scripts.

**Connection string**: prefer `--secret` with a Secrets Manager secret **name**. A full ARN pins a region, and a Lambda failing over to another region cannot resolve it; a bare name resolves to each region's own replica. `--mongodb-uri` stores the credential in plaintext, lands in your shell history, and is rejected outright when the server runs with `MONGODB_ENFORCE_SECRETS=true`.

**The plaintext connection string is never returned.** Responses report `mongodbUriConfigured` (boolean) and `mongodbUriSecretArn` only.

**Writes do not take effect everywhere immediately.** Other warm server instances keep routing with the previous configuration until their cache expires; the CLI prints the server's notice after each write.

**Hostnames are lowercased** by the server, so the stored row may differ in case from what you typed.

**Errors worth reading in full**: `400` for a reserved subdomain, a rejected plaintext URI, a row left with no connection source, or a malformed value; `409` for a duplicate hostname, a hostname shadowed by `DEFAULT_DEPLOYMENT_HOSTNAMES`, a concurrent modification, or a refusal to delete/disable the row serving your own request (run that from another hostname).

#### admin cadde

| Subcommand | Description |
|---|---|
| `admin cadde get` | Get CADDE configuration |
| `admin cadde set [json]` | Set CADDE configuration |
| `admin cadde delete` | Delete CADDE configuration |

### health — Check server health

```bash
geonic health
```

### version — Display version info

```bash
geonic version
```

## Input Formats

Commands that accept JSON data support multiple input methods. The `[json]` argument is optional — when omitted, the CLI auto-detects piped stdin or launches interactive mode.

**Inline JSON / JSON5**

```bash
# Standard JSON
geonic entities create '{"id":"Room1","type":"Room"}'

# JSON5 — unquoted keys, single quotes, trailing commas, comments
geonic entities create "{id: 'Room1', type: 'Room',}"
```

[JSON5](https://json5.org/) syntax is supported everywhere JSON is accepted (inline, files, stdin, interactive).

**File input** (prefix with `@`)

```bash
geonic entities create @payload.json
```

**Stdin (auto-detect)**

When no argument is given and stdin is piped, the CLI reads from stdin automatically — no `-` required:

```bash
cat payload.json | geonic entities create
echo '{"id":"Room1","type":"Room"}' | geonic entities create
```

The explicit `-` marker is still supported for backward compatibility:

```bash
cat payload.json | geonic entities create -
```

**Interactive mode**

When no argument is given and the terminal is a TTY (no pipe), the CLI enters interactive mode with a `json>` prompt. Type or paste JSON and the input auto-submits when braces/brackets are balanced:

```text
$ geonic entities create
Enter JSON (auto-submits when braces close, Ctrl+C to cancel):
json> {
...    "id": "Room1",
...    "type": "Room"
...  }
Entity created.
```

## Output Formats

Specify the output format with `--format` or `geonic config set format <fmt>`.

| Format | Description |
|---|---|
| `json` | Pretty-printed JSON (default) |
| `table` | ASCII table |
| `geojson` | GeoJSON FeatureCollection |

Use `--key-values` on `entities list` and `entities get` to request simplified key-value format from the API.

## JSON-LD @context

GeonicDB compacts a response using **only the `@context` that the request itself supplied**, and renders anything it cannot map as a fully qualified URI (ETSI GS CIM 009 [clause 5.5.5 / 5.5.7](https://cim.etsi.org/NGSI-LD/official/clause-5.html)). Read an entity written with a custom vocabulary and you get absolute URIs back:

```bash
$ geonic entities get urn:ngsi-ld:Building:v1
{
  "id": "urn:ngsi-ld:Building:v1",
  "type": "https://example-vocab/ns#Building",
  "https://example-vocab/ns#name": { "type": "Property", "value": "HQ" }
}
```

Pass `--context` to get the short terms back:

```bash
$ geonic entities get urn:ngsi-ld:Building:v1 --context https://example.org/building.jsonld
{
  "id": "urn:ngsi-ld:Building:v1",
  "type": "Building",
  "name": { "type": "Property", "value": "HQ" }
}
```

- Works on every NGSI-LD command — `entities`, `attrs`, `types`, `temporal`, `batch`, `subscriptions`, `registrations`, `snapshots`.
- On reads (`GET`/`DELETE`) it is sent as a `Link` header; on writes (`POST`/`PATCH`/`PUT`) it is placed in the request body (per element for batch arrays), so the same flag also lets you **write** with a custom vocabulary. Writes never carry a `Link` header — combining one with `Content-Type: application/ld+json` is rejected by the server (ETSI GS CIM 009 [clause 6.3.5](https://cim.etsi.org/NGSI-LD/official/clause-6.html), "no mixes").
- Repeat the flag or separate values with commas for a context array:
  `--context https://a.example/1.jsonld --context https://b.example/2.jsonld`.
  Every supplied context is applied — the server merges them all.
- Save a per-profile default so you do not have to repeat it:

```bash
geonic config set context https://example.org/building.jsonld
geonic entities get urn:ngsi-ld:Building:v1        # uses the saved context
```

`--context` on a command **replaces** the saved default for that invocation rather than adding to it.

The URI must be an ASCII, absolute `http`/`https` URL that the server can resolve — either publicly reachable or registered with the tenant via `POST /ngsi-ld/v1/jsonldContexts`. An unresolvable context makes the server return `504 LdContextNotAvailable` instead of quietly falling back. Non-ASCII URIs are rejected up front — HTTP headers cannot carry them — so pass the percent-encoded path and punycode host (the error message shows the form to use).

## Dry Run

Use `--dry-run` on any command to print the equivalent `curl` command instead of executing the request. The output can be copied and run directly in a terminal.

```bash
$ geonic entities list --type Sensor --dry-run
curl \
  -H 'Content-Type: application/ld+json' \
  -H 'Accept: application/ld+json' \
  -H 'Authorization: Bearer <token>' \
  'http://localhost:3000/ngsi-ld/v1/entities?type=Sensor'
```

Works with all operations including POST with body:

```bash
$ geonic entities create '{"id":"Room1","type":"Room"}' --dry-run
curl \
  -X POST \
  -H 'Content-Type: application/ld+json' \
  -H 'Accept: application/ld+json' \
  -d '{"id":"Room1","type":"Room","@context":"https://uri.etsi.org/ngsi-ld/v1/ngsi-ld-core-context.jsonld"}' \
  'http://localhost:3000/ngsi-ld/v1/entities'
```

> All NGSI-LD writes are sent as `application/ld+json`, which requires an inline
> JSON-LD `@context` in the body (ETSI GS CIM 009 clause 6.3.5). When your payload
> omits `@context`, the CLI injects the NGSI-LD core context automatically — into
> object bodies (entities, subscriptions, registrations, temporal, snapshots,
> query bodies) and into each object element of batch arrays. A `@context` you provide is
> preserved, and `--context` takes precedence over the core context. ID-string
> arrays (`entityOperations/delete`) and `/jsonldContexts` registrations are left
> untouched.

## Configuration

The CLI stores configuration in `~/.config/geonic/config.json`.

```bash
# Set the default server
geonic config set url http://localhost:3000

# Set default output format
geonic config set format table

# Set a default JSON-LD @context for NGSI-LD requests (comma-separate for several)
geonic config set context https://example.org/building.jsonld

# View all settings
geonic config list
```

Override the config directory with the `GEONIC_CONFIG_DIR` environment variable:

```bash
GEONIC_CONFIG_DIR=/path/to/config geonic entities list --local
```

## API Key Authentication

API keys provide an alternative to JWT tokens for authentication. When configured, requests include the `X-Api-Key` header.

```bash
# Set API key in config
geonic config set api-key gdb_your_api_key_here

# Or pass via CLI flag
geonic entities list --local --api-key gdb_your_api_key_here

# Or use environment variable
GDB_API_KEY=gdb_your_api_key_here geonic entities list --local
```

When both a Bearer token and an API key are configured, headers are sent exclusively — the API key takes precedence when present.

### Authorization Model

All authorization for API keys and OAuth clients is controlled via XACML policies. Use `--policy <policyId>` when creating API keys or OAuth clients to attach an existing policy.

- **Tenant admins**: manage tenant-wide policies with `geonic admin policies` commands.
- **Users**: manage personal policies with `geonic me policies` commands and bind them to your own API keys / OAuth clients with `--policy-id`.

See the [admin policies](#admin-policies) section for details on the XACML authorization model, default role policies, and target resource attributes.

**Note**: `--policy-id` on `me api-keys update` / `me oauth-clients update` accepts only policies where `createdBy` matches your own user ID (i.e. policies created via `me policies create`). Policies created via `admin policies` cannot be bound to personal resources.

## Development

Requires Node.js >= 20.

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Type check
npm run typecheck

# Watch mode (rebuild on change)
npm run dev
```

### Local testing

Use `npm link` to register the `geonic` command globally as a symlink:

```bash
npm link
```

After linking, rebuild to reflect code changes:

```bash
npm run build
geonic help
```

To unlink:

```bash
npm unlink -g @geolonia/geonicdb-cli
```

## License

MIT
