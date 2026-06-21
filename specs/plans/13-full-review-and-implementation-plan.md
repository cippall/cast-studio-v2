# Full Code Review & Implementation Plan

## Review Date: 2026-06-21

## Reviewers: Frontend, Backend, Taxonomy/Feature (3 parallel subagents)

## Scope: 272 source files, ~34,500 lines (client + server)

---

## EXECUTIVE SUMMARY

Cast Studio v2 has a solid architectural foundation and most major feature areas are implemented. However, there are **5 critical bugs**, **~20 important issues**, and **~15 missing features** that prevent this from being a complete product. The most impactful gaps are:

1. Marketplace purchase transfers instead of duplicating (data loss)
2. All 3 library filter UIs use hardcoded values instead of admin-managed taxonomy
3. Look Designer reference extraction is fake (no vision model call)
4. No credit rollback on multi-output generation partial failure
5. No idempotency on premium unlock (double-charge risk)

---

## P0 — CRITICAL (Broken Core Functionality)

### C1: Marketplace purchase transfers asset instead of duplicating

- **Files:** `server/src/services/marketplace/purchase.ts:96-99`
- **Spec:** system.md line 157-163 — "a duplicate is created in their workspace"
- **Bug:** `UPDATE assets SET client_id=$1 WHERE id=$2` transfers the original. Studio loses the asset. `duplicateAsset()` exists in asset-repo.ts:106 but is never called.
- **Fix:** Use `duplicateAsset()` + `duplicateAssetOutputs()` to create a new asset row with `source_type='MARKETPLACE_PURCHASE'`, `source_asset_id` pointing to original. Original stays frozen in Studio. Only set `client_id` on the duplicate.
- **Impact:** Without this, every marketplace sale loses the Studio their asset. Completely broken.

### C2: No idempotency on commission premium unlock

- **Files:** `server/src/services/commission-service.ts:230-233`
- **Bug:** If client retries after timeout, `unlockCommissionPremium()` runs twice — double wallet deduction + double client_id set.
- **Fix:** Add `is_premium_unlocked` boolean or check `client_id IS NOT NULL` before executing unlock. Use a transaction.
- **Impact:** Real money loss on network issues.

### C3: Multi-output generation partial failure leaves orphan PENDING rows

- **Files:** `server/src/services/generation/generate.ts:134-204`
- **Bug:** If output 2 of 3 fails, output 1 stays PENDING forever. The error propagates, client never gets the fal_job_id for output 1.
- **Fix:** On any failure in the loop, update ALL remaining outputs to FAILED. Store fal_job_id before submit so client can poll. Wrap in a transaction.
- **Impact:** Users see permanent "generating" state after a failure.

### C4: Look Designer reference extraction is fake (no vision model)

- **Files:** `client/src/pages/looks/LookDesignerStep1.tsx:75`
- **Bug:** Hardcoded `['Jacket', 'Shirt', 'Pants', 'Shoes', 'Watch']`. No vision API call.
- **Spec:** system.md line 86 — "vision model identifies clothing pieces"
- **Fix:** Call fal.ai image_to_text model on reference image, parse clothing pieces from response, populate extracted pieces checkboxes. Backend endpoint needed: `POST /api/looks/extract-reference`.
- **Impact:** Core feature (reference-based look creation) is non-functional.

### C5: All 3 library filters hardcoded (not admin-managed)

- **Files:**
  - `client/src/pages/actors/ActorLibrary.tsx:22-61` — ACTOR_FILTER_GROUPS hardcoded
  - `client/src/pages/looks/LookLibrary.tsx:22-78` — LOOK_FILTER_GROUPS hardcoded
  - `client/src/pages/fashion-items/FashionItemLibrary.tsx:22-89` — FASHION_FILTER_GROUPS hardcoded
