# Implementation Plan: Full Repo Review Fixes

## Overview

Fix all issues found during the full-repo code review (review session 2026-06-20).
Covers 5 critical, 10 important, and 10 minor findings. Organized by severity
with vertical slices where possible. File size issues (M-1, M-2) are explicitly
excluded per user direction.

## Architecture Decisions

- **No file size refactoring**: asset-repo.ts (736L) and seed.ts (1028L) are out of scope
- **Vertical slice ordering**: DB schema fixes first (they block everything else), then backend
  service/route fixes, then frontend fixes, then test coverage
- **Each task leaves the system in a working state**: run `npm run typecheck && npm run test:run`
  after each task

---

## Phase 1: Database Schema Fixes

### Task 1: Add FK constraint to collection_items.asset_id

**Description:** Add a foreign key constraint from `collection_items.asset_id` to `assets(id)`
so orphaned collection items cannot exist. This is a new migration (009).

**Acceptance criteria:**

- [ ] New migration `009_collection_items_fk.up.sql` adds `FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE`
- [ ] Corresponding `009_collection_items_fk.down.sql` drops the constraint
- [ ] Migration runs cleanly: `cd server && npx tsx src/db/migrate.ts up`
- [ ] Existing tests still pass

**Verification:**

- [ ] `cd server && npx tsx src/db/migrate.ts up` succeeds
- [ ] `cd server && npx vitest run -- collections` passes
- [ ] `cd server && npx tsc --noEmit` clean

**Dependencies:** None

**Files likely touched:**

- `server/src/db/migrations/009_collection_items_fk.up.sql` (new)
- `server/src/db/migrations/009_collection_items_fk.down.sql` (new)

**Estimated scope:** XS — 2 new files, run migration

---

## Phase 2: Critical Backend Fixes

### Task 2: Fix admin delete endpoints to return 404 when resource not found

**Description:** `DELETE /api/admin/models/:id` and `DELETE /api/admin/taxonomy/:id` always
return `{ success: true }` even when the ID doesn't exist. Check `result.rowCount` and
return 404 for missing resources, consistent with every other delete endpoint.

**Acceptance criteria:**

- [ ] `DELETE /api/admin/models/:id` returns 404 with `{ error: { code: 'NOT_FOUND' } }` when ID doesn't exist
- [ ] `DELETE /api/admin/taxonomy/:id` returns 404 with `{ error: { code: 'NOT_FOUND' } }` when ID doesn't exist
- [ ] Both return 200 with success message when deletion actually happens

**Verification:**

