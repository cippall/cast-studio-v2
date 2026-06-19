# Implementation Plan: Code Review Fixes

## Overview

Fix all issues found during comprehensive code review of the Cast Studio v2 codebase. Covers critical API contract mismatches between frontend and backend, missing test coverage, oversized files violating AGENTS.md rules, and several runtime bugs.

**Review source:** Full-repo code review performed 2026-06-19. 25 issues identified: 5 Critical, 12 Important, 8 Minor.

## Architecture Decisions

- **Fix API contract mismatches first** — the ActorDesigner's REFERENCE mode and generate/regenerate flows are broken due to frontend sending fields the backend doesn't accept.
- **Split oversized files** — any file over 200 lines must be broken into smaller modules. Extract sub-components and helper functions.
- **Add frontend tests** — the client test file is a placeholder. Add tests for critical paths.
- **Add collections backend tests** — zero test coverage for the collections feature.
- **Add Zod validation to admin routes** — currently uses manual `if (!field)` checks instead of Zod schemas.

## Task List

### Phase 1: Critical API Contract Fixes

These must be fixed first — they cause runtime failures.

- [ ] **Task 1**: Fix ActorDesigner REFERENCE mode create payload mismatch
- [ ] **Task 2**: Fix ActorDesigner generate/regenerate payload — add missing fields to backend schema
- [ ] **Task 3**: Fix `CollectionItemDetail` missing type in collection-service.ts
- [ ] **Task 4**: Fix CollectionDetail AddAssetsDialog — implement actual add-to-collection flow

### Checkpoint: Phase 1

- [ ] Actor can be created via REFERENCE mode without 422 error
- [ ] Actor generate accepts and uses form_data, reference_images, randomize
- [ ] TypeScript compiles clean: `npx tsc --noEmit` in both server/ and client/
- [ ] Collection detail page can add/remove assets

### Phase 2: Test Coverage

- [ ] **Task 5**: Add backend tests for collections CRUD and workspace isolation
- [ ] **Task 6**: Add frontend tests for ActorDesigner (create, generate, session navigation)
- [ ] **Task 7**: Add frontend tests for CollectionsPage and CollectionDetail
- [ ] **Task 8**: Add frontend tests for ModelsPage (fal.ai connection flow, model browser)

### Checkpoint: Phase 2

- [ ] `server/tests/collections.test.ts` exists and passes
- [ ] `client/tests/` has meaningful tests (not just `expect(true).toBe(true)`)
- [ ] All tests pass: `npm run test:run` in both server/ and client/

### Phase 3: File Size Violations (Split Oversized Files)

- [ ] **Task 9**: Split `ActorDesigner.tsx` (1156 lines) — extract sub-components
- [ ] **Task 10**: Split `admin/admin.ts` (617 lines) — separate route files + add Zod validation
- [ ] **Task 11**: Split `marketplace-service.ts` (1075 lines) — separate by domain
- [ ] **Task 12**: Split `useAdmin.ts` (458 lines) — one hook file per domain
- [ ] **Task 13**: Split `generation-service.ts` (435 lines) — extract helpers
- [ ] **Task 14**: Split `fal-service.ts` (395 lines) — separate model discovery from API calls
- [ ] **Task 15**: Split remaining oversized files (LookDesigner, ActorPage, ModelsPage, FashionItemCreator, DataTable, LibraryLayout, useMarketplace, AssetCardV2, ModelParameterForm, Dashboard, collection-service, actors route)

### Checkpoint: Phase 3

- [ ] No file exceeds 200 lines (verify: `find . -name '*.ts' -o -name '*.tsx' | xargs wc -l | sort -rn | head -20`)
- [ ] All imports updated after splits
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 4: Backend Improvements

- [ ] **Task 16**: Add Zod validation to admin route file (models, taxonomy, commission-forms endpoints)
- [ ] **Task 17**: Fix fal-service to support dynamic model endpoints (not just 4 hardcoded)
- [ ] **Task 18**: Fix generation-service to use workspace-configured models
- [ ] **Task 19**: Add duplicate check to collections add-item endpoint
- [ ] **Task 20**: Remove unused `adminBypass` parameter from `listCollections` in collection-service.ts

### Checkpoint: Phase 4

- [ ] Admin routes use Zod schemas consistently
- [ ] Imported fal.ai models can actually be called
- [ ] Adding same asset to collection twice is prevented
- [ ] All backend tests pass

