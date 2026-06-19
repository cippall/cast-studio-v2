# Implementation Plan: Page-by-Page Review Fixes

## Overview

Second-pass fixes from page-by-page review. Covers Dashboard, Actor Designer, Marketplace, Collections (new), and Models page changes. All work follows DESIGN.md tokens (stone palette, Libre Baskerville headings, Inter body, 0px radius, no shadows, borders-only separation).

**Design system source of truth:** `/home/ciprian/projects/cast-studio-v2/DESIGN.md`
**Product context:** `/home/ciprian/projects/cast-studio-v2/PRODUCT.md`
**Domain reference:** `agent-skills-planning-and-task-breakdown/references/cast-studio-v2-domain.md`

## Architecture Decisions

- **Collections** is a new first-class feature — sidebar nav item for Artists and Clients, full CRUD, mixed asset types, mixed ownership. Reuses existing marketplace card component for marketplace items.
- **Marketplace = single purchase model.** Once a Client buys an asset, only that Client + Admins can see it. Removed from marketplace for everyone else.
- **Actor Designer** is a major redesign: 3 entry methods (Structured Form, Reference Photo, Raw Text), no standalone Randomize, generation sessions with navigation, full-width stepper, no auto-generate.
- **Dashboard** Quick Actions grid auto-fits to item count. Recent Activity capped at 2 rows, no scroll.
- **Models page** gets fal.ai API key connection flow — Admin pastes key, tests connection, browses models.

## Task List

### Phase 1: Dashboard Fixes

- [ ] **Task 1**: Fix Quick Actions grid to auto-fit item count
- [ ] **Task 2**: Fix Recent Activity — max 2 rows, no horizontal scroll
- [ ] **Task 3**: Add Collections sidebar nav item for Artist and Client roles

### Checkpoint: Phase 1

- [ ] Quick Actions grid has no empty columns (3 items = 3 cols, 4 items = 4 cols)
- [ ] Recent Activity shows max 2 rows, no scroll
- [ ] Sidebar shows Collections for Artists and Clients
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 2: Collections (New Feature)

- [ ] **Task 4**: Create Collections data model and API endpoints (backend)
- [ ] **Task 5**: Create Collections browse page (folder/card grid, pagination, filtering)
- [ ] **Task 6**: Create Collection detail page (asset grid, add/remove assets)
- [ ] **Task 7**: Add "Add to Collection" action on asset cards across all library pages
- [ ] **Task 8**: Wire Collections into sidebar navigation

### Checkpoint: Phase 2

- [ ] Collections CRUD works end-to-end
- [ ] Collections browse shows folders/cards with pagination and filtering
- [ ] Collection detail shows mixed asset types (Actors, Looks, Fashion Items)
- [ ] Marketplace items in collections use marketplace card styling (buy button/shop icon)
- [ ] Owned items use plain asset cards
- [ ] "Add to Collection" action available on asset cards in libraries
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 3: Actor Designer Redesign

- [ ] **Task 9**: Restructure entry methods — remove Randomize as standalone, add Randomize toggle to Structured Form and Raw Text
- [ ] **Task 10**: Build full-width segmented stepper (3 equal segments, sharp edges)
- [ ] **Task 11**: Build Structured Form mode — split screen layout (form left, images right)
- [ ] **Task 12**: Build Reference Photo mode — full width, upload slots + prompt + generate at bottom
- [ ] **Task 13**: Build Raw Text mode — full width, prompt at bottom, no split screen
- [ ] **Task 14**: Implement generation sessions (session tracking, left/right navigation, Load Settings)
- [ ] **Task 15**: Fix Reference Photo bug (invalid input on Continue without selection)
- [ ] **Task 16**: Replace hardcoded Stage 3 taxonomy fields with dynamic admin-defined fields

### Checkpoint: Phase 3

- [ ] 3 entry methods work (Structured Form, Reference Photo, Raw Text)
- [ ] Randomize is a toggle within Structured Form and Raw Text, not standalone
- [ ] Stepper is full-width, sharp-edged, 3 equal segments
- [ ] Structured Form uses split screen layout
- [ ] Reference Photo and Raw Text use full-width layout
- [ ] Reference Photo allows multiple image upload with dynamic slot addition
- [ ] Generation sessions track history, navigate with arrows, load settings on demand
- [ ] No auto-generate — user clicks explicitly
- [ ] Stage 3 uses dynamic taxonomy fields
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 4: Marketplace Model Update

