# ADR-025: Asset Duplication Design

## Status

Accepted

## Date

2026-06-17

## Context

Artists need to duplicate existing assets (Actors, Looks, Fashion Items) to create variations without regenerating from scratch. The duplicate must be a fully editable, independent copy that preserves the original's seed, prompt_recipe, and output images.

Key requirements:

- Duplicate must have a new ID but inherit seed, prompt_recipe, taxonomy_values, and all output image URLs
- New asset_output rows must be created (new IDs) with same image_urls
- Duplicate must be fully editable — not frozen, not marketplace-locked
- `source_asset_id` must point to the original asset for traceability
- `source_type` must be set to `'DUPLICATE'`
- Optional name parameter; if not provided, name is NULL

## Decision

Implement duplication as a three-layer operation following the existing architecture:

1. **Repository layer** (`asset-repo.ts`): Two new functions:
   - `duplicateAsset()` — INSERTs a new asset row with `source_asset_id` and `source_type = 'DUPLICATE'`
   - `duplicateAssetOutputs()` — INSERT...SELECT to copy all asset_outputs with new IDs but same values

2. **Service layer** (`actor-service.ts`): `duplicateActor()` — orchestrates the duplication by calling the repo functions and returning the formatted ActorDetail response

3. **Route layer** (`asset-versions.ts`): `POST /api/assets/:id/duplicate` — accepts optional `name` parameter, delegates to service

The `createAsset()` function was updated to include `source_asset_id` in the INSERT statement, making it reusable for both original creation and duplication.

## Alternatives Considered

### Deep copy at application level (fetch + re-insert each field)

- Pros: More explicit control over which fields to copy
- Cons: More code, more DB round-trips, risk of missing fields
- Rejected: The INSERT...SELECT approach is simpler, faster, and less error-prone

### Database-level CREATE TABLE ... LIKE or pg_dump

- Pros: Handles all columns automatically
- Cons: Not suitable for selective copying; doesn't allow changing asset_id, workspace_id, etc.
- Rejected: We need to change key fields (id, workspace_id, creator_id, source_asset_id, source_type)

### Generic duplicate endpoint for all asset types

- Pros: Single endpoint handles Actors, Looks, Fashion Items
- Cons: Different asset types have different output structures and validation; premature generalization
- Rejected: Start with Actor duplication (the primary use case); extend to other types when needed

## Consequences

- `createAsset()` now accepts `source_asset_id` — all existing callers pass `undefined` which becomes `NULL`, preserving backward compatibility
- The `duplicateAssetOutputs()` function uses INSERT...SELECT which copies all columns except `id` (auto-generated) and `asset_id` (set to the new asset)
- Duplicate assets are independent — editing or deleting the duplicate does not affect the original
- The `source_asset_id` chain allows tracing provenance (useful for debugging and future features like "based on" UI)
- Marketplace status is NOT inherited — duplicates start as fresh, editable assets regardless of the original's marketplace state