### Phase 5: Frontend Improvements

- [ ] **Task 21**: Fix Dashboard — add Collections/Marketplace quick actions for Artist role
- [ ] **Task 22**: Fix ActorDesigner validation error clearing — use useEffect instead of refs during render
- [ ] **Task 23**: Add unsaved-changes protection for ActorDesigner Stage 1 and Stage 2
- [ ] **Task 24**: Fix TopBar — Profile and Settings should not both navigate to same path
- [ ] **Task 25**: Fix CollectionsPage — replace `prompt()` browser dialog with custom Dialog component

### Checkpoint: Phase 5

- [ ] Artist dashboard shows Collections and Marketplace quick actions
- [ ] ActorDesigner warns before navigating away with unsaved data
- [ ] Collections page uses consistent UI for create dialog
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 6: Minor Fixes & Polish

- [ ] **Task 26**: Fix hardcoded `text-green-600` in ModelsPage — use DESIGN.md tokens
- [ ] **Task 27**: Fix `ShirtIcon` / `Shirt` duplicate import in Dashboard
- [ ] **Task 28**: Fix fal-service simulated mode — use data URI instead of fake URL
- [ ] **Task 29**: Add artist/client dashboard data endpoint (currently admin-only)
- [ ] **Task 30**: Document encryption key rotation limitation in ADR

### Checkpoint: Phase 6 — Complete

- [ ] All acceptance criteria met
- [ ] `npm run typecheck` passes
- [ ] `npm run test:run` passes (server)
- [ ] `npm run test` passes (client)
- [ ] `npm run build` succeeds
- [ ] No file exceeds 200 lines
- [ ] No function exceeds 50 lines
- [ ] Ready for review

## Risks and Mitigations

| Risk                                                  | Impact | Mitigation                                                                              |
| ----------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Splitting ActorDesigner breaks internal state         | High   | Extract sub-components carefully, preserve state lifting pattern, test after each split |
| Adding Zod to admin routes changes error format       | Medium | Match existing error format from other route files                                      |
| fal.ai dynamic endpoint changes break existing models | Medium | Keep hardcoded models as fallback, add integration test                                 |
| Frontend tests require mocking complex hooks          | Medium | Start with simple render tests, add interaction tests incrementally                     |

## Open Questions

- Should the `prompt()` browser dialog replacement (Task 25) use the same Dialog component pattern as the delete confirmation?
- Should the encryption key rotation (Task 30) be implemented now or documented as a known limitation?
- For the dashboard endpoint (Task 29), should Artist and Client roles get separate endpoints or a single role-aware endpoint?

## Detailed Task Specifications

### Task 1: Fix ActorDesigner REFERENCE Mode Create Payload

**Description:** The frontend sends `{ entry_method: 'REFERENCE', reference_images: [...], randomize: true }` but the backend Zod schema expects `{ entry_method: 'REFERENCE', reference_image: string }`. Fix the backend schema to accept the fields the frontend sends.

**Acceptance criteria:**

- [ ] Backend `createActorSchema` accepts `reference_images` (array of strings) for REFERENCE mode
- [ ] Backend `createActorSchema` accepts `randomize` (boolean) for all entry methods
- [ ] Actor can be created via REFERENCE mode without 422 error
- [ ] Existing FORM and TEXT modes still work

**Files likely touched:**