- [ ] **Task 17**: Update marketplace purchase flow — single purchase model (asset transfers exclusively to buyer)
- [ ] **Task 18**: Update client asset search — separate "My Assets" and "Similar in Marketplace" sections
- [ ] **Task 19**: Remove purchased assets from marketplace for other users

### Checkpoint: Phase 4

- [ ] Purchased assets are only visible to buying Client and Admins
- [ ] Purchased assets removed from marketplace browse for others
- [ ] Client search shows owned assets first, marketplace suggestions below
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 5: Models Page — fal.ai Integration

- [ ] **Task 20**: Add fal.ai API key connection flow to Models page (paste key, test connection)
- [ ] **Task 21**: Add model browser — fetch available models from fal.ai, display with categories
- [ ] **Task 22**: Add model parameter configuration — dynamic form from fal.ai parameter schema

### Checkpoint: Phase 5

- [ ] Admin can paste fal.ai API key and test connection
- [ ] Models page shows available models from fal.ai with categories (text_to_image, image_to_image, image_to_text)
- [ ] Admin can configure model parameters via dynamic form
- [ ] Existing model management (activate/deactivate/delete) still works
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 6: Navigation Updates

- [ ] **Task 23**: Add Collections to sidebar nav (Artist + Client)
- [ ] **Task 24**: Add Marketplace browse link for Artists (currently only has /marketplace/manage)
- [ ] **Task 25**: Add Admin "Store" link under Marketplace in sidebar (GAP-1 from fix plan)

### Checkpoint: Phase 6

- [ ] All role-based nav items are correct
- [ ] Artists can browse marketplace and manage listings
- [ ] Admins can preview client-facing storefront
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

---

## Task Details

### Task 1: Fix Quick Actions grid to auto-fit item count

**Description:** Currently uses `lg:grid-cols-4` which forces 4 columns even when there are only 3 actions (or 4 for Clients). Change to auto-fit so the grid naturally wraps based on item count.

**Acceptance criteria:**

- [ ] 3 quick actions display in 3 columns (not 4 with empty space)
- [ ] 4 quick actions (Client role) display in 4 columns
- [ ] Responsive: 1 col mobile, 2 col tablet, 3-4 col desktop
- [ ] No visual regression in card styling

**Files likely touched:**

- `client/src/pages/Dashboard.tsx`

**Estimated scope:** XS (1 file)

---

### Task 2: Fix Recent Activity — max 2 rows, no horizontal scroll

**Description:** Currently a horizontal scroll with unlimited items. Replace with a fixed grid showing max 2 rows (approximately 8-10 items depending on viewport). No scroll, no "see more" — just the latest activity.

**Acceptance criteria:**

- [ ] Recent Activity shows max 2 rows of items
- [ ] No horizontal scrollbar
- [ ] Items are displayed in a responsive grid (4 cols desktop, 2 cols tablet, 1 col mobile)
- [ ] Empty state still shows when no activity exists
- [ ] Loading skeleton shows during fetch

**Files likely touched:**

- `client/src/pages/Dashboard.tsx`

**Estimated scope:** XS (1 file)

---

### Task 3: Add Collections sidebar nav item

**Description:** Add "Collections" as a sidebar navigation item for Artist and Client roles. Place it between Library and Commissions.

**Acceptance criteria:**

- [ ] Artists see Collections in sidebar between Library and Commissions
- [ ] Clients see Collections in sidebar between Library and Commissions
- [ ] Admins do NOT see Collections (admin manages everything, no personal collections)
- [ ] Nav item has an appropriate icon (Folder or Bookmark)

**Files likely touched:**

- `client/src/lib/navigation.ts`

**Estimated scope:** XS (1 file)

---

### Task 4: Create Collections data model and API endpoints

**Description:** Backend support for Collections. New `collections` table (id, user_id, workspace_id, name, created_at, updated_at) and `collection_items` table (id, collection_id, asset_type, asset_id, created_at). CRUD endpoints: GET /collections, POST /collections, PUT /collections/:id, DELETE /collections/:id, POST /collections/:id/items, DELETE /collections/:id/items/:itemId.