- [ ] `cd server && npx vitest run -- admin` passes (update existing tests if needed)
- [ ] Manual: `curl -X DELETE /api/admin/models/nonexistent-id` returns 404

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/admin/model-routes.ts` (lines 138-146)
- `server/src/routes/admin/taxonomy-routes.ts` (lines 141-151)

**Estimated scope:** S — 2 small changes

---

### Task 3: Implement credit rollback on fal.ai submission failure

**Description:** In `generateActorOutput()`, credits are reserved before fal.ai submission.
If fal.ai fails, the PENDING output row stays in DB but credits are already deducted.
Need to: (a) update the output row to FAILED status, (b) refund the credits, on fal error.

**Acceptance criteria:**

- [ ] When `fal.submitTextToImage()` throws, the corresponding `asset_output` row is updated to `status = 'FAILED'` with the error message
- [ ] Credits are refunded (wallet balance restored, ledger entry created with negative CHARGE or REFUND type)
- [ ] The error propagates to the route handler which returns a proper error response
- [ ] Happy path (fal.ai succeeds) is unchanged

**Verification:**

- [ ] `cd server && npx vitest run -- generation` passes
- [ ] Add a test case: mock fal.ai to throw, verify output row is FAILED and credits refunded

**Dependencies:** None

**Files likely touched:**

- `server/src/services/generation/generate.ts` (lines 127-139)
- `server/src/db/repositories/asset-repo.ts` (add updateAssetOutputStatus if not exists)
- `server/src/db/repositories/wallet-repo.ts` (may need a refund function)

**Estimated scope:** M — 3 files, new test case

---

## Phase 3: Important Backend Fixes

### Task 4: Wire workspace-specific fal.ai keys into generation pipeline

**Description:** `fal/api.ts` reads `process.env.FAL_KEY` (global), but the architecture supports
per-workspace keys in `fal_ai_keys` table. The generation pipeline calls `fal.submitTextToImage()`
directly without passing a workspace key. Need to: (a) pass workspace context through the
generation call chain, (b) use `getWorkspaceApiKey()` from `fal-service.ts` to get the
workspace-specific key, (c) fall back to `FAL_KEY` env var if no workspace key exists.

**Acceptance criteria:**

- [ ] `generateActorOutput()` accepts workspaceId and resolves the fal.ai key per-workspace
- [ ] `fal.submitTextToImage()` uses the workspace key (or falls back to `FAL_KEY`)
- [ ] `fal.pollJob()` uses the workspace key (or falls back to `FAL_KEY`)
- [ ] No behavior change for single-key setups (env var still works)

**Verification:**

- [ ] `cd server && npx vitest run -- generation` passes
- [ ] `cd server && npx vitest run -- fal` passes

**Dependencies:** None (but should be done before Task 3 rollback tests are finalized)

**Files likely touched:**

- `server/src/services/fal/api.ts` (lines 5-7, accept apiKey param)
- `server/src/services/generation/generate.ts` (pass workspace context)
- `server/src/routes/actors.ts` (pass workspaceId to generation service)

**Estimated scope:** M — 3-4 files

---

### Task 5: Pass form_data and reference_images to fal.ai API calls

**Description:** `generateActorOutput()` stores `form_data` and `reference_images` in
`generation_params` but never passes them to `fal.submitTextToImage()`. FORM mode and
REFERENCE mode generations will not work correctly. Need to extend the fal.ai API call
to include these fields.

**Acceptance criteria:**

- [ ] `fal.submitTextToImage()` accepts optional `form_data` and `reference_images` params
- [ ] `generateActorOutput()` passes these through to the fal.ai call
- [ ] REFERENCE mode uses `submitImageToImage` with the reference image URL

**Verification:**

- [ ] `cd server && npx vitest run -- generation` passes
- [ ] Add test: FORM mode sends form_data to fal.ai mock
- [ ] Add test: REFERENCE mode calls submitImageToImage

**Dependencies:** Task 4 (workspace keys) — the fal.ai API signature changes

**Files likely touched:**

- `server/src/services/fal/api.ts` (lines 51-73)
- `server/src/services/generation/generate.ts` (lines 48-65, 127-135)

**Estimated scope:** S — 2 files

---

### Task 6: Fix dashboard admin query to be workspace-scoped

**Description:** Admin dashboard queries count assets across all workspaces. Should filter
by the admin's workspace, or be explicitly global with a comment explaining why.

**Acceptance criteria:**

- [ ] Admin dashboard queries include `workspace_id = $2` filter (or a comment explaining global scope)
- [ ] Artist and CLIENT dashboard queries are unchanged (already workspace-scoped)

**Verification:**

- [ ] `cd server && npx vitest run -- dashboard` passes

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/dashboard.ts` (lines 12-26)

**Estimated scope:** S — 1 file, 4 query changes

---

### Task 7: Fix activity feed to filter by workspace

**Description:** Activity feed queries filter by `creator_id` but not `workspace_id`.
Add workspace filter for consistency with the rest of the codebase.

**Acceptance criteria:**

- [ ] All three activity queries (assets, outputs, shares) include workspace filter
- [ ] Uses `req.account.workspace_id`

**Verification:**