- `server/src/routes/actors.ts`
- `server/src/services/actor-service.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 2: Fix ActorDesigner Generate/Regenerate Payload

**Description:** The frontend sends `form_data`, `reference_images`, `randomize` to generate/regenerate endpoints, but the backend Zod schemas don't include these fields. Update the schemas and pass the values through to the generation service.

**Acceptance criteria:**

- [ ] `generateSchema` accepts `form_data`, `reference_images`, `randomize`
- [ ] `regenerateSchema` accepts `form_data`, `reference_images`, `randomize`
- [ ] Generation service uses `form_data` for FORM mode
- [ ] Generation service uses `reference_images` for REFERENCE mode
- [ ] Generation service uses `randomize` to generate random seed when true

**Files likely touched:**

- `server/src/routes/actors.ts`
- `server/src/services/generation-service.ts`

**Estimated scope:** Small (2 files)

---

### Task 3: Fix CollectionItemDetail Missing Type

**Description:** `collection-service.ts:241` references `CollectionItemDetail[]` but the type is never imported or defined.

**Acceptance criteria:**

- [ ] `CollectionItemDetail` type is properly defined and exported
- [ ] `getCollectionItemsWithAssets` return type is correct
- [ ] `npx tsc --noEmit` passes in server/

**Files likely touched:**

- `server/src/services/collection-service.ts`
- `server/src/types/collection.ts`

**Estimated scope:** XS (1 file)

---

### Task 4: Implement AddAssetsDialog

**Description:** The AddAssetsDialog in CollectionDetail.tsx is a stub — it navigates to browse pages instead of implementing add-to-collection. Implement the actual flow: show user's assets, let them select, add to collection.

**Acceptance criteria:**

- [ ] Dialog shows assets from user's library (actors, looks, fashion items)
- [ ] User can select multiple assets
- [ ] Selected assets are added to the collection via `useAddCollectionItem`
- [ ] Dialog closes after successful add
- [ ] Collection detail refreshes to show new items

**Files likely touched:**

- `client/src/pages/collections/CollectionDetail.tsx`
- `client/src/hooks/useCollectionDetail.ts` (may need new hook for fetching user's assets)

**Estimated scope:** Medium (2-3 files)

---

### Task 5: Add Collections Backend Tests

**Description:** Write comprehensive tests for the collections feature covering CRUD, workspace isolation, and item management.

**Acceptance criteria:**

- [ ] `server/tests/collections.test.ts` exists
- [ ] Tests cover: create, list, get, update, delete collection
- [ ] Tests cover: add item, remove item, get items with assets
- [ ] Tests verify workspace isolation (user A can't access user B's collections)
- [ ] Tests verify duplicate item prevention
- [ ] All tests pass

**Files likely touched:**

- `server/tests/collections.test.ts` (new)

**Estimated scope:** Medium (1 new file, ~150 lines)

---

### Task 6: Add ActorDesigner Frontend Tests

**Description:** Write tests for the ActorDesigner page covering creation, generation, and session navigation.

**Acceptance criteria:**

- [ ] Tests cover: entry method selection (FORM, REFERENCE, TEXT)
- [ ] Tests cover: actor creation via each entry method
- [ ] Tests cover: generate button triggers API call
- [ ] Tests cover: session navigation (prev/next, load settings)
- [ ] Tests cover: reference image upload
- [ ] Tests cover: validation error display and clearing
- [ ] All tests pass

**Files likely touched:**

- `client/tests/actor-designer.test.ts` (new)

**Estimated scope:** Medium (1 new file, ~200 lines)

---

### Task 7: Add Collections Frontend Tests

**Description:** Write tests for CollectionsPage and CollectionDetail.

**Acceptance criteria:**

- [ ] CollectionsPage: test grid rendering, search, pagination, empty state
- [ ] CollectionDetail: test asset grid, add/remove items, rename, delete
- [ ] All tests pass

**Files likely touched:**

- `client/tests/collections.test.ts` (new)

**Estimated scope:** Small (1 new file, ~120 lines)

---

### Task 8: Add ModelsPage Frontend Tests

**Description:** Write tests for the ModelsPage covering fal.ai connection flow and model browser.

**Acceptance criteria:**

- [ ] Tests cover: not-connected state shows connect button
- [ ] Tests cover: API key input, test connection, save key
- [ ] Tests cover: model browser shows models grouped by category
- [ ] Tests cover: import model button
- [ ] Tests cover: configured models tab with activate/deactivate/delete
- [ ] All tests pass

**Files likely touched:**

- `client/tests/models-page.test.ts` (new)

**Estimated scope:** Medium (1 new file, ~150 lines)

---

### Task 9: Split ActorDesigner.tsx

**Description:** Break the 1156-line ActorDesigner into smaller components. Each sub-component should be in its own file.

**Target structure:**

```
client/src/pages/actors/ActorDesigner.tsx          (~150 lines — main wizard)
client/src/components/actor-designer/Stage1.tsx      (~120 lines — entry method selection)
client/src/components/actor-designer/Stage2.tsx      (~150 lines — image grid + stepper)
client/src/components/actor-designer/Stage3.tsx      (~100 lines — name + properties)
client/src/components/actor-designer/ImageGrid.tsx   (~80 lines)
client/src/components/actor-designer/SessionNavigator.tsx (~60 lines)
client/src/components/actor-designer/StructuredFormPanel.tsx (~80 lines)
client/src/components/actor-designer/ReferencePhotoPanel.tsx (~100 lines)
client/src/components/actor-designer/RawTextPanel.tsx (~80 lines)
client/src/components/actor-designer/types.ts        (shared types)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All existing functionality preserved
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

