# ADR-007: Marketplace Freeze Mechanism

## Status

Accepted

## Date

2026-06-17

## Context

When an asset is approved for the marketplace, it must be frozen to ensure consistency for buyers. Buyers receive the exact images that were reviewed. The original asset must remain usable by the Artist for duplication but not modification.

## Decision

### Freeze Rules

When `assets.marketplace_status = 'MARKETPLACE_APPROVED'`:

- `is_marketplace_frozen = TRUE` (explicit boolean for query efficiency)
- **Cannot**: edit (headshot/fullshot/expressions), regenerate, delete
- **Can**: view, duplicate (creates new editable copy with `source_type = 'DUPLICATE'`)
- **Cannot**: submit to marketplace again (no duplicate listings)

### Purchase Creates Duplicate

When a Client purchases from the marketplace:

1. New asset row created in Client's workspace (`workspace_id` = Client's workspace)
2. `client_id` set to purchasing Client
3. `source_asset_id` points to original marketplace asset
4. `source_type = 'MARKETPLACE_PURCHASE'`
5. New `asset_output` rows created (new IDs, same `image_url` values — no re-generation)
6. `purchased_by` and `purchased_at` set on `marketplace_listings` row
7. Wallet deducted, ledger entry created

### Admin Delisting

Admin can set `marketplace_status = 'MARKETPLACE_DELISTED'` → asset unfrozen, returns to normal Studio-owned state.

## Alternatives Considered

### Copy-on-write (share original outputs)

- Pros: Saves storage
- Cons: If original is deleted/modified, buyer's copy breaks
- Rejected: Buyer gets independent duplicate. Image URLs are copied (same fal.ai URLs), but asset records are independent.

### Frozen = deleted from Studio view

- Pros: Clear separation
- Cons: Artist can't duplicate frozen assets
- Rejected: Spec says Artist can still view and duplicate.

## Consequences

- Freeze check is middleware on edit/regenerate/delete endpoints
- `is_marketplace_frozen` boolean is indexed for query performance
- Purchase is a transaction: wallet deduction + asset creation + listing update must all succeed or all rollback
- Race condition prevention: two clients buying same listing must be prevented (DB constraint + transaction)