- **Spec:** system.md line 218, 233 — "All taxonomy is admin-managed"
- **Fix:** Replace hardcoded constants with fetch from `/api/admin/taxonomy?category=ACTOR_PROPERTY` (and LOOK_TAXONOMY, FASHION_ITEM_TAXONOMY). FilterPanel already accepts dynamic groups — only the data source changes.
- **Impact:** Admin cannot customize filter categories. Taxonomy CRUD exists but is unused by frontend.

---

## P1 — HIGH (Must Fix Before Ship)

### I1: Wallet cache not invalidated after purchase

- **Files:** `server/src/services/marketplace/purchase.ts:83-87`
- **Bug:** `purchaseListing` uses raw `dbClient.query` UPDATE, bypassing `updateWalletBalance` which does cache invalidation.
- **Fix:** Call `invalidateWalletCacheEntry(walletId)` after purchase UPDATE. Same issue in `unlockCommissionPremium`.

### I2: Race condition in reserveCreditsForGeneration

- **Files:** `server/src/db/repositories/wallet-repo.ts:214-241`
- **Bug:** `findWallet` (cached) checks balance, then `updateWalletBalance` does non-atomic UPDATE. Two concurrent requests can both pass balance check.
- **Fix:** Use `SELECT ... FOR UPDATE` or atomic `UPDATE ... WHERE balance_credits >= amount RETURNING balance_credits`. Check rowCount.

### I3: Stage 3 taxonomy fields are read-only (not editable)

- **Files:** `client/src/components/actor-designer/Stage3.tsx:46-54`
- **Spec:** ui-spec.md line 216 — editable dynamic fields from admin taxonomy
- **Bug:** Stage 3 displays values as read-only cards. Only populated for FORM entry method. TEXT/REFERENCE methods show empty.
- **Fix:** Render `ActorFormFields` component in Stage 3 (editable mode). Store values in `prompt_recipe.identity` for all entry methods.

### I4: fal.ai model name in URL — SSRF vector

- **Files:** `server/src/services/fal/api.ts:9-27`
- **Bug:** `model` from user input is interpolated into URL: `https://queue.fal.run/${model}`. Path traversal possible.
- **Fix:** Validate `model` against whitelist of known models (from DB `models` table). Reject anything not in the list.

### I5: Admin Commission Assign dialog is a placeholder

- **Files:** `client/src/pages/commissions/CommissionDetail.tsx:263-265`
- **Bug:** Shows "use the admin API directly" instead of artist selector.
- **Fix:** Build proper artist selector component that lists API-enabled Artists in the workspace. Wire to `assignCommission` API call.

### I6: CommissionFormsPage "New Form" is disabled

- **Files:** `client/src/pages/settings/CommissionFormsPage.tsx:53-63`
- **Spec:** system.md line 379 — Admin manages commission form templates
- **Bug:** Button disabled with "Coming Soon" tooltip.
- **Fix:** Build commission form template CRUD (backend + frontend). Template defines: fields, types, required, options.

### I7: Missing Character Sheet Look selector UI on Actor page

- **Files:** `client/src/pages/actors/useActorPage.ts:101`
- **Spec:** ui-spec.md line 269 — "Select Look: [Dropdown] [Generate]"
- **Bug:** Backend `generateCharacterSheet()` exists but no frontend component for the Look selector dropdown.
- **Fix:** Add Look selector on Actor page that fetches workspace Look library, allows selection, calls generate.

### I8: Obsolete asset banner not rendered in frontend

- **Files:** `client/src/pages/actors/useActorPageRender.tsx`
- **Spec:** system.md line 71 — "Obsolete assets show an explanatory banner with inline regenerate button"
- **Bug:** Backend sets `is_obsolete` + `obsolete_reason` but no frontend component renders the banner.
- **Fix:** Add `ObsoleteBanner` component that appears when `output.is_obsolete === true`, shows reason text + inline Regenerate button.

### I9: Taxonomy filter backend only works for FORM actors