**Acceptance criteria:**

- [ ] Migration creates `collections` and `collection_items` tables
- [ ] GET /collections returns user's collections with item counts
- [ ] POST /collections creates a new collection
- [ ] PUT /collections/:id renames a collection
- [ ] DELETE /collections/:id deletes a collection and its items
- [ ] POST /collections/:id/items adds an asset to a collection
- [ ] DELETE /collections/:id/items/:itemId removes an asset from a collection
- [ ] All endpoints are workspace-scoped and user-scoped
- [ ] Adding a marketplace item (not owned) is allowed

**Files likely touched:**

- `server/src/db/migrations/00X-collections.sql`
- `server/src/services/collection-service.ts`
- `server/src/routes/collections.ts`
- `server/src/types/collection.ts`

**Estimated scope:** Medium (4 files)

---

### Task 5: Create Collections browse page

**Description:** Page that displays user's collections as folders/cards in a grid. Includes pagination, filtering by name, and grid/card display mode toggle.

**Acceptance criteria:**

- [ ] Collections displayed as folder/card grid
- [ ] Each collection card shows: name, item count, thumbnail preview of first few items
- [ ] Pagination for large numbers of collections
- [ ] Filter/search by collection name
- [ ] "New Collection" button creates a new collection
- [ ] Clicking a collection opens the collection detail page
- [ ] Empty state when no collections exist
- [ ] Responsive: 1 col mobile, 2 col tablet, 3-4 col desktop

**Files likely touched:**

- `client/src/pages/collections/CollectionsPage.tsx` (new)
- `client/src/hooks/useCollections.ts` (new)
- `client/src/lib/api-client.ts` (add collections endpoints)

**Estimated scope:** Medium (3 files)

---

### Task 6: Create Collection detail page

**Description:** Shows assets within a collection. Mixed asset types (Actors, Looks, Fashion Items) displayed in a grid. Marketplace items use marketplace card styling (with buy button/shop icon). Owned items use plain asset cards. Add and remove assets.

**Acceptance criteria:**

- [ ] Collection detail shows all assets in a responsive grid
- [ ] Mixed asset types display correctly (Actors, Looks, Fashion Items)
- [ ] Marketplace items use marketplace card component (buy button + shop icon)
- [ ] Owned items use plain asset card (no buy button, no icon)
- [ ] "Add Assets" button opens a modal to browse and add assets
- [ ] Each asset has a "Remove from Collection" action
- [ ] Collection name is editable inline
- [ ] "Delete Collection" action with confirmation
- [ ] Empty state when collection has no assets

**Files likely touched:**

- `client/src/pages/collections/CollectionDetail.tsx` (new)
- `client/src/hooks/useCollectionDetail.ts` (new)

**Estimated scope:** Medium (2 files)

---

### Task 7: Add "Add to Collection" action on asset cards

**Description:** Across all library pages (ActorLibrary, LookLibrary, FashionItemLibrary), add an "Add to Collection" action on each asset card. Opens a dropdown/select to pick a collection, or create a new one.

**Acceptance criteria:**

- [ ] Asset cards in all library pages have "Add to Collection" action
- [ ] Clicking opens a dropdown with existing collections + "Create New" option
- [ ] After adding, shows a brief confirmation (toast)
- [ ] Asset can only be added once per collection (no duplicates)
- [ ] Action is available for both owned and marketplace assets

**Files likely touched:**

- `client/src/components/AssetCardV2.tsx`
- `client/src/components/ProductCard.tsx`
- `client/src/hooks/useCollections.ts`

**Estimated scope:** Small (3 files)

---

### Task 8: Wire Collections into sidebar navigation

**Description:** Connect the Collections page to the sidebar nav (Task 3 added the nav item, this task wires the route and page component).

**Acceptance criteria:**

- [ ] Clicking Collections in sidebar navigates to `/collections`
- [ ] `/collections` route renders CollectionsPage
- [ ] `/collections/:id` route renders CollectionDetail page
- [ ] Routes are protected by role (Artist + Client only)

**Files likely touched:**

