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
| `profile create <name>` | Create a new profile |
| `profile delete <name>` | Delete a profile |
| `profile show [name]` | Show profile settings |

### auth — Authentication

| Subcommand | Description |
|---|---|
| `auth login` | Authenticate and save token |
| `auth logout` | Clear saved authentication token |

The `auth login` command reads `GDB_EMAIL` and `GDB_PASSWORD` environment variables. It also supports OAuth Client Credentials flow with `--client-id` and `--client-secret`.

### me — Display current user

```bash
geonic me
```

Displays the current authenticated user, token expiry, and active profile.

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

#### admin oauth-clients

| Subcommand | Description |
|---|---|
| `admin oauth-clients list` | List all OAuth clients |
| `admin oauth-clients get <id>` | Get an OAuth client by ID |
| `admin oauth-clients create [json]` | Create a new OAuth client |
| `admin oauth-clients update <id> [json]` | Update an OAuth client |
| `admin oauth-clients delete <id>` | Delete an OAuth client |

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