- **Files:** `server/src/db/repositories/asset-repo.ts:242`
- **Bug:** Filters query `prompt_recipe -> 'identity' ->> $key` which only has data for FORM entry method actors.
- **Fix:** Add a dedicated `taxonomy_values` JSONB column on `assets` table. Populate it for all entry methods. Update filter queries to use this column.

### I10: getAssetOutputs has no workspace filter

- **Files:** `server/src/db/repositories/asset-repo.ts:365-371`
- **Bug:** `SELECT * FROM asset_outputs WHERE asset_id = $1` — no workspace check.
- **Fix:** Add workspace filter via JOIN to assets table, or verify all callers check access first.

### I11: SESSION_SECRET fallback in non-production

- **Files:** `server/src/server.ts:45-50`
- **Bug:** Falls back to hardcoded `'cast-studio-dev-secret-change-in-production'` if env var missing.
- **Fix:** Throw error if `NODE_ENV === 'production'` and `SESSION_SECRET` is missing. Already partially implemented but verify.

### I12: Admin route protection not at router level

- **Files:** `server/src/routes/admin/admin.ts`
- **Bug:** Each sub-route duplicates admin check instead of `router.use(adminCheck)`.
- **Fix:** Add `router.use(requireAdmin)` middleware in admin.ts after line 25.

### I13: DELETE endpoints don't check rowCount (admin models/taxonomy)

- **Files:**
  - `server/src/routes/admin/model-routes.ts:138-146`
  - `server/src/routes/admin/taxonomy-routes.ts:141-151`
- **Bug:** Always return `{ success: true }` even when ID doesn't exist.
- **Fix:** Check `result.rowCount === 0` and return 404.

### I14: Marketplace submission checks wrong required outputs

- **Files:** `client/src/pages/actors/useActorPage.ts:101`
- **Bug:** Only checks `['headshot', 'fullshot', 'expressions_3x4']`. Spec says admin-configured required outputs from Listings Settings.
- **Fix:** Fetch `marketplace_settings` and check against `actor_package.required_outputs`.

### I15: Randomize entry method missing

- **Files:** `client/src/components/actor-designer/Stage1.tsx:12-31`
- **Spec:** system.md line 59 — 4 entry methods including "Randomize (grid of 6-8 random base identities)"
- **Bug:** Only 3 entry methods. `EntryMethod` type missing `'RANDOMIZE'`.
- **Fix:** Add 4th option card. Generate random identities using system prompt variations. Add to type union.

### I16: Multi-value filter silently dropped in all libraries

- **Files:**
  - `client/src/pages/actors/ActorLibrary.tsx:113`
  - `client/src/pages/looks/LookLibrary.tsx:113`
  - `client/src/pages/fashion-items/FashionItemLibrary.tsx:113`
- **Bug:** `if (vals.length === 1) result[key] = vals[0]` — multi-select sends nothing.
- **Fix:** Send array directly: `result[key] = vals`. Backend must support array filter values.

---

## P2 — MEDIUM (Missing Features / Partial Implementations)

### M1: Missing admin features

- **Commission Form Templates CRUD** — No routes, no UI. Backend type exists but no implementation.
- **User & Roles management** — No admin routes for listing/editing users across workspaces.
- **API Key admin oversight** — No admin route to view/manage other users' API keys.
- **Notification management** — No admin notification management UI.

### M2: Taxonomy input types incomplete

- **Files:** `client/src/pages/settings/TaxonomyPage.tsx:39-44`
- **Missing:** SLIDER and MULTI_SELECT from INPUT_TYPES. DB supports them but admin UI doesn't.
- **Fix:** Add SLIDER (with min/max/step config) and MULTI_SELECT to input types. Update ActorFormFields to render them.

### M3: Code duplication — LookDetail and FashionItemDetail

- **Files:**
  - `client/src/pages/looks/LookDetail.tsx` (~300 lines)
  - `client/src/pages/fashion-items/FashionItemDetail.tsx` (~300 lines)