- `client/src/App.tsx` or router config
- `client/src/pages/collections/CollectionsPage.tsx`
- `client/src/pages/collections/CollectionDetail.tsx`

**Estimated scope:** Small (3 files)

---

### Task 9: Restructure Actor Designer entry methods

**Description:** Remove Randomize as a standalone entry method. Add Randomize as a checkbox toggle within Structured Form and Raw Text methods. Update Stage 1 UI to show 3 options instead of 4.

**Acceptance criteria:**

- [ ] Entry methods: Structured Form, Reference Photo, Raw Text (3 total)
- [ ] Randomize checkbox appears within Structured Form and Raw Text
- [ ] Randomize is NOT a standalone entry method
- [ ] Stage 1 UI grid adjusts to 3 columns for entry methods
- [ ] Form data model updated (no RANDOMIZE entry method)

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`

**Estimated scope:** Small (1 file)

---

### Task 10: Build full-width segmented stepper

**Description:** Replace the current horizontal scroll of pill buttons with a full-width segmented bar. 3 equal segments (Headshot | Fullshot | Expressions). Sharp edges, no rounded corners. Active = filled primary, completed = checkmark + muted, upcoming = ghost.

**Acceptance criteria:**

- [ ] Stepper spans full width of content area
- [ ] 3 equal segments, each taking 33.33% width
- [ ] Active step: filled primary background, primary-foreground text
- [ ] Completed step: checkmark icon + muted background
- [ ] Upcoming step: ghost/outline styling
- [ ] Sharp edges (0px radius) — no rounded pills
- [ ] Clicking a completed step navigates back to it
- [ ] Clicking an upcoming step does nothing (disabled)

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`

**Estimated scope:** Small (1 file)

---

### Task 11: Build Structured Form mode — split screen layout

**Description:** Structured Form entry method uses split screen: admin-defined form fields on the left (1/3 width), generated image grid on the right (2/3 width). Form includes sliders, dropdowns, and other input types from admin taxonomy config. Randomize toggle at bottom of form.

**Acceptance criteria:**

- [ ] Split screen layout: form left (1/3), images right (2/3)
- [ ] Form fields are dynamically generated from admin taxonomy config
- [ ] Supports sliders, dropdowns, text inputs based on field type
- [ ] Randomize checkbox at bottom of form
- [ ] Generate button at bottom of form
- [ ] Form state persists when navigating between steps
- [ ] Responsive: stacks vertically on mobile (form on top, images below)

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`
- `client/src/components/ActorFormFields.tsx` (new, dynamic form renderer)

**Estimated scope:** Medium (2 files)

---

### Task 12: Build Reference Photo mode layout

**Description:** Reference Photo entry method uses full-width layout. Generated image grid on top. At bottom: reference image slots (small cards in a row, centered), prompt textarea (centered, medium width), Randomize checkbox + Generate button. One "+" slot initially; on upload, image replaces "+" and new "+" appears if model allows more. Each uploaded image has ✕ to remove.

**Acceptance criteria:**

- [ ] Full-width layout (no split screen)
- [ ] Image grid takes full width at top
- [ ] Reference image slots: small cards, centered, "+" to upload
- [ ] On upload: image replaces "+", new "+" slot appears if model allows more
- [ ] Each uploaded image has ✕ to remove
- [ ] Number of max slots = admin-configured max input images per model
- [ ] Prompt textarea centered below reference slots
- [ ] Randomize checkbox + Generate button centered below prompt
- [ ] Reference Photo bug fixed (no invalid input on Continue without selection)

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`
- `client/src/components/ReferenceImageUpload.tsx` (new)

**Estimated scope:** Medium (2 files)

---

### Task 13: Build Raw Text mode layout

**Description:** Raw Text entry method uses full-width layout. Generated image grid on top. At bottom: prompt textarea (centered, medium width), Randomize checkbox + Generate button. No split screen.

**Acceptance criteria:**