- [ ] `cd server && npx vitest run -- activity` passes (or add activity tests)

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/activity.ts` (lines 19-76)

**Estimated scope:** S — 1 file

---

### Task 8: Scope wallet cache invalidation to specific wallet

**Description:** `invalidateWalletCache()` clears the entire cache on any balance update.
Should be scoped to the specific wallet being updated.

**Acceptance criteria:**

- [ ] `updateWalletBalance()` invalidates only the cache entry for the specific wallet
- [ ] Remove the global `invalidateWalletCache()` export (or keep for emergency use)

**Verification:**

- [ ] `cd server && npx vitest run -- wallet` passes

**Dependencies:** None

**Files likely touched:**

- `server/src/db/repositories/wallet-repo.ts` (lines 31-33, 154-165)

**Estimated scope:** S — 1 file

---

### Task 9: Make SESSION_SECRET required in production

**Description:** If `SESSION_SECRET` is not set, sessions are signed with a hardcoded dev secret.
In production this is a security vulnerability. Throw an error instead of falling back.

**Acceptance criteria:**

- [ ] `server.ts` throws an error if `NODE_ENV=production` and `SESSION_SECRET` is not set
- [ ] Dev mode still works without `SESSION_SECRET` (with a warning log)

**Verification:**

- [ ] `cd server && NODE_ENV=production npx tsx src/server.ts` fails without SESSION_SECRET
- [ ] `cd server && npx tsx src/server.ts` works in dev

**Dependencies:** None

**Files likely touched:**

- `server/src/server.ts` (line 49)

**Estimated scope:** XS — 1 line change

---

### Task 10: Add admin role check at admin router level

**Description:** Each admin sub-route file duplicates the admin role check. Add a single
`router.use(adminCheck)` in `admin.ts` so new sub-routes are automatically protected.

**Acceptance criteria:**

- [ ] `admin.ts` has `router.use((req, res, next) => { if (req.account?.role !== 'ADMIN') return 403 })`
- [ ] Individual sub-route files can remove their duplicate checks (or keep for defense-in-depth)

**Verification:**

- [ ] `cd server && npx vitest run -- admin` passes
- [ ] Non-admin cannot access any admin endpoint

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/admin/admin.ts` (add middleware after line 25)
- Optionally: `server/src/routes/admin/model-routes.ts` (remove duplicate check)
- Optionally: `server/src/routes/admin/taxonomy-routes.ts` (remove duplicate check)

**Estimated scope:** S — 1-3 files

---

### Task 11: Fix collection-service to return 404 for unauthorized collection access

**Description:** `getCollectionItems` returns `[]` when the collection doesn't exist AND when
it has no items. The route handler returns `[]` with 200. Need to distinguish "not found"
from "empty" and return 404 for unauthorized access.

**Acceptance criteria:**

- [ ] `getCollectionItems` and `getCollectionItemsWithAssets` return `null` when collection not found (or throw)
- [ ] Route handler returns 404 when collection doesn't belong to user
- [ ] Empty collection returns `[]` with 200

**Verification:**

- [ ] `cd server && npx vitest run -- collections` passes
- [ ] Add test: accessing another user's collection returns 404

**Dependencies:** None

**Files likely touched:**

- `server/src/services/collection-service.ts` (lines 240-305)
- `server/src/routes/collections.ts` (lines 103-117)

**Estimated scope:** S — 2 files

---

### Task 12: Validate premium_cost for all commission status transitions that need it

**Description:** The `premium_cost` validation only runs when `status === 'SUBMITTED'`.
Review the commission state machine to determine which transitions require `premium_cost`
and add validation for those.

**Acceptance criteria:**

- [ ] Commission state machine documents which transitions require premium_cost
- [ ] Route handler validates premium_cost for all required transitions
- [ ] Zod schema updated if needed

**Verification:**

