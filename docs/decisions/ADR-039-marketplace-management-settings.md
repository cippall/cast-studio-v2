# ADR-020: Marketplace Management and Listings Settings

## Status

Accepted

## Date

2026-06-17

## Context

Artists need to manage their marketplace listings (view, update price, toggle active, delete). Admins need to manage all listings and configure what constitutes a marketplace package (required outputs per listing type, generic standard look, editorial count). Agents need an API-key-authenticated endpoint to submit assets to the marketplace.

## Decision

### Artist/Admin Marketplace Management

- `GET /api/marketplace/manage` — Artists see own listings, Admins see all. Supports filtering by `is_active` and `listing_type`.
- `PATCH /api/marketplace/manage/:id` — Update price or toggle active. Ownership check: only listing owner or Admin can modify.
- `DELETE /api/marketplace/manage/:id` — Soft delete by setting `is_active = FALSE` (DELISTED state). Does not remove the marketplace_listings row.

### Admin Listings Settings

- New `marketplace_settings` table with JSONB columns for `actor_package`, `look_package`, `fashion_item_package`.
- `GET /api/admin/marketplace/settings` — Returns current package configuration.
- `PUT /api/admin/marketplace/settings` — Partial update of package settings. Merges provided fields with existing settings.
- Default Actor Package requires: headshot, fullshot, expressions_3x4, character_sheet, editorial (count=2).

### Agent Marketplace Submission

- `POST /api/agent/marketplace/submit` — API key auth only (via `requireApiKey` middleware).
- Same validation as Artist submission (asset ownership, required outputs check, no duplicate submissions).

### Route Ordering

The `/manage` routes are placed before the `/:id` routes in the marketplace router to prevent Express from matching `manage` as the `:id` parameter.

## Alternatives Considered

### Hard delete for listings

- Rejected: Soft delete (is_active=FALSE) preserves listing history and allows re-listing.

### Separate settings table per package type

- Rejected: Single table with JSONB columns is simpler for the current 3 package types and avoids schema migrations when adding new package types.

### Admin-only management endpoints

- Rejected: Artists need to manage their own listings (price, active status) without admin intervention. Admin scope is a superset (sees all listings).

## Consequences

- `marketplace_settings` table requires a migration (004).
- Default settings are seeded with the migration.
- The `as never` cast is needed at the PUT /settings route due to Zod's optional field types not matching `Partial<MarketplaceSettings>` exactly.
- Agent submission reuses the same `submitAssetForMarketplace` service function as Artist submission, keeping validation consistent.