- [ ] Full-width layout (no split screen)
- [ ] Image grid takes full width at top
- [ ] Prompt textarea centered at bottom
- [ ] Randomize checkbox + Generate button centered below prompt
- [ ] When navigating sessions, prompt updates to show what was used for that session

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`

**Estimated scope:** Small (1 file)

---

### Task 14: Implement generation sessions

**Description:** Each Generate/Regenerate creates a new session. Session navigator below image grid: left/right arrows + "Session X of Y". Grid shows selected session's images. "Load Settings" button restores that session's input settings back into the form.

**Acceptance criteria:**

- [ ] Each Generate/Regenerate creates a new session with incrementing number
- [ ] Session navigator: "◀ Session X of Y ▶" below image grid
- [ ] Left arrow goes to previous session, right arrow goes to next
- [ ] Grid updates to show selected session's 4 images
- [ ] "Load Settings" button restores that session's input settings into the form
- [ ] Session data includes: prompt/reference images/randomize state used
- [ ] Sessions persist for the lifetime of the Actor Designer wizard
- [ ] No auto-generate — user always clicks explicitly

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`

**Estimated scope:** Medium (1 file, significant state management changes)

---

### Task 15: Fix Reference Photo bug

**Description:** Currently triggers invalid input error on Continue even when nothing is selected. Fix the validation logic.

**Acceptance criteria:**