- [ ] `cd server && npx vitest run -- commissions` passes

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/commissions.ts` (lines 152-170)
- `server/src/services/commission-state-machine.ts` (review)

**Estimated scope:** S — 1-2 files

---

## Phase 4: Frontend Fixes

### Task 13: Verify and fix useCollections hook response handling

**Description:** The `useCollections` hook returns `data` from `apiClient.get()` which is the
axios response object. Need to verify the hook correctly accesses `response.data` (the HTTP body)
and that the types align with the backend's `{ data: [...], pagination: {} }` response shape.

**Acceptance criteria:**

- [ ] `useCollections` returns the correct shape: `{ data: CollectionWithItemCount[], pagination: {...} }`
- [ ] TypeScript types are correct (no `any`)
- [ ] CollectionsPage renders correctly with the data

**Verification:**

- [ ] `cd client && npx tsc --noEmit` clean
- [ ] `cd client && npx vitest run -- collections` passes

**Dependencies:** None

**Files likely touched:**

- `client/src/hooks/useCollections.ts` (lines 14-26)

**Estimated scope:** S — 1 file

---

### Task 14: Replace client.test.ts placeholder with real tests

**Description:** `client/tests/client.test.ts` contains `expect(true).toBe(true)` — a stub.
Replace with at least basic smoke tests for the App component, router, and ProtectedRoute.

**Acceptance criteria:**

- [ ] `client.test.ts` has at least 3 real tests (App renders, ProtectedRoute redirects unauthenticated, router has routes)
- [ ] All tests pass: `cd client && npx vitest run -- client.test.ts`

**Verification:**

- [ ] `cd client && npx vitest run` passes

**Dependencies:** None

**Files likely touched:**

- `client/tests/client.test.ts` (replace entirely)

**Estimated scope:** S — 1 file

---

## Phase 5: Test Coverage Gaps

### Task 15: Add frontend test coverage for key untested pages

**Description:** The client has 174 source files but only 4 test files (1 of which is a stub).
Add tests for the most critical pages: ActorDesigner, CollectionDetail, MarketplacePage,
CommissionDetail.

**Acceptance criteria:**

- [ ] New test file for ActorDesigner smoke test (renders without crashing, mocks API)
- [ ] New test file for CollectionDetail (list items, add item, remove item)
- [ ] All new tests pass

**Verification:**

- [ ] `cd client && npx vitest run` passes
- [ ] Coverage report shows improvement

**Dependencies:** None (can be done in parallel with other tasks)

**Files likely touched:**

- `client/tests/actor-designer.test.tsx` (verify existing or add missing tests)
- `client/tests/collection-detail.test.tsx` (new)
- `client/tests/marketplace.test.tsx` (new, if time permits)

**Estimated scope:** M — 2-3 new test files

---

## Phase 6: Minor Fixes

### Task 16: Add warning log for fal.ai simulated mode

**Description:** When `FAL_KEY` is not set, fal.ai returns a 1px transparent PNG silently.
Add a console.warn on server startup when FAL_KEY is missing so developers know they're
in simulated mode.

**Acceptance criteria:**

- [ ] Server logs `warn: fal.ai running in simulated mode — FAL_KEY not set` on startup
- [ ] No behavior change

**Verification:**

- [ ] Start server without FAL_KEY, check logs

**Dependencies:** None

**Files likely touched:**

- `server/src/services/fal/api.ts` (add warn in getApiKey)
- Or `server/src/server.ts` (check on startup)

**Estimated scope:** XS — 1 line

---

### Task 17: Validate asset_id in upload route

**Description:** The upload route accepts `asset_id` from req.body and uses it in the filename
but never validates it exists in the DB. Add a validation check.

**Acceptance criteria:**

- [ ] If `asset_id` is provided but doesn't exist in DB, return 404
- [ ] If `asset_id` is not provided, upload still works (it's optional)

**Verification:**

- [ ] `cd server && npx vitest run -- upload` passes

**Dependencies:** None

**Files likely touched:**

- `server/src/routes/upload.ts` (lines 123-124)

**Estimated scope:** S — 1 file

---

### Task 18: Add FAL_KEY_ENCRYPTION_KEY warning in encryption.ts

**Description:** If `FAL_KEY_ENCRYPTION_KEY` is not set, the encryption key is derived from
`SESSION_SECRET`. If the session secret changes, encrypted fal.ai keys become unrecoverable.
Add a warning log.

**Acceptance criteria:**

- [ ] Server logs `warn: FAL_KEY_ENCRYPTION_KEY not set — using derived key from SESSION_SECRET. Changing SESSION_SECRET will invalidate encrypted fal.ai keys.`

**Verification:**

- [ ] Start server without FAL_KEY_ENCRYPTION_KEY, check logs

**Dependencies:** None

**Files likely touched:**

- `server/src/utils/encryption.ts` (lines 12-20)

**Estimated scope:** XS — 1 line

---

### Task 19: Make requireSession workspace loading conditional

**Description:** `requireSession` loads the workspace on every request even when not needed.
Skip workspace loading if the route doesn't need it (e.g., `/api/auth/me`).

**Acceptance criteria:**

- [ ] `requireSession` no longer loads workspace (remove lines 59-65)
- [ ] `requireWorkspace` handles all workspace loading (already does this)
- [ ] All existing tests pass

**Verification:**

- [ ] `cd server && npx vitest run` passes

**Dependencies:** None

**Files likely touched:**

- `server/src/middleware/requireSession.ts` (lines 59-65)

**Estimated scope:** S — 1 file

---

### Task 20: Fix resolveModel to handle workspace-scoped model resolution

**Description:** `resolveModel()` queries all active models globally. After Task 4 (workspace
keys), models should ideally be resolved within the workspace context. At minimum, add a
comment explaining the current limitation.

**Acceptance criteria:**

- [ ] `resolveModel()` accepts optional workspaceId parameter
- [ ] If workspaceId is provided, filters models by workspace (or falls back to global)
- [ ] If no workspaceId, behavior is unchanged
- [ ] Comment added explaining the relationship between workspace keys and model resolution

**Verification:**

- [ ] `cd server && npx vitest run -- generation` passes

**Dependencies:** Task 4 (workspace keys)

**Files likely touched:**

- `server/src/services/generation/resolve-model.ts` (lines 25-47)
- `server/src/services/generation/generate.ts` (pass workspaceId)

**Estimated scope:** S — 2 files

---

## Checkpoints

### Checkpoint after Phase 1-2 (Tasks 1-3)

- [ ] `cd server && npx tsc --noEmit` clean
- [ ] `cd server && npx vitest run` passes
- [ ] `cd client && npx tsc --noEmit` clean
- [ ] `cd client && npx vitest run` passes
- [ ] Migration 009 applied successfully

### Checkpoint after Phase 3 (Tasks 4-12)

- [ ] All backend tests pass
- [ ] `cd server && npx tsc --noEmit` clean
- [ ] Manual: test generate endpoint with workspace key
- [ ] Manual: test admin delete with nonexistent ID returns 404

### Checkpoint after Phase 4-5 (Tasks 13-15)

- [ ] All frontend tests pass
- [ ] `cd client && npx tsc --noEmit` clean
- [ ] Client test count increased from 4 to 7+ files

### Checkpoint after Phase 6 (Tasks 16-20)

- [ ] All tests pass
- [ ] All typechecks clean
- [ ] Server starts with appropriate warnings

---

## Risks and Mitigations

| Risk                                                                                     | Impact | Mitigation                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration 009 fails on existing data with orphaned collection_items                      | High   | Run `SELECT ci.* FROM collection_items ci LEFT JOIN assets a ON ci.asset_id = a.id WHERE a.id IS NULL` first to find orphans; clean them before applying FK |
| Changing fal.ai API signature (Task 4-5) breaks existing tests                           | Medium | Update tests incrementally; keep backward-compatible fallback to FAL_KEY env var                                                                            |
| Credit rollback (Task 3) introduces race conditions                                      | Medium | Use DB transactions for the refund; test concurrent generation requests                                                                                     |
| Removing workspace loading from requireSession (Task 19) breaks routes that depend on it | High   | Audit all routes that use requireSession without requireWorkspace; add requireWorkspace where needed                                                        |

---

## Open Questions

- Should the commission state machine (Task 12) be updated to require premium_cost for APPROVED status too, or only SUBMITTED?
- Should Task 15 (frontend test coverage) prioritize ActorDesigner tests or Marketplace tests first?
- Is the `resolveModel` workspace-scoping (Task 20) needed immediately, or is a comment sufficient for now?