**Files likely touched:** 10 files (1 split into 9)

**Estimated scope:** Large (splitting only, no behavior changes)

---

### Task 10: Split admin/admin.ts + Add Zod Validation

**Description:** Break the 617-line admin route file into separate files and add Zod schemas.

**Target structure:**

```
server/src/routes/admin/admin.ts          (~80 lines — router setup + helpers)
server/src/routes/admin/fal-routes.ts     (~150 lines — fal.ai key + models)
server/src/routes/admin/model-routes.ts   (~120 lines — CRUD for models)
server/src/routes/admin/prompt-routes.ts  (~80 lines — system prompts)
server/src/routes/admin/taxonomy-routes.ts (~120 lines — taxonomy CRUD)
server/src/routes/admin/validation.ts     (~100 lines — Zod schemas)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All endpoints use Zod validation
- [ ] Error format matches existing routes
- [ ] All existing admin tests pass
- [ ] `npm run typecheck` passes

**Files likely touched:** 6 files

**Estimated scope:** Large

---

### Task 11: Split marketplace-service.ts

**Description:** Break the 1075-line marketplace service into domain-specific modules.

**Target structure:**

```
server/src/services/marketplace/
  index.ts              (~50 lines — re-exports)
  submissions.ts        (~200 lines — artist submit, admin review)
  listings.ts           (~200 lines — browse, purchase, sold items)
  helpers.ts            (~100 lines — shared helpers, types)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All existing marketplace tests pass
- [ ] `npm run typecheck` passes

**Files likely touched:** 4 files

**Estimated scope:** Large (splitting only)

---

### Task 12: Split useAdmin.ts

**Description:** Break the 458-line hook file into per-domain files.

**Target structure:**

```
client/src/hooks/useAdminUsers.ts       (~80 lines)
client/src/hooks/useAdminModels.ts      (~100 lines)
client/src/hooks/useAdminPrompts.ts     (~60 lines)
client/src/hooks/useAdminTaxonomy.ts    (~80 lines)
client/src/hooks/useAdminCommissionForms.ts (~80 lines)
client/src/hooks/useFalConfig.ts        (~100 lines)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All imports updated in ModelsPage and other consumers
- [ ] `npm run typecheck` passes

**Files likely touched:** 7 files

**Estimated scope:** Medium

---

### Task 13: Split generation-service.ts

**Description:** Break the 435-line generation service into smaller modules.

**Target structure:**

```
server/src/services/generation-service.ts  (~100 lines — types + re-exports)
server/src/services/generation/
  generate.ts            (~150 lines — generateActorOutput)
  regenerate.ts          (~120 lines — regenerateActorOutput)
  character-sheet.ts     (~100 lines — generateCharacterSheet)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All existing generation tests pass
- [ ] `npm run typecheck` passes

**Files likely touched:** 4 files

**Estimated scope:** Medium

---

### Task 14: Split fal-service.ts

**Description:** Break the 395-line fal service into API and model discovery modules.

**Target structure:**

```
server/src/services/fal-service.ts       (~80 lines — types + re-exports)
server/src/services/fal/
  api.ts                 (~150 lines — submitTextToImage, submitImageToImage, pollJob)
  models.ts              (~120 lines — fetchFalModels, model discovery)
```

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All existing fal tests pass
- [ ] `npm run typecheck` passes

**Files likely touched:** 3 files

**Estimated scope:** Small

---

### Task 15: Split Remaining Oversized Files

**Description:** Split all remaining files over 200 lines. Each file gets its own task if large, or batched if small.

**Files to split:**

