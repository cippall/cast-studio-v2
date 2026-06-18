# Implementation Plan: Fix All Current Issues

## Overview

Code review identified 4 build-breaking TypeScript errors (masked by a single syntax error), 1 functional bug (soft-delete filter removed but feature still active), 9 dead-code/unused-import warnings, and 30+ AGENTS.md file/function size violations. All 437 server tests and 2 client tests pass, and the client typechecks clean — but the server cannot compile due to the syntax error in seed.ts.

## Architecture Decisions

- **Fix errors bottom-up**: The seed.ts syntax error masks 3 other TS errors. Fix it first, then fix the newly-surfaced errors.
- **Soft-delete is a real feature**: `softDeleteAsset()` is actively called by `look-service.ts` and `actor-service.ts`, and `deleted_at` exists in migration 001. The filters were accidentally removed (comment says "column doesn't exist yet" — false). Restore them.
- **File/function size violations are technical debt**: They don't break anything today but violate AGENTS.md. Defer to a separate phase after critical fixes.

## Issue Inventory

### Critical — Server won't compile (tsc fails)

| #   | File                                                | Issue                                                                                                                      |
| --- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| C1  | `server/src/db/seed.ts:230`                         | Missing `=>` in arrow function. `): Promise<string> {` → `): Promise<string> => {`                                         |
| C2  | `server/src/db/repositories/wallet-repo.ts:2`       | Wrong import path: `'../middleware/requireSession.js'` → `'../../middleware/requireSession.js'`                            |
| C3  | `server/src/db/repositories/asset-repo.ts:188`      | `_includeDeleted` destructured from `ListAssetOptions` but type has `includeDeleted` (no underscore). Parameter is unused. |
| C4  | `server/src/routes/admin/admin.ts` (16 occurrences) | `catch {` without parameter but `err` referenced inside. All 16 catch blocks need `catch (err) {`.                         |

### High — Functional bug

| #   | File                                       | Issue                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | `server/src/db/repositories/asset-repo.ts` | Soft-delete filter commented out in `listAssets()` (line 208) and `findAssetById()` (line 163). Comment says "column doesn't exist yet" but `deleted_at` exists in migration 001. `softDeleteAsset()` is actively used → soft-deleted assets appear in lists. |

### Medium — Dead code / lint warnings

| #   | File                                                | Issue                                                                               |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| L1  | `server/src/routes/wallet.ts:7`                     | `import * as walletRepo` unused (StripeWebhookNotFoundError moved to direct import) |
| L2  | `server/src/db/repositories/wallet-repo.ts:3`       | `StripeWebhookNotFoundError` imported but unused                                    |
| L3  | `server/src/services/commission-service.ts:14`      | `setAssetOwnership, setAssetOwnershipBulk` imported but unused                      |
| L4  | `server/src/services/commission-service.ts:24`      | `import * as walletRepo` unused                                                     |
| L5  | `server/src/services/generation-service.ts:8`       | `getDownstreamLayouts` imported but unused                                          |
| L6  | `server/src/services/marketplace-service.ts:1`      | `findAssetById` imported but unused                                                 |
| L7  | `server/src/services/fal-service.ts:35`             | `params` parameter unused (should be `_params` or removed)                          |
| L8  | `server/src/routes/wallet.ts:77`                    | `any` type (should be typed)                                                        |
| L9  | `server/src/services/commission-service.ts:107,237` | `any` type (2 occurrences)                                                          |

### Low — AGENTS.md violations (technical debt)

| Category            | Count       | Details                                                                                  |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------- |
| Files >200 lines    | 23 files    | Worst: `marketplace-service.ts` (1112), `asset-repo.ts` (723), `ActorDesigner.tsx` (612) |
| Functions >50 lines | 6 functions | Worst: `seed()` (463 lines), `listAssets()` (104 lines)                                  |

### Low — Uncommitted work

