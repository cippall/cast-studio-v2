# ADR-002: Database Choice — PostgreSQL

## Status

Accepted

## Date

2026-06-17

## Context

Need a primary database supporting: multi-tenant isolation, relational data (workspaces, accounts, assets, commissions, marketplace), JSONB for flexible fields (prompt_recipe, generation_params), ACID transactions for financial operations (wallet, ledger), and full-text search potential.

## Decision

Use PostgreSQL with the `pg` driver (node-pg-migrate for migrations).

Key design decisions:

- **UUID primary keys** via `gen_random_uuid()` (pgcrypto extension)
- **JSONB columns** for: `prompt_recipe`, `generation_params`, `reference_images`, `source_asset_outputs`, `brief` (commission form data), `parameters` (model config), `options` (taxonomy)
- **Row-level workspace isolation**: Every table has `workspace_id` UUID FK. All queries filter by it. Admin bypass is explicit.
- **Soft delete** via `deleted_at` timestamp on assets. All queries filter `deleted_at IS NULL` by default.
- **Immutable ledger**: `ledger` table append-only. Never update or delete entries.

## Alternatives Considered

### SQLite

- Pros: Zero config, embedded, fast for reads
- Cons: No concurrent write support, no managed hosting, no JSONB, no UUID gen by default
- Rejected: Multi-user web app with concurrent generation jobs needs real concurrency

### MongoDB

- Pros: Flexible schema, easy to start
- Cons: No ACID transactions across collections (needed for wallet + ledger), no relational joins
- Rejected: Data is inherently relational; financial operations need ACID

### MySQL

- Pros: Mature, widely hosted
- Cons: Inferior JSON support, no native UUID type, less flexible full-text search
- Rejected: PostgreSQL is strictly better for our JSONB + UUID requirements

### Supabase (PostgreSQL + auth + realtime)

- Pros: Built-in auth, realtime subscriptions, managed
- Cons: Vendor lock-in, less control over schema, auth model doesn't match our dual-auth requirement (session + API key)
- Rejected: We need custom auth (session cookies + API keys for Agents). May migrate hosting to Supabase later but keep schema portable.

## Consequences

- Migration files in `server/src/db/migrations/` via node-pg-migrate
- Query helper enforces `workspace_id` filter on every query automatically
- JSONB fields need Zod schemas for validation at API boundary
- `pgcrypto` extension required (UUID generation)
- Connection pooling via `pg.Pool` — configure max connections for fal.ai worker concurrency