- `LookDesigner.tsx` (621 lines) — extract sub-components
- `ActorPage.tsx` (618 lines) — extract sections
- `ModelsPage.tsx` (544 lines) — extract connection flow, model browser, configured models
- `FashionItemCreator.tsx` (500 lines) — extract form sections
- `DataTable.tsx` (371 lines) — extract column renderers
- `LibraryLayout.tsx` (301 lines) — extract filter panel, grid
- `useMarketplace.ts` (301 lines) — split by domain
- `AssetCardV2.tsx` (229 lines) — extract card sections
- `ModelParameterForm.tsx` (222 lines) — extract field renderers
- `Dashboard.tsx` (241 lines) — extract activity card, wallet card
- `collection-service.ts` (281 lines) — split repository from service
- `actors.ts` route (444 lines) — split by endpoint group

**Acceptance criteria:**

- [ ] No file exceeds 200 lines
- [ ] All imports updated
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

**Files likely touched:** ~20 files

**Estimated scope:** Large (splitting only, no behavior changes)

---

### Task 16: Add Zod Validation to Admin Routes

**Description:** Already covered by Task 10 (splitting admin/admin.ts includes adding Zod). This task ensures completeness.

**Acceptance criteria:**

- [ ] All admin POST/PATCH endpoints use Zod schemas
- [ ] Validation errors return 422 with field-level details
- [ ] Error format matches other route files

**Files likely touched:**

- `server/src/routes/admin/validation.ts`

**Estimated scope:** Small (1 file)

---

### Task 17: Fix fal-Service Dynamic Model Endpoints

**Description:** The `getModelEndpoint` function only supports 4 hardcoded models. Imported models with custom endpoints will fail. Fix to support dynamic model IDs.

**Acceptance criteria:**

- [ ] `getModelEndpoint` uses the model ID from the database, not a hardcoded switch
- [ ] Endpoint URL pattern: `https://queue.fal.run/{modelId}` for any model
- [ ] Existing hardcoded models still work
- [ ] `npx tsc --noEmit` passes

**Files likely touched:**

- `server/src/services/fal-service.ts` (or `fal/api.ts` after split)

**Estimated scope:** Small (1 file)

---

### Task 18: Fix Generation-Service Model Resolution

**Description:** The generation service ignores workspace-configured models and always uses `flux-pro` or user-provided model string. Fix to validate against configured models.

**Acceptance criteria:**

- [ ] Generation service looks up workspace's active models
- [ ] If no model specified, uses the default active model for the task
- [ ] If specified model is not in workspace's configured list, returns 422
- [ ] All existing generation tests pass

**Files likely touched:**

- `server/src/services/generation-service.ts` (or `generation/generate.ts` after split)

**Estimated scope:** Small (1-2 files)

---

### Task 19: Add Duplicate Check to Collections Add-Item

**Description:** The add-item endpoint doesn't check if the asset is already in the collection. Add a check and return 409 for duplicates.

**Acceptance criteria:**