- **Fix:** Extract shared `SingleAssetDetail` component. Both pages use SingleAssetLayout already.

### M4: Code duplication — All 3 library pages

- **Files:**
  - `client/src/pages/actors/ActorLibrary.tsx` (293 lines)
  - `client/src/pages/looks/LookLibrary.tsx` (302 lines)
  - `client/src/pages/fashion-items/FashionItemLibrary.tsx` (314 lines)
- **Fix:** Create `LibraryPage` generic component with configurable filter groups, card renderer, and API hook.

### M5: File size violations (>200 lines)

- `useActorDesignerState.ts` — 431 lines
- `SettingsPage.tsx` — 393 lines
- `TaxonomyPage.tsx` — 335 lines
- `ActorLibrary.tsx` — 293 lines
- `LookLibrary.tsx` — 302 lines
- `FashionItemLibrary.tsx` — 314 lines
- **Fix:** Split into smaller modules. Extract hooks, sub-components, and constants.

### M6: Marketplace missing search and price filter

- **Files:** `client/src/pages/marketplace/MarketplacePage.tsx`
- **Spec:** ui-spec.md line 477 — search input + price filter
- **Fix:** Add search input (filters by asset name) and price range filter.

### M7: Dashboard issues

- **Quick Actions only shows 3 of 4** — `Dashboard.tsx:174` uses `slice(0, 3)`. Client should see 4.
- **"View All" button is dead** — `Dashboard.tsx:205` has no onClick handler.
- **Duplicate JSDoc comment** — `Dashboard.tsx:1-2` has `/**` twice.

### M8: Notification navigation incomplete

- **Files:** `client/src/components/NotificationDropdown.tsx:95-99`
- **Bug:** Only handles COMMISSION and ASSET type prefixes. Missing MARKETPLACE, COLLECTION, etc.
- **Fix:** Add handlers for all notification types.

### M9: MarketplaceManage/AdminSubmissions don't handle FASHION_ITEM type

- **Files:**
  - `client/src/pages/marketplace/MarketplaceManage.tsx:97`
  - `client/src/pages/admin/AdminSubmissions.tsx:100`
- **Bug:** Type check only handles ACTOR and LOOK.
- **Fix:** Add FASHION_ITEM case.

### M10: Stage3 uses hardcoded Tailwind colors

- **Files:** `client/src/components/actor-designer/Stage3.tsx:47-53`
- **Bug:** Uses `neutral-200/500/900` instead of design tokens (`border-border`, `text-muted-foreground`).
- **Fix:** Replace with CSS variable-based classes.

### M11: SchemaField uses hardcoded hex colors

- **Files:** `client/src/components/SchemaField.tsx`
- **Bug:** Uses `#A8A29E`, `#57534E`, `#D6D3D1` etc. instead of CSS variables.
- **Fix:** Replace with `var(--secondary)`, `var(--text-secondary)`, `var(--border-medium)`.

### M12: TopBar component exists but isn't used

- **Files:** `client/src/components/TopBar.tsx`
- **Spec:** "No top bar — all controls live in the sidebar"
- **Fix:** Remove TopBar.tsx. It's dead code.

### M13: window.location.href usage causes full page reloads

- **Files:**
  - `client/src/pages/marketplace/MarketplacePage.tsx:127`
  - `client/src/components/layout/LibraryLayout.tsx:103`
- **Fix:** Use React Router's `navigate()` instead.

### M14: Missing MARKETPLACE_DELISTED status handling

- **Files:** `client/src/pages/actors/useActorPageRender.tsx:108`
- **Bug:** Only handles PENDING, APPROVED, REJECTED. Missing DELISTED.
- **Fix:** Add DELISTED case to statusBadge.

---

## P3 — LOW (Polish)

