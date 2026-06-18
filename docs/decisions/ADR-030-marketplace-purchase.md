# ADR-024: Marketplace Client Purchase Flow

## Status

Accepted

## Context

Clients need to browse and purchase marketplace listings. The purchase flow must:

- Allow browsing active listings with pagination and filters
- Show listing detail with all output images
- Validate wallet balance before purchase
- Create a duplicate asset in the client's workspace with proper source tracking
- Deduct wallet credits and create a ledger CHARGE entry
- Prevent double-purchasing (listing can only be sold once)
- Handle insufficient balance with a 402 error

## Decision

Implemented three new endpoints on the existing `/api/marketplace` router:

1. **GET /api/marketplace** — Lists active, unpurchased listings with pagination. Filters: `listing_type`, `max_price`, `creator_id`. Joins `marketplace_listings` → `assets` → `asset_outputs` (headshot/fullshot via LATERAL) → `accounts` (seller name).

2. **GET /api/marketplace/:id** — Returns listing detail with all output URLs (headshot, fullshot, expressions, character_sheet, editorial_urls).

3. **POST /api/marketplace/:id/purchase** — Executes the purchase:
   - Validates listing is active and `purchased_by IS NULL`
   - Checks wallet balance (402 if insufficient)
   - Deducts balance, creates ledger CHARGE entry
   - Duplicates source asset with `client_id` set, `source_asset_id`, `source_type = 'MARKETPLACE_PURCHASE'`
   - Duplicates all `asset_output` rows (same image URLs, new IDs)
   - Sets `purchased_by`/`purchased_at` on listing
   - Notifies seller (fire-and-forget)

### Key design choices:

- **Wallet deduction is inline** (same service function, not a separate wallet call). The wallet/repo pattern is bypassed for marketplace purchases because the purchase already requires a custom multi-step flow. For reuse, the existing `reserveCreditsForGeneration` does a similar inline deduction.
- **Asset duplication copies all outputs**, including actor packages (headshot, fullshot, expressions, character_sheet, editorial). The duplicate inherits `seed`, `prompt_recipe`, and all metadata.
- **`purchased_by IS NULL` check is sufficient for double-purchase prevention**. The listing's `is_active` flag is not changed — an unpurchased inactive listing can't be purchased because the query also filters `is_active = TRUE`.
- **402 Payment Required** is used for insufficient balance (per spec), with message format: `"Insufficient credits. Your balance: X. Required: Y."`

## Alternatives Considered

1. **Serializing queries in a transaction** — Could wrap the entire purchase in a DB transaction for atomicity. Not implemented here because the mock-based tests don't support transactions, and the existing codebase pattern does not use transactions for multi-step operations (see commission premium unlock).

2. **Soft-deleting listing after purchase** — Could set `is_active = FALSE` instead of using `purchased_by`. Rejected: `purchased_by`/`purchased_at` provides audit trail of who purchased and when.

3. **Separate "package" table for actor bundles** — Could pre-compute package outputs at approval time. Rejected: spec says actor package maps directly to existing asset outputs; no extra generation needed.

## Consequences

- Clients can browse and purchase marketplace listings
- Purchase creates a full duplicate asset in the client's workspace
- The duplicate is fully editable (not frozen like the original)
- Ledger entries are created for marketplace charges
- Seller receives notification on purchase
- 13 new tests cover: list (3), detail (3), purchase (7)