- [ ] Adding same asset to same collection twice returns 409
- [ ] Error message: "Asset already in collection"
- [ ] Frontend handles 409 gracefully (shows toast, doesn't crash)
- [ ] Test covers duplicate prevention

**Files likely touched:**

- `server/src/services/collection-service.ts`
- `server/src/routes/collections.ts`
- `client/src/components/AddToCollectionDropdown.tsx`

**Estimated scope:** Small (2-3 files)

---

### Task 20: Remove Unused adminBypass from listCollections

**Description:** The `listCollections` function accepts `adminBypass` but never uses it. Remove the dead parameter.

**Acceptance criteria:**

- [ ] `adminBypass` parameter removed from `listCollections`
- [ ] All call sites updated
- [ ] `npx tsc --noEmit` passes

**Files likely touched:**

- `server/src/services/collection-service.ts`

**Estimated scope:** XS (1 file)

---

### Task 21: Add Artist Dashboard Quick Actions

**Description:** Artists don't see Collections or Marketplace quick actions on the dashboard.

**Acceptance criteria:**

- [ ] Artist dashboard shows "New Collection" quick action
- [ ] Artist dashboard shows "Marketplace" quick action
- [ ] Quick actions grid auto-fits (already works per PP-1)

**Files likely touched:**

- `client/src/pages/Dashboard.tsx`

**Estimated scope:** XS (1 file)

---

### Task 22: Fix ActorDesigner Validation Error Clearing

**Description:** Validation errors are cleared using refs compared during render. This is an anti-pattern. Use useEffect instead.

**Acceptance criteria:**

- [ ] `useEffect` watches `prompt` and `referenceImages.length`
- [ ] Validation error clears when user provides input
- [ ] No refs used for render-time side effects

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx` (or `ReferencePhotoPanel.tsx` after split)

**Estimated scope:** XS (1 file)

---

### Task 23: Add Unsaved-Changes Protection for Stage 1 and 2

**Description:** Only Stage 3 has unsaved-changes protection. Extend to Stage 1 (entry method, prompt, form data) and Stage 2 (reference images, generated selections).

**Acceptance criteria:**

- [ ] Navigating away from Stage 1 with entry method selected shows warning
- [ ] Navigating away from Stage 2 with generated images shows warning
- [ ] Warning uses browser `beforeunload` event
- [ ] Save/confirm actions clear the warning

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`
- `client/src/hooks/useUnsavedChanges.ts`

**Estimated scope:** Small (2 files)

---

### Task 24: Fix TopBar Profile vs Settings Navigation

**Description:** Both "Profile" and "Settings" dropdown items navigate to `/settings`. Make them distinct.

**Acceptance criteria:**

- [ ] "Profile" navigates to `/settings` (profile section)
- [ ] "Settings" navigates to `/settings/users` or stays at `/settings` with different tab
- [ ] Labels are distinct and clear

**Files likely touched:**

- `client/src/components/TopBar.tsx`

**Estimated scope:** XS (1 file)

---

### Task 25: Replace Browser prompt() in CollectionsPage

**Description:** CollectionsPage uses `prompt('Collection name:')` — a browser-native dialog. Replace with a custom Dialog component consistent with the rest of the UI.

**Acceptance criteria:**

- [ ] Custom Dialog component for creating collections
- [ ] Dialog has text input with validation (min 1 char, max 255)
- [ ] Dialog has Cancel and Create buttons
- [ ] No browser-native `prompt()` calls remain

**Files likely touched:**

- `client/src/pages/collections/CollectionsPage.tsx`

**Estimated scope:** Small (1 file)

---

### Task 26: Fix Hardcoded Colors in ModelsPage

**Description:** ModelsPage uses `text-green-600` instead of DESIGN.md tokens.

**Acceptance criteria:**

- [ ] All colors use CSS variables or Tailwind tokens from DESIGN.md
- [ ] No hardcoded color classes remain

**Files likely touched:**

- `client/src/pages/settings/ModelsPage.tsx`

**Estimated scope:** XS (1 file)

---

### Task 27: Fix Duplicate ShirtIcon Import in Dashboard

**Description:** Dashboard imports both `Shirt` and `ShirtIcon` from lucide-react (same icon).

**Acceptance criteria:**

- [ ] Only one import for the shirt icon
- [ ] Consistent naming throughout

**Files likely touched:**

- `client/src/pages/Dashboard.tsx`

**Estimated scope:** XS (1 file)

---

### Task 28: Fix Fal-Service Simulated Mode URLs

**Description:** Simulated mode returns `https://fal.ai/sim/${jobId}.png` which will 404. Use a data URI placeholder instead.

**Acceptance criteria:**

- [ ] Simulated mode returns a valid data URI or placeholder image URL
- [ ] Images don't 404 in development

**Files likely touched:**

- `server/src/services/fal-service.ts` (or `fal/api.ts` after split)

**Estimated scope:** XS (1 file)

---

### Task 29: Add Artist/Client Dashboard Endpoint

**Description:** The `/api/dashboard` endpoint is admin-only. Add role-specific dashboard data for Artist and Client roles.

**Acceptance criteria:**

- [ ] Artist dashboard returns: my actors count, my looks count, my items count, recent submissions
- [ ] Client dashboard returns: wallet balance, active commissions count, recent purchases
- [ ] Endpoint is role-aware (returns different data based on user role)

**Files likely touched:**

- `server/src/server.ts`
- `client/src/hooks/useDashboard.ts`

**Estimated scope:** Small (2 files)

---

### Task 30: Document Encryption Key Rotation Limitation

**Description:** Write an ADR documenting the current encryption approach and the key rotation limitation.

**Acceptance criteria:**

- [ ] ADR-046 (or next number) documents encryption approach
- [ ] Documents the limitation: single `ENCRYPTION_KEY`, no rotation mechanism
- [ ] Suggests future improvement: key versioning with re-encryption

**Files likely touched:**

- `docs/decisions/ADR-046-encryption-key-rotation.md` (new)

**Estimated scope:** XS (1 file)