| #   | Item                                                                | Action |
| --- | ------------------------------------------------------------------- | ------ |
| U1  | ADR renumbering: 4 old ADRs deleted, 4 new ADRs (030-034) untracked | Commit |
| U2  | `integration.test.ts` split into 2 files                            | Commit |
| U3  | Performance indexes migration (005)                                 | Commit |
| U4  | Route-level code splitting (lazy imports + PageSkeleton)            | Commit |
| U5  | Image width/height attributes for CLS prevention                    | Commit |
| U6  | Wallet cache in wallet-repo.ts                                      | Commit |
| U7  | Local storage async mkdir                                           | Commit |
| U8  | `SESSION-RESUME.md` deleted                                         | Commit |

## Task List

### Phase 1: Fix build-breaking TypeScript errors

- [ ] **Task 1**: Fix seed.ts arrow function syntax (C1)
  - Add missing `=>` on line 230
  - **Verify**: `npx tsc --noEmit` surfaces remaining errors (C2, C3, C4) instead of bailing
  - Scope: S (1 file, 1 line)

- [ ] **Task 2**: Fix wallet-repo.ts import path (C2)
  - Change `'../middleware/requireSession.js'` to `'../../middleware/requireSession.js'` on line 2
  - **Verify**: `npx tsc --noEmit` no longer reports this error
  - Scope: S (1 file, 1 line)

- [ ] **Task 3**: Fix asset-repo.ts \_includeDeleted type error (C3)
  - Remove `_includeDeleted = false` from destructuring at line 188 (parameter is unused — filter is commented out)
  - Also remove `_includeDeleted = false` from `findAssetById` at line 152 (same issue)
  - Remove `includeDeleted?: boolean` from `ListAssetOptions` interface (line 69) since it's not used
  - **Verify**: `npx tsc --noEmit` no longer reports this error
  - Scope: S (1 file, 3 lines removed)

- [ ] **Task 4**: Fix admin.ts catch blocks (C4)
  - Change all 16 `catch {` to `catch (err) {` in `server/src/routes/admin/admin.ts`
  - **Verify**: `npx tsc --noEmit` passes clean (0 errors)
  - Scope: S (1 file, 16 lines)

### Checkpoint: Server compiles

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] All 437 tests still pass: `npx vitest run`
- [ ] ESLint errors reduced to 0 (warnings may remain)
- [ ] Review with human before proceeding

### Phase 2: Fix soft-delete bug

- [ ] **Task 5**: Restore deleted_at filters in asset-repo (H1)
  - Uncomment and fix the `deleted_at IS NULL` filter in `listAssets()` (line 208)
  - Uncomment and fix the `deleted_at IS NULL` filter in `findAssetById()` (line 163)
  - Remove incorrect comment "column doesn't exist yet"
  - Add `includeDeleted?: boolean` parameter back to both functions with proper filtering logic
  - Write test: soft-deleted asset does not appear in `listAssets()` results
  - Write test: soft-deleted asset does not appear in `findAssetById()` results
  - Write test: `includeDeleted: true` returns soft-deleted assets
  - **Verify**: New tests pass, existing tests still pass
  - Scope: M (1 file + test file)

### Checkpoint: Soft-delete works correctly

- [ ] New tests pass
- [ ] All existing tests pass
- [ ] Review with human before proceeding

### Phase 3: Clean up dead code and lint warnings

- [ ] **Task 6**: Remove unused imports (L1-L6)
  - Remove `import * as walletRepo` from `server/src/routes/wallet.ts:7`
  - Remove `import { StripeWebhookNotFoundError }` from `server/src/db/repositories/wallet-repo.ts:3`
  - Remove `setAssetOwnership, setAssetOwnershipBulk` from `server/src/services/commission-service.ts:14`
  - Remove `import * as walletRepo` from `server/src/services/commission-service.ts:24`
  - Remove `getDownstreamLayouts` from `server/src/services/generation-service.ts:8`
  - Remove `findAssetById` from `server/src/services/marketplace-service.ts:1`
  - **Verify**: `npx eslint src --ext .ts` shows 0 unused-import warnings for these
  - Scope: S (6 files, 6 lines removed)