- Add `COMMISSION_FIELD` to CATEGORY_LABELS in TaxonomyPage
- Add `MULTI_SELECT` support to TaxonomyPage and ActorFormFields
- Add `is_premium_unlocked` column to commissions for idempotency
- Add `sold_at` to initial schema or document migration dependency
- Standardize error handling across frontend (some use `instanceof Error`, others use type assertions)
- Remove unused TopBar component
- Add FAL_KEY warning on startup when missing
- Add upload route asset_id validation
- Add FAL_KEY_ENCRYPTION_KEY warning in encryption.ts

---

## ADDITIONAL FINDINGS FROM CROSS-CHECK

### UNIQUE Constraints

- `asset_output_versions` has NO unique constraint on `(asset_output_id, version)` — it only has a non-unique index. This means the same version could be inserted twice for the same output. The `ON CONFLICT` in the upsert will never fire.
- **Fix:** Add `UNIQUE (asset_output_id, version)` to the table definition.

### Migration Idempotency

- `CREATE TABLE IF NOT EXISTS` is used in all `.up.sql` files. This means if a migration needs to ADD a COLUMN or change a constraint, it won't work — the table already exists and the migration is silently skipped.
- **Impact:** Migrations 002-011 that alter existing tables (like `003_workflow_steps_column`, `004_marketplace_settings`, `007_marketplace_sold_at`) use ALTER TABLE which is fine. But the IF NOT EXISTS on CREATE TABLE in all migrations means running `migrate up` twice will silently skip table creation but won't re-create if schema changes. This is acceptable for the current migration numbering but worth noting.

### Test Infrastructure

- **Server vitest config** has NO `maxThreads: 1` setting (checklist requires it for shared DB). Tests use `mock-pool.ts` which mocks the pool, so concurrent test execution doesn't hit real DB. This is fine — the mock approach avoids the SQLite/Vitest threading issue.
- **No test cleanup (`afterAll`)** in server tests. Since tests use mocks (not a real DB), cleanup isn't needed. Acceptable.
- **Client tests** use mock data URLs (no real HTTP calls). `http://example.com` in fixtures — fine.
- `vi.mock('../src/db/pool.js')` pattern is used consistently across server tests.

### Asset Versions Table Missing UNIQUE

The `asset_output_versions` table at line 172 of 001_initial_schema.up.sql has:

```sql
CREATE INDEX IF NOT EXISTS idx_asset_output_versions_output_id ON asset_output_versions (asset_output_id);
CREATE INDEX IF NOT EXISTS idx_asset_output_versions_version ON asset_output_versions (version);
CREATE INDEX IF NOT EXISTS idx_asset_output_versions_output_version ON asset_output_versions (asset_output_id, version);
```

But these are regular indexes, not UNIQUE. The upsert query in asset-repo.ts expects `ON CONFLICT (asset_output_id, version)` which requires a unique constraint that doesn't exist.

**Fix:** Add migration 012:

```sql
ALTER TABLE asset_output_versions ADD CONSTRAINT uq_versions_output UNIQUE (asset_output_id, version);
```

### Phase 0: Schema Prerequisite (do first — blocks C1, C3)

0. **Add UNIQUE constraint to asset_output_versions** — Migration 012: `ALTER TABLE asset_output_versions ADD CONSTRAINT uq_versions_output UNIQUE (asset_output_id, version)`. Required before C1 (purchase duplication uses asset_output_versions) and C3 (generation versioning).

### Phase 1: Critical Bug Fixes (blocks everything else)

1. **C1** — Fix marketplace purchase to duplicate (not transfer)
2. **C2** — Add idempotency to premium unlock
3. **C3** — Fix multi-output generation partial failure
4. **C4** — Implement reference extraction vision model call
5. **C5** — Make library filters dynamic from taxonomy API

### Phase 2: Security & Correctness

6. **I4** — Validate fal.ai model name (SSRF prevention)
7. **I1** — Fix wallet cache invalidation
8. **I2** — Fix race condition in credit reservation
9. **I11** — Enforce SESSION_SECRET in production
10. **I12** — Add admin middleware at router level
11. **I13** — Fix DELETE rowCount checks

