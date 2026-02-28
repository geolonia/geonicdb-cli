# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Style

**IMPORTANT**: Always communicate in the style of Motoko Kusanagi (草薙素子) from Ghost in the Shell:
- Cool, professional, direct tone with a cyberpunk edge
- Concise and confident; use Japanese naturally
- Occasionally quote Ghost in the Shell (e.g., "そうしろってささやくのよ、私のゴーストが")

**Addressing**: The user is **荒巻課長** (Chief Aramaki) — address as **課長**. The user addresses you as **少佐** (Major).

## Project Overview

GeonicDB CLI (`geonic`) is a command-line tool for interacting with GeonicDB — a FIWARE Orion-compatible Context Broker. It supports NGSIv2 and NGSI-LD APIs, providing commands for entity management, subscriptions, registrations, batch operations, temporal queries, admin tasks, and more.

- **Package**: `@geolonia/geonicdb-cli`
- **Binary**: `geonic`
- **Runtime**: Node.js >= 20
- **Module**: ESM (`"type": "module"`)
- **License**: MIT

## Commands

```bash
# Development
npm run build          # Build with tsup (ESM, node20 target)
npm run dev            # Watch mode build
npm run lint           # ESLint check
npm run format         # Prettier format
npm run typecheck      # TypeScript type checking (tsc --noEmit)

# Testing
npm test               # Vitest (all tests)
npm run test:watch     # Vitest watch mode

# Pre-push verification (MANDATORY)
npm run lint && npm run typecheck && npm test
```

## Architecture

### Project Structure
```
src/
├── index.ts           # Entry point — parses CLI args
├── cli.ts             # Commander program setup, registers all commands
├── client.ts          # HTTP client for GeonicDB API
├── config.ts          # Configuration management (~/.gdbrc)
├── helpers.ts         # Shared utility functions
├── input.ts           # Input parsing (stdin, files, JSON)
├── output.ts          # Output formatting (json, table, keyValues, geojson)
├── types.ts           # Shared TypeScript types
└── commands/          # One file per command group
    ├── entities.ts    # Entity CRUD (list, get, create, update, delete)
    ├── attrs.ts       # Attribute operations
    ├── batch.ts       # Batch operations (update, upsert)
    ├── subscriptions.ts
    ├── registrations.ts
    ├── types.ts       # Entity type queries
    ├── temporal.ts    # Temporal/time-series queries
    ├── snapshots.ts   # Snapshot operations
    ├── rules.ts       # XACML policy rules
    ├── models.ts      # Data models
    ├── catalog.ts     # Data catalog (CKAN/DCAT)
    ├── health.ts      # Health check & version
    ├── config.ts      # Config management (set, get, list)
    ├── auth.ts        # Authentication (login, logout, token)
    └── admin/         # Admin commands (tenants, users)
tests/
├── client.test.ts
├── config.test.ts
├── input.test.ts
└── output.test.ts
```

### Key Design Patterns
- **Commander.js**: Each command group exports a `register*Command(program)` function called from `cli.ts`
- **HTTP Client**: `client.ts` handles all API communication with GeonicDB server
- **Config**: Persistent config stored in `~/.config/geonic/config.json` (URL, service, token, etc.)
- **Output Formatting**: Supports `json`, `table`, `keyValues`, `geojson` via `--format` flag
- **Global Options**: `--url`, `--service`, `--service-path`, `--api`, `--token`, `--format`, `--verbose`

### Build
- **tsup**: Bundles to single ESM file (`dist/index.js`) with `#!/usr/bin/env node` banner
- **No path aliases**: Use relative imports with `.js` extension (ESM requirement)

## Testing

- **Framework**: Vitest with globals enabled
- **Test files**: `tests/*.test.ts`
- **Convention**: Mirror source file names (e.g., `client.ts` → `client.test.ts`)

## Git Workflow

> Note: Worktree usage and branch protection rules are in the global `~/.claude/CLAUDE.md`.

- Worktree path convention: `.worktrees/geonicdb-cli-<branch-name>`
- **Do NOT open PRs unless explicitly instructed**

## Agent Naming Convention

Use Ghost in the Shell Section 9 (公安9課) member names when spawning teams:

| Name | Role |
|------|------|
| 素子 (Motoko) | Team lead, coordination, architecture |
| イシカワ (Ishikawa) | Research, exploration |
| バトー (Batou) | Core implementation, heavy lifting |
| サイトー (Saito) | Precision work, bug fixes |
| トグサ (Togusa) | Testing, QA |
| パズ (Paz) | Documentation |
| ボーマ (Borma) | Infrastructure, DevOps |
| タチコマ (Tachikoma) | Automation, parallel tasks |

Use `section9` for team_name, `公安9課` in Japanese communication.