- [ ] **Task 7**: Fix unused parameter and `any` types (L7-L9)
  - Prefix `params` with `_` in `server/src/services/fal-service.ts:35`
  - Type the `any` in `server/src/routes/wallet.ts:77` (check what shape the stripe event has)
  - Type the `any` in `server/src/services/commission-service.ts:107` and `:237`
  - **Verify**: `npx eslint src --ext .ts` shows 0 warnings
  - Scope: M (3 files, 4 lines)

### Checkpoint: Clean lint

- [ ] `npx eslint src --ext .ts` shows 0 errors, 0 warnings
- [ ] `npx tsc --noEmit` passes
- [ ] All tests pass
- [ ] Review with human before proceeding

### Phase 4: Commit uncommitted work

- [ ] **Task 8**: Stage and commit all uncommitted changes
  - Verify all changes are intentional (review git diff)
  - Commit with message: `fix: TypeScript errors, soft-delete filter, dead code cleanup, performance optimizations`
  - Include: ADR renumbering, integration test split, performance indexes, route code splitting, image CLS fixes, wallet cache, async storage
  - **Verify**: `git status` is clean
  - Scope: S (git operations only)

### Phase 5: File size violations (deferred — technical debt)

- [ ] **Task 9**: Split `marketplace-service.ts` (1112 lines → target <200 each)
  - Extract validation helpers, listing operations, purchase operations, admin operations into separate modules
  - **Verify**: All marketplace tests pass after split
  - Scope: L (5+ files)

- [ ] **Task 10**: Split `asset-repo.ts` (723 lines → target <200 each)
  - Extract CRUD, listing, permissions, versions, soft-delete into separate modules
  - **Verify**: All asset-related tests pass after split
  - Scope: L (4+ files)

- [ ] **Task 11**: Split large client pages (ActorDesigner 612, LookDesigner 595, ActorPage 511, FashionItemCreator 465)
  - Extract sub-components, hooks, and sections into separate files
  - **Verify**: Client typecheck passes, manual UI verification
  - Scope: L (8+ files)

- [ ] **Task 12**: Split remaining files over 200 lines
  - `seed.ts` (516), `actors.ts` (444), `generation-service.ts` (436), `look-service.ts` (356), `fashion-item-service.ts` (352), `commission-service.ts` (351), `TaxonomyPage.tsx` (318), `useAdmin.ts` (318), `actor-service.ts` (301), `useMarketplace.ts` (297), `FashionItemLibrary.tsx` (283), `admin.ts` (282), `LookDetail.tsx` (273)
  - **Verify**: All tests pass after each split
  - Scope: XL (defer — tackle after Tasks 9-11)

### Phase 6: Function length violations (deferred — technical debt)

- [ ] **Task 13**: Refactor `seed()` function (463 lines → multiple helper functions)
  - Already partially done (insertAsset helper exists). Extract more helpers for each section.
  - Scope: M

- [ ] **Task 14**: Refactor `listAssets()` (104 lines → query builder helper)
  - Extract condition-building logic into a helper function
  - Scope: M

- [ ] **Task 15**: Refactor remaining functions over 50 lines
  - `listCommissions()` (62), `pollJob()` (63), `processWorkflow()` (57), `listNotifications()` (51)
  - Scope: M

## Risks and Mitigations

| Risk                                                                            | Impact | Mitigation                                      |
| ------------------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| Restoring `deleted_at` filter breaks existing tests that don't expect filtering | Medium | Run tests after fix; update test data if needed |
| Removing unused imports reveals hidden usage via re-exports                     | Low    | Check grep for all usages before removing       |
| File splitting introduces import path errors                                    | Medium | Run tsc + tests after each split                |
| Uncommitted work includes unintended changes                                    | Medium | Review git diff carefully before committing     |

## Open Questions

1. **Soft-delete scope**: Should `deleted_at IS NULL` be added to ALL queries (marketplace listings, commissions, etc.) or just asset queries? Currently only `listAssets` and `findAssetById` are affected.
2. **Phase 5-6 priority**: Should file/function splitting be done now or deferred to a dedicated refactoring sprint? The code works; these are AGENTS.md compliance issues.