### Phase 3: Feature Completion

12. **I3** — Make Stage 3 taxonomy fields editable
13. **I7** — Add Character Sheet Look selector UI
14. **I8** — Add obsolete asset banner UI
15. **I15** — Add Randomize entry method
16. **I5** — Build admin commission assign dialog
17. **I6** — Build commission form template CRUD
18. **I16** — Fix multi-value filter in all libraries

### Phase 4: Missing Admin Features

19. **M1** — User & Roles management
20. **M1** — Commission Form Templates
21. **M1** — API Key admin oversight
22. **M6** — Marketplace search + price filter

### Phase 5: Code Quality

23. **M3** — Deduplicate LookDetail/FashionItemDetail
24. **M4** — Deduplicate 3 library pages
25. **M5** — Split oversized files
26. **M2** — Add SLIDER/MULTI_SELECT input types
27. **M7-M14** — Minor frontend fixes

---

## FILES REQUIRING CHANGES (by phase)

### Phase 1

| File                                                    | Change                         |
| ------------------------------------------------------- | ------------------------------ |
| `server/src/services/marketplace/purchase.ts`           | Duplicate asset on purchase    |
| `server/src/services/commission-service.ts`             | Idempotency guard              |
| `server/src/services/generation/generate.ts`            | Rollback on partial failure    |
| `client/src/pages/looks/LookDesignerStep1.tsx`          | Vision model call              |
| `server/src/routes/looks.ts`                            | Add extract-reference endpoint |
| `client/src/pages/actors/ActorLibrary.tsx`              | Dynamic filter groups          |
| `client/src/pages/looks/LookLibrary.tsx`                | Dynamic filter groups          |
| `client/src/pages/fashion-items/FashionItemLibrary.tsx` | Dynamic filter groups          |

### Phase 2

| File                                          | Change                     |
| --------------------------------------------- | -------------------------- |
| `server/src/services/fal/api.ts`              | Model name whitelist       |
| `server/src/services/marketplace/purchase.ts` | Cache invalidation         |
| `server/src/services/commission-service.ts`   | Cache invalidation         |
| `server/src/db/repositories/wallet-repo.ts`   | Atomic balance check       |
| `server/src/server.ts`                        | SESSION_SECRET enforcement |
| `server/src/routes/admin/admin.ts`            | Router-level admin check   |
| `server/src/routes/admin/model-routes.ts`     | rowCount check             |
| `server/src/routes/admin/taxonomy-routes.ts`  | rowCount check             |

### Phase 3

| File                                                | Change                           |
| --------------------------------------------------- | -------------------------------- |
| `client/src/components/actor-designer/Stage3.tsx`   | Editable taxonomy fields         |
| `client/src/pages/actors/useActorPage.ts`           | Look selector + required outputs |
| `client/src/pages/actors/useActorPageRender.tsx`    | Obsolete banner + DELISTED       |
| `client/src/components/actor-designer/Stage1.tsx`   | Randomize method                 |
| `client/src/pages/commissions/CommissionDetail.tsx` | Artist selector                  |
| `client/src/pages/settings/CommissionFormsPage.tsx` | Form template CRUD               |
| `client/src/hooks/useAdminTaxonomy.ts`              | Multi-value filter support       |

---

## TEST COVERAGE GAPS

Current: 37 server test files (good), 7 client test files (poor — 1 is a stub).

**Missing tests:**

- Frontend: ActorDesigner, CollectionDetail, MarketplacePage, CommissionDetail
- Server: No test for purchase duplication, premium unlock idempotency, multi-output rollback
- Integration: End-to-end marketplace purchase flow, commission lifecycle

**Recommendation:** Add tests alongside each fix in phases 1-3. Don't defer all testing to a separate phase.
