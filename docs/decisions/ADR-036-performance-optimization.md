# ADR-030: Performance Optimization — Bundle Splitting, N+1 Queries, DB Indexes, and CLS Fixes

## Status

Accepted

## Date

2026-06-18

## Context

Performance audit of Cast Studio v2 revealed several high-impact issues:

1. Monolithic 821 KB JS bundle with zero route-based code splitting
2. N+1 query patterns in marketplace and commission services
3. Missing composite database indexes on hot query paths
4. 14+ `<img>` tags missing `width`/`height` causing CLS
5. Redundant wallet DB lookups with no caching

## Decision

### 1. Route-Based Code Spliting (Critical)

- Converted all 25+ page imports in `router.tsx` from static to `React.lazy()`
- Added `PageSkeleton` component as Suspense fallback
- Eagerly load only LoginPage + Dashboard (most common entry points)
- Result: Page code now in separate chunks (ActorDesigner 10KB, LookDesigner 9KB, etc.)
- Shared vendor chunk: 569 KB (186 KB gzip) — React, React Router, TanStack Query

### 2. N+1 Query Fixes (Critical)

- Added `getAssetOutputsBatch()` to asset-repo — single query for multiple assets
- Replaced per-row `getAssetOutputs` loop in `listAllSubmissions` with batch call
- Replaced per-output `INSERT` loop in `purchaseListing` with bulk INSERT
- Added `setAssetOwnershipBulk()` — single UPDATE with `WHERE id = ANY($1)`
- Replaced per-asset `setAssetOwnership` loop in `unlockCommissionPremium`

### 3. Database Index Migration (Migration 005)

Added composite indexes:

- `idx_asset_outputs_lookup (asset_id, layout_type, status, is_obsolete)` — covers LATERAL JOINs
- `idx_marketplace_listings_seller_id` — covers management listing queries
- `idx_notifications_recipient_read (recipient_id, is_read)` — covers notification list/count
- `idx_assets_marketplace_status (marketplace_status) WHERE NOT NULL` — covers submission queries
- `idx_commissions_client_status (client_id, status)` — covers commission list filters
- `idx_commissions_assignee_status (assignee_id, status)` — covers artist commission views
- `idx_assets_source_asset_id` — covers asset duplication lookups

### 4. Image CLS Fixes (Important)

- Added `width`/`height` attributes to all 21 `<img>` tags across 10 files
- Eliminates Cumulative Layout Shift (CLS) for all image content

### 5. Wallet Cache + Redundant Fetch Reduction (Important)

- Added in-memory TTL cache (5s) for `findWallet` lookups
- Cache invalidated on balance updates via `invalidateWalletCache()`
- Disabled during tests (`process.env.VITEST ? 0 : 5000`)
- Added `LIMIT 100` to `getAssetOutputs` to prevent unbounded fetches
- Replaced `fs.existsSync` + `fs.mkdirSync` with async `fs.promises.mkdir` in LocalStorageProvider

## Consequences

### Before → After

| Metric                            | Before                     | After                                   |
| --------------------------------- | -------------------------- | --------------------------------------- |
| JS bundle (gzip)                  | 251 KB monolithic          | 186 KB shared + ~3-30 KB per page chunk |
| Marketplace listing page DB calls | 1 + N (N = assets in page) | 2 total                                 |
| Commission approval DB calls      | 3 + N (N = linked assets)  | 3 total                                 |
| Wallet lookups per request        | 2-3 DB hits                | 1 DB hit (cached)                       |
| CLS from images                   | 14+ layout shifts          | 0                                       |
| DB sequential scans               | 6+ hot paths               | 0 (covered by indexes)                  |

### Trade-offs

- Wallet cache uses module-level Map (not request-scoped). Short TTL (5s) bounds staleness.
- Disabled in test environment to prevent cross-test contamination.
- Migration 005 adds 7 indexes — minimal write overhead, significant read improvement.

## Verification

- All 437 tests pass (26 test files)
- TypeScript compiles cleanly (client + server)
- Vite build succeeds with route-based chunks