- [ ] Clicking Continue in Reference Photo mode does NOT trigger invalid input
- [ ] User can proceed to Stage 2 without uploading a reference image
- [ ] Validation only triggers when trying to generate (must have at least prompt or reference image)

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`

**Estimated scope:** XS (1 file)

---

### Task 16: Replace hardcoded Stage 3 taxonomy fields

**Description:** Stage 3 currently has hardcoded fields (Age, Gender, Vibe). Replace with dynamic fields from admin taxonomy config.

**Acceptance criteria:**

- [ ] Stage 3 form fields are generated from admin-defined actor properties
- [ ] Field types match admin config (text, number, dropdown, etc.)
- [ ] No hardcoded Age/Gender/Vibe fields
- [ ] Form saves correctly with dynamic fields

**Files likely touched:**

- `client/src/pages/actors/ActorDesigner.tsx`
- `client/src/components/ActorFormFields.tsx`

**Estimated scope:** Small (2 files)

---

### Task 17: Update marketplace purchase flow — single purchase model

**Description:** When a Client buys a marketplace asset, that specific asset instance transfers exclusively to them. Only the buying Client and Admins can see it after purchase. Asset is removed from marketplace for all other users.

**Acceptance criteria:**

- [ ] Purchase endpoint transfers asset ownership to buying Client
- [ ] After purchase, asset is only visible to buying Client and Admins
- [ ] Asset is removed from marketplace browse/search for other users
- [ ] Artist who listed the asset can see it's been sold (but not access it)
- [ ] Purchase flow handles wallet balance check, deduction, and transfer atomically

**Files likely touched:**

- `server/src/services/marketplace-service.ts`
- `server/src/routes/marketplace.ts`
- `client/src/pages/marketplace/MarketplaceDetail.tsx`
- `client/src/pages/marketplace/MarketplacePage.tsx`

**Estimated scope:** Medium (4 files)

---

### Task 18: Update client asset search — separate sections

**Description:** When a Client searches their own assets, results show in two separate sections: "My Assets" first, then "Similar in Marketplace" below. Clear visual distinction between owned and marketplace items.

**Acceptance criteria:**

- [ ] Client search returns two sections: "My Assets" and "Similar in Marketplace"
- [ ] "My Assets" section shows only assets the client owns
- [ ] "Similar in Marketplace" section shows marketplace items matching the search
- [ ] Clear visual separation (heading + divider) between sections
- [ ] Each section has its own empty state

**Files likely touched:**

- `client/src/pages/actors/ActorLibrary.tsx`
- `client/src/pages/looks/LookLibrary.tsx`
- `client/src/pages/fashion-items/FashionItemLibrary.tsx`
- `server/src/services/search-service.ts` (or equivalent)

**Estimated scope:** Medium (4 files)

---

### Task 19: Remove purchased assets from marketplace

**Description:** Backend support for hiding purchased assets from marketplace listings. When an asset is purchased, it's marked as sold and excluded from marketplace queries for other users.

**Acceptance criteria:**

- [ ] Purchased assets are excluded from marketplace browse for non-owners
- [ ] Purchased assets are excluded from marketplace search for non-owners
- [ ] Purchased assets still appear in the buying Client's library
- [ ] Purchased assets are visible to Admins in admin marketplace management

**Files likely touched:**

- `server/src/services/marketplace-service.ts`
- `server/src/db/migrations/` (add `sold_at` or `buyer_id` column if needed)

**Estimated scope:** Small (2 files)

---

### Task 20: Add fal.ai API key connection flow to Models page

**Description:** Admin can paste their fal.ai API key on the Models page, test the connection, and save it. The key is stored securely and used for all fal.ai API calls.

**Acceptance criteria:**

- [ ] Models page shows "Connect fal.ai" section at top when no API key is configured
- [ ] Admin can paste API key in a secure input field
- [ ] "Test Connection" button validates the key against fal.ai API
- [ ] Success/failure feedback after testing
- [ ] Once connected, the connection section collapses and model management is shown
- [ ] API key is stored securely (not in plaintext in DB — encrypted or env var)
- [ ] Admin can disconnect/replace the API key

**Files likely touched:**

- `client/src/pages/settings/ModelsPage.tsx`
- `server/src/services/fal-service.ts` (new or update)
- `server/src/routes/settings.ts` (add fal.ai key endpoints)

**Estimated scope:** Medium (3 files)

---

### Task 21: Add model browser — fetch available models from fal.ai

**Description:** Once fal.ai API key is connected, Admin can browse available models from fal.ai. Models are categorized by type (text_to_image, image_to_image, image_to_text).

**Acceptance criteria:**

- [ ] Models page fetches available models from fal.ai API
- [ ] Models displayed in categories: text_to_image, image_to_image, image_to_text
- [ ] Each model shows: name, description, supported features
- [ ] Admin can select which models are available per task
- [ ] Selected models are saved to the database

**Files likely touched:**

- `client/src/pages/settings/ModelsPage.tsx`
- `server/src/services/fal-service.ts`
- `client/src/hooks/useAdmin.ts` (add model browsing hooks)

**Estimated scope:** Medium (3 files)

---

### Task 22: Add model parameter configuration — dynamic form

**Description:** When Admin selects a model, fal.ai API returns the parameter schema. The UI renders a dynamic configuration form based on this schema (sliders for numbers, dropdowns for enums, text inputs for strings).

**Acceptance criteria:**

- [ ] Model parameter schema is fetched from fal.ai API
- [ ] Dynamic form renders based on parameter types (number → slider, enum → dropdown, string → text input)
- [ ] Admin can set default values and ranges for each parameter
- [ ] Configuration is saved and used when Artists/Clients generate with this model
- [ ] Form validates parameter values against schema constraints

**Files likely touched:**

- `client/src/pages/settings/ModelsPage.tsx`
- `client/src/components/ModelParameterForm.tsx` (new)
- `server/src/services/fal-service.ts`

**Estimated scope:** Medium (3 files)

---

### Task 23: Add Collections to sidebar nav

**Description:** Already covered in Task 3. This is a placeholder to ensure the nav item is wired to the correct route.

**Acceptance criteria:**

- [ ] Collections nav item appears for Artists and Clients
- [ ] Clicking navigates to `/collections`
- [ ] Route renders CollectionsPage

**Files likely touched:**

- `client/src/lib/navigation.ts`
- Router config

**Estimated scope:** XS (already done in Task 3)

---

### Task 24: Add Marketplace browse link for Artists

**Description:** Currently Artists only see "Marketplace" linking to `/marketplace/manage`. Add a separate "Marketplace" browse link so Artists can also browse the marketplace like Clients do.

**Acceptance criteria:**

- [ ] Artists see "Marketplace" in sidebar linking to `/marketplace` (browse)
- [ ] Artists also see "My Listings" or similar linking to `/marketplace/manage`
- [ ] Both links work correctly

**Files likely touched:**

- `client/src/lib/navigation.ts`

**Estimated scope:** XS (1 file)

---

### Task 25: Add Admin "Store" link under Marketplace

**Description:** Admin sidebar currently has Marketplace > Submissions, Listings Settings but no "Store" link. Add it so Admins can preview the client-facing marketplace.

**Acceptance criteria:**

- [ ] Admin sidebar shows "Store" link under Marketplace
- [ ] Store link navigates to `/marketplace`
- [ ] No regression for Artist/Client marketplace links

**Files likely touched:**

- `client/src/lib/navigation.ts`

**Estimated scope:** XS (1 file)

---

## Execution Order

### Phase 1 (Dashboard) — Tasks 1, 2, 3

All independent. Do in order 1 → 2 → 3.

### Phase 2 (Collections) — Tasks 4, 5, 6, 7, 8

- Task 4 (backend) first — blocks Tasks 5, 6, 7
- Tasks 5, 6, 7 can be done in parallel (different files)
- Task 8 (routing) after Tasks 5, 6

### Phase 3 (Actor Designer) — Tasks 9-16

- Task 9 (entry methods) first — changes the foundation
- Task 10 (stepper) independent
- Tasks 11, 12, 13 (layouts) can be done in parallel after Task 9
- Task 14 (sessions) after Tasks 11, 12, 13
- Task 15 (bug fix) can be done anytime
- Task 16 (dynamic taxonomy) after Task 11

### Phase 4 (Marketplace) — Tasks 17, 18, 19

- Task 17 (backend purchase flow) first — blocks 18, 19
- Tasks 18, 19 can be done in parallel after Task 17

### Phase 5 (Models) — Tasks 20, 21, 22

- Sequential: 20 → 21 → 22 (each depends on the previous)

### Phase 6 (Navigation) — Tasks 23, 24, 25

- All independent, can be done in any order
- Task 23 is already done in Task 3

---

## Risks and Mitigations

| Risk                                                                  | Impact | Mitigation                                                                                                   |
| --------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| Actor Designer redesign is large and touches many state variables     | High   | Break into small tasks (9-16), test each independently, keep session management separate from layout changes |
| Collections backend migration may conflict with existing schema       | Medium | New tables only (no schema changes to existing tables), test migration on dev DB first                       |
| fal.ai API integration may have rate limits or auth issues            | Medium | Test connection flow early (Task 20), handle errors gracefully, cache model list                             |
| Marketplace single-purchase model changes purchase flow significantly | High   | Update backend first (Task 17), test purchase end-to-end before frontend changes                             |
| Reference Photo bug may be a deeper validation issue                  | Low    | Investigate root cause in Task 15, may need backend validation changes too                                   |

## Open Questions

1. **Collections sharing:** Can Artists share Collections with Clients, or are they personal only? Recommendation: personal only for now, sharing is future scope.

2. **Generation session persistence:** Should sessions persist across page refreshes (stored in DB) or only for the current wizard session (in-memory)? Recommendation: in-memory only for now — simpler, no backend changes needed.

3. **fal.ai API key storage:** Should the key be stored in the database (encrypted) or as an environment variable? Recommendation: database with encryption at rest, since it's a per-workspace setting.

4. **Marketplace purchase — what happens to the Artist's copy?** When a Client buys an asset, does the Artist lose access? Recommendation: Artist retains a "sold" reference (can see it was sold) but the asset is transferred to the Client's library. The Artist's original asset record is marked as sold.

5. **Reference Photo max images:** What's the default max number of reference images if admin hasn't configured it? Recommendation: default to 3, admin can increase up to model limit.

---

## Verification (Final)

After all phases complete:

- [ ] `cd client && npx tsc --noEmit` — no type errors
- [ ] `cd server && npx tsc --noEmit` — no type errors
- [ ] `cd client && npx vitest run` — all tests pass
- [ ] `cd server && npx vitest run` — all tests pass
- [ ] Start server + client, manually verify:
  - [ ] Dashboard: Quick Actions grid fits items, Recent Activity max 2 rows
  - [ ] Collections: CRUD works, mixed assets, marketplace cards in collections
  - [ ] Actor Designer: 3 entry methods, stepper, split/full layouts, sessions, no auto-generate
  - [ ] Marketplace: single purchase, purchased assets hidden from others
  - [ ] Client search: separate "My Assets" and "Similar in Marketplace" sections
  - [ ] Models page: fal.ai key connection, model browser, parameter config
  - [ ] Navigation: Collections in sidebar, Artist marketplace browse, Admin Store link
