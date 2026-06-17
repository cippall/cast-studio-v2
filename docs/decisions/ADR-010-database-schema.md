# ADR-010: Database Schema Design for Multi-Tenant Cast Studio

## Status

Accepted

## Date

2026-06-17

## Context

We need a PostgreSQL database schema to support a multi-tenant digital casting and wardrobe library. Key requirements:

1. **Multi-tenant isolation** — All data is scoped to a workspace (`workspace_id`). Studio and Client workspaces cannot see each other's data except via explicit sharing.
2. **Sixteen distinct entities** — Workspaces, accounts, api_keys, wallets, ledger, assets, asset_permissions, asset_outputs, asset_output_versions, workflows, commissions, commission_assets, notifications, models, taxonomy, and marketplace_listings.
3. **Async generation pipeline** — Assets have child outputs (generated images) with versioning and reproducibility. `generation_params` stores the complete fal.ai request JSON.
4. **Soft delete** — Assets are never hard-deleted. A `deleted_at` timestamp marks deletion; only Admin can permanently remove.
5. **Marketplace freeze** — Approved marketplace assets are immutable (no edit/regenerate/delete).
6. **Ownership** — `client_id` is the single source of truth for asset ownership. NULL = Studio owns, set = Client owns.

## Decision

Create a single initial migration (`001_initial_schema`) with all 16 tables, indexes, constraints, and ON DELETE rules as specified in `specs/database-schema.md`.

## Key Schema Decisions

### 1. UUID Primary Keys with `gen_random_uuid()`

All tables use UUID primary keys with `gen_random_uuid()` from the `pgcrypto` extension. This avoids sequential ID guessability and simplifies data migration between environments.

### 2. JSONB for Flexible Fields

Three tables use JSONB for structurally flexible data:

- `assets.prompt_recipe` — the complete prompt configuration (structured JSON)
- `asset_outputs.generation_params` — full fal.ai API call parameters for reproducibility
- `commissions.brief` — admin-defined form fields submitted by the client
- `asset_outputs.reference_images` and `source_asset_outputs` — arrays of input references

JSONB allows each of these to evolve independently without schema migrations.

### 3. Soft Delete Pattern

- `assets.deleted_at` (TIMESTAMP, nullable) — NULL = active, set = soft-deleted
- All application queries filter `WHERE deleted_at IS NULL` by default
- The `idx_assets_deleted_at` index supports efficient filtering
- Only Admin can hard-delete

### 4. ON DELETE Rules

| Rule     | Tables                                       | Rationale                                                    |
| -------- | -------------------------------------------- | ------------------------------------------------------------ |
| CASCADE  | asset_outputs → assets                       | Orphaned outputs are meaningless without parent asset        |
| CASCADE  | api_keys → accounts                          | Keys belong to an account; deleting account revokes all keys |
| CASCADE  | asset_permissions → assets                   | Permissions are meaningless without the asset                |
| CASCADE  | commission_assets → commissions, assets      | Junction table; both references should cascade               |
| CASCADE  | wallets → accounts, workspaces               | Wallet belongs to account+workspace pair                     |
| CASCADE  | notifications → accounts                     | Notifications belong to recipient                            |
| CASCADE  | ledger → wallets                             | Transaction log belongs to wallet                            |
| CASCADE  | workflows → accounts, wallets                | Workflow references both                                     |
| SET NULL | assets.client_id → accounts                  | Client ownership survives account deletion                   |
| SET NULL | commissions.assignee_id → accounts           | Commission survives artist deletion                          |
| SET NULL | ledger.workflow_id, ledger.api_key_id        | History survives the entity                                  |
| SET NULL | marketplace_listings.purchased_by → accounts | Purchase history survives buyer deletion                     |

### 5. Unique Constraints

- `accounts (workspace_id, email)` — no duplicate emails within a workspace
- `wallets (workspace_id, account_id)` — one wallet per account per workspace
- `asset_permissions (asset_id, grantee_id) WHERE revoked_at IS NULL` — only one active grant per asset-grantee pair
- `api_keys (key_hash)` — no duplicate hashed keys
- `workspaces (slug)` — URL-friendly unique slug

### 6. Partial Unique Index for Permissions

The `asset_permissions` table uses a **partial unique index** (`WHERE revoked_at IS NULL`) to enforce at most one active permission per (asset, grantee) pair. This is a hard database-level constraint, not application logic. Revoking sets `revoked_at = NOW()`, which removes the row from the index and allows a new grant.

### 7. Deferred FK for ledger

The `ledger` table references `workflows` and `api_keys`, which are created later in the migration. These FKs are added via `ALTER TABLE` at the end of the migration file, after all tables are created.

### 8. asset_output_versions (No FK)

The `asset_output_versions` table does **not** have a foreign key to `asset_outputs`. This is intentional: when an output is regenerated, the old version is archived here and the current row is updated. A FK would create a circular dependency pattern and complicate the archive operation.

### 9. Indexes per Performance Pattern

All indexes follow the access patterns defined in the schema spec. Key patterns:

- Every table has index(es) on foreign key columns
- `asset_outputs` has a composite index on `(asset_id, status)` for the common query "get all SUCCESS outputs for an asset"
- `asset_output_versions` has a composite index on `(asset_output_id, version)` for version history queries
- `notifications` has indexes on `recipient_id`, `is_read`, and `created_at` for the common unread count + pagination query

## Alternatives Considered

### Single `visibility` ENUM column instead of asset_permissions table

- Rejected: An ENUM column can't represent per-client sharing. The asset_permissions table supports dynamic, revocable sharing with multiple grantees.

### Hard delete instead of soft delete

- Rejected: Soft delete provides an audit trail and recovery option. Hard-delete capability reserved for Admin only via separate endpoint.

### Integer auto-increment IDs instead of UUIDs

- Rejected: UUIDs prevent ID guessing, simplify data merging across environments, and don't expose tenant scale.

### Separate migration per table

- Rejected: A single initial migration is simpler for the initial schema. Future changes will use individual migrations.

## Consequences

- All application queries must filter by `workspace_id` and `deleted_at IS NULL` (enforced at repository layer, not in raw queries)
- UUIDs increase index size compared to integers (acceptable trade-off for security and portability)
- JSONB fields require application-level validation (no schema enforcement at the database level)
- The partial unique index on `asset_permissions` provides database-level enforcement of the "one active grant" rule
- Migration system uses raw SQL files (.up.sql / .down.sql) with a custom runner in `server/src/db/migrate.ts`
