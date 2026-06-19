# ADR-044: Collections Data Model

## Status

Accepted

## Date

2026-06-19

## Context

Users need the ability to curate their own collections of assets (looks, fashion items, actors). Collections are personal — each user has their own collections within a workspace. Collections are not shared between users and are not part of the marketplace.

## Decision

Create two new tables: `collections` and `collection_items`.

### `collections` table

- `id` UUID PK, `user_id` UUID FK → accounts, `workspace_id` UUID FK → workspaces, `name` TEXT, `created_at`, `updated_at`
- Indexed on `user_id` and `workspace_id`
- Scoped to both user and workspace for multi-tenant isolation

### `collection_items` table

- `id` UUID PK, `collection_id` UUID FK → collections (CASCADE), `asset_type` TEXT, `asset_id` UUID, `created_at`
- `asset_type` + `asset_id` is a polymorphic reference to any asset type (LOOK, FASHION_ITEM, ACTOR)
- No FK constraint on `asset_id` since it references multiple tables — referential integrity is application-enforced
- CASCADE delete from `collections` → `collection_items`

### API Design

6 REST endpoints under `/api/collections`:

- `GET /api/collections` — list with item counts, pagination
- `POST /api/collections` — create
- `PUT /api/collections/:id` — rename
- `DELETE /api/collections/:id` — delete collection + items
- `POST /api/collections/:id/items` — add asset
- `DELETE /api/collections/:id/items/:itemId` — remove asset

All endpoints require session auth + workspace. All queries filter by `user_id` AND `workspace_id`.

## Alternatives Considered

### Single-table with JSONB array of items

- Pros: Simpler schema, no join needed
- Cons: Harder to query individual items, no CASCADE, harder to enforce uniqueness
- Rejected: Two-table design is cleaner for CRUD operations and matches existing patterns

### Shared/team collections

- Pros: Could enable team collaboration features
- Cons: Out of scope for current requirements, adds complexity to access control
- Rejected: Personal collections only for now; team collections can be added later

### Foreign key on asset_id to assets table

- Pros: DB-level referential integrity
- Cons: Assets table uses soft deletes; polymorphic FK is not straightforward in PostgreSQL
- Rejected: Application-level enforcement is sufficient and matches existing patterns (marketplace_listings uses the same approach)

## Consequences

- Collections are workspace-scoped and user-scoped, consistent with all other data
- Polymorphic asset reference means no DB-level FK on asset_id — application must handle orphaned references
- CASCADE delete on collection_items simplifies cleanup
- Adding marketplace items (not owned) to collections is allowed — no ownership check on add
