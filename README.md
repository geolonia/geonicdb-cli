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

# List entities
geonic entities list

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
| `profile create <name> [--tenant <id\|name>] [--url <url>]` | Create a new profile, optionally bound to a tenant and URL |
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

`--tenant <id>` accepts either a tenant ID or a tenant name. The value is stored as both `service` (sent in `NGSILD-Tenant` headers) and `tenantId` on the profile, so subsequent `auth login` calls resolve to that tenant automatically.

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
| `--tenant-id <id>` | Log in to a specific tenant. Value is sent to the server as-is (server resolves) |
| `-s, --service <id\|name>` | Log in to a specific tenant. Resolved client-side against the account's available tenants by ID or name |

**Multi-tenant support**: When you belong to multiple tenants, `auth login` requires explicit tenant selection via `--tenant-id` or `-s/--service`. There is no interactive picker — if neither flag is provided and the account has multiple tenants, the command lists the available tenants and exits with an error.

A common workflow is to create one profile per tenant (`geonic profile create <name> --tenant <tenant>`); the tenant binding is persisted on the profile, so plain `geonic --profile <name> auth login` resolves to the correct tenant automatically.

```text
$ geonic auth login
Email: user@example.com
Password: ********
Error: Multiple tenants are available for this account. Specify one with --tenant-id <id> or -s/--service <name>:
  - my_city (tid-aaa) [tenant_admin]
  - another_city (tid-bbb) [user]

$ geonic auth login --tenant-id tid-aaa
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

`entities list` supports filtering options: `--type`, `--id-pattern`, `--query`, `--attrs`, `--georel`, `--geometry`, `--coords`, `--spatial-id`, `--limit`, `--offset`, `--order-by`, `--count`.

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
| `reg list` | List registrations |
| `reg get <id>` | Get a registration by ID |
| `reg create [json]` | Create a registration |
| `reg update <id> [json]` | Update a registration |
| `reg delete <id>` | Delete a registration |

### types — Browse entity types

| Subcommand | Description |
|---|---|
| `types list` | List available entity types |
| `types get <typeName>` | Get details for a type |

### temporal — Temporal entity operations

#### temporal entities

| Subcommand | Description |
|---|---|
| `temporal entities list` | List temporal entities |
| `temporal entities get <id>` | Get a temporal entity by ID |
| `temporal entities create [json]` | Create a temporal entity |
| `temporal entities delete <id>` | Delete a temporal entity |

Temporal entities list/get support: `--time-rel`, `--time-at`, `--end-time-at`, `--last-n`.

#### temporal entityOperations

| Subcommand | Description |
|---|---|
| `temporal entityOperations query [json]` | Query temporal entities (POST) |

Temporal entityOperations query supports: `--aggr-methods`, `--aggr-period`.

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
- 定義済みの制約は `geonic models get <type>` で確認できます（table 形式では `制約名(フィールド, ...)` 表記）

重複作成時のエラー表示例:

```console
$ geonic entities create '{"id":"urn:ngsi-ld:RoomReservation:002","type":"RoomReservation","room":{"type":"Property","value":"R1"},"date":{"type":"Property","value":"2026-07-15"},"startTime":{"type":"Property","value":"10:00"}}'
Error: Entity already exists: violates unique constraint 'no-double-booking' on fields [room, date, startTime]
Hint: inspect the model's unique constraints with `geonic models get <type>`.
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
| `admin users create [json]` | Create a new user |
| `admin users update <id> [json]` | Update a user |
| `admin users delete <id>` | Delete a user |
| `admin users activate <id>` | Activate a user |
| `admin users deactivate <id>` | Deactivate a user |
| `admin users unlock <id>` | Unlock a user |

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
  -d '{"id":"Room1","type":"Room"}' \
  'http://localhost:3000/ngsi-ld/v1/entities'
```

## Configuration

The CLI stores configuration in `~/.config/geonic/config.json`.

```bash
# Set the default server
geonic config set url http://localhost:3000

# Set default output format
geonic config set format table

# View all settings
geonic config list
```

Override the config directory with the `GEONIC_CONFIG_DIR` environment variable:

```bash
GEONIC_CONFIG_DIR=/path/to/config geonic entities list
```

## API Key Authentication

API keys provide an alternative to JWT tokens for authentication. When configured, requests include the `X-Api-Key` header.

```bash
# Set API key in config
geonic config set api-key gdb_your_api_key_here

# Or pass via CLI flag
geonic entities list --api-key gdb_your_api_key_here

# Or use environment variable
GDB_API_KEY=gdb_your_api_key_here geonic entities list
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
