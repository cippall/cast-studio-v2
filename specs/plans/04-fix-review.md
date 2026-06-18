# Fix Plan: Code Review Issues (UI-T22..UI-T26)

## Overview

Fixes for 17 issues found in code review of commits d3d19d6a..882a527b.
Scope: 40 files, +2691/-1900 lines changed.

## Issues Found (from review)

### Important (7)

1. LibraryLayout/DataTable — `items: readonly any[]`, no type safety
2. DataTable sort — getSortValue coerces ReactNode to string, silently wrong for JSX columns
3. Sidebar — `useUIStore.getState()` in render, doesn't subscribe to changes
4. ApiKeysPage — duplicate table rendering, doesn't use shared DataTable
5. CommissionFormsPage — `form.fields.length` crashes if fields is undefined
6. NewCommission — brief defaultValues use stale fields (fragile if loading guard removed)
7. MarketplaceDetail — missing error state (conflates "not found" with "error")

### Nit (6)

8. ApiKeysPage — actionPath="#" on empty state buttons should open create dialog
9. ErrorState — border-border-medium class may not exist
10. CommissionFormsPage — unicode bullet instead of Badge component
11. AdminSubmissions — id mapping hack (asset_id → id) fragile if onRowClick added
12. LibraryLayout — activeFilterCount not memoized
13. CommissionsList — formatRelativeTime not memoized

### Skipped (from review, not actionable)

- #14 (DataTable 367 lines) — user said ignore 200+ line files
- #15 (MarketplaceDetail loading/error) — covered by #7
- #16 (ApiKeysPage full key display) — intentional for admin page
- #17 (LibraryLayout activeFilterCount) — covered by #12
- #18 (CommissionsList formatRelativeTime) — covered by #13

---

## Issues Found (from UI spec audit)

### Spec Compliance Gaps

#### GAP-1: Admin sidebar missing "Store" link

**Spec:** Admin sidebar has Marketplace > Store, Submissions, Listings Settings
**Code:** `navigation.ts:62-64` — Admin has Submissions and Listings Settings but NO "Store" link
**Impact:** Admin cannot preview the client-facing marketplace storefront
**Fix:** Add `{ label: 'Store', path: '/marketplace', icon: ShoppingBag }` to admin marketplace children in `navigation.ts`
**Acceptance:**

- [ ] Admin sidebar shows "Store" link under Marketplace
- [ ] Store link navigates to `/marketplace`
- [ ] No regression for Artist/Client marketplace links

#### GAP-2: Dashboard "Recent Activity" always empty

**Spec:** Section 2 is "Recent Activity" — horizontal scrollable list (capped at 10) with thumbnail, name, action badge, timestamp
**Code:** `Dashboard.tsx:157-164` — shows EmptyStateV2 "No recent activity" always
**Impact:** Dashboard always shows empty state for recent activity. No actual activity feed exists.
**Fix:** Implement activity feed query + UI. Create `useActivityFeed` hook (or add to `useDashboard`). Show last 10 activities with thumbnail, name, action badge, relative timestamp. Fall back to EmptyStateV2 only when genuinely empty.
**Acceptance:**

- [ ] Dashboard shows up to 10 recent activities when they exist
- [ ] Each activity shows: thumbnail, asset name, action badge (Created/Generated/Shared), relative timestamp
- [ ] Empty state shows only when no activities exist
- [ ] Loading state shows skeleton during fetch

#### GAP-3: "Submit to Marketplace" doesn't show what's missing

**Spec:** Button should be disabled when missing required outputs, showing what's missing (e.g., "Submit to Marketplace — Missing: character_sheet, editorial")
**Code:** `ActorPage.tsx:573-580` — button disabled when `!hasRequiredOutputs || isFrozen` but disabled state doesn't show WHAT is missing
**Impact:** Users don't know what outputs they're missing
**Fix:** When disabled due to missing outputs, show a tooltip or text listing the missing required outputs. Use the admin settings' `required_outputs` list to compare against existing outputs.
**Acceptance:**

- [ ] Disabled button shows which outputs are missing
- [ ] Tooltip or inline text: "Missing: character_sheet, editorial"
- [ ] Button shows count of missing items

#### GAP-4: No marketplace status badges on library cards

**Spec:** Asset cards in library view should show marketplace status badges (Pending/Listed/Rejected)
**Code:** No marketplace status badges on AssetCardV2 or library card rendering
**Impact:** Users can't see marketplace submission status from the library view
**Fix:** Add marketplace status to AssetCardV2 props. Show badge: blue "Pending", green "Listed", red "Rejected". Fetch marketplace status in library queries or include in card data.
**Acceptance:**

- [ ] Library cards show marketplace status badge when asset has been submitted
- [ ] Badge colors: blue (Pending), green (Listed), red (Rejected)
- [ ] No badge when asset has not been submitted
- [ ] Badge is small and doesn't clutter the card

#### GAP-5: Notifications not dispatched for key actions

**Spec:** "Both in-app and email for all key status changes"
**Code:** NotificationDropdown + hooks exist, but many actions that should trigger notifications don't dispatch them
**Impact:** Users have no way to know about important events unless they check manually
**Fix:** Add notification dispatch calls to:

- Commission status changes (submit, approve, reject, assign)
- Marketplace submission/approval/rejection
- Asset sharing events
  Use existing `useCreateNotification` hook (or create one if missing) after the relevant mutation succeeds.
  **Acceptance:**
- [ ] Commission assigned → notification to assignee
- [ ] Commission submitted → notification to client
- [ ] Commission approved → notification to artist
- [ ] Marketplace submission approved → notification to submitter
- [ ] Marketplace submission rejected → notification to submitter
- [ ] Notifications appear in NotificationDropdown

#### GAP-6: "Add Model" + "New Form" buttons permanently disabled

**Spec:** "+ Add Model button opens fal.ai model browser", "+ New Form button"
**Code:**

- `ModelsPage.tsx:87-90` — "Add Model" button is `disabled`
- `CommissionFormsPage.tsx:48-51` — "New Form" button is `disabled`
  **Impact:** Placeholder buttons that should either be implemented or clearly labeled as "Coming Soon"
  **Fix:** Either implement the functionality or add a tooltip/badge explaining these are not yet implemented. If implementing:
- Add Model: Open a dialog/form to add a new model configuration
- New Form: Open a dialog to create a new commission form template
  **Acceptance:**
- [ ] "Add Model" button is either functional or clearly marked as not yet implemented
- [ ] "New Form" button is either functional or clearly marked as not yet implemented
- [ ] No permanently disabled buttons without explanation

#### GAP-7: Commission detail may lack "Submitted Work" display

**Spec:** Commission Detail page shows "Submitted Work" section with thumbnail grid + Approve/Changes buttons
**Code:** `CommissionDetail.tsx` — has BriefSection, ClientActions, ArtistActions, AdminActions. Submitted work display may be missing or inside BriefSection
**Impact:** May not show submitted work assets in the detail view
**Fix:** Verify BriefSection renders submitted work. If missing, add a "Submitted Work" section showing asset thumbnails with Approve/Changes buttons for client role.
**Acceptance:**

- [ ] Commission detail shows submitted work assets when artist has submitted
- [ ] Client sees Approve and Changes buttons on submitted work
- [ ] Thumbnail grid is responsive (1 col mobile, 2-3 col desktop)

#### GAP-8: GenerationStatus not used in Look/FashionItem creators

**Spec:** Section 9 defines a reusable GenerationStatus component (PENDING/SUCCESS/FAILED states)
**Code:** `GenerationStatus` component exists and is used in ActorDesigner. LookDesigner and FashionItemCreator likely have their own generation UI
**Impact:** Inconsistent generation status display across the three creation tools
**Fix:** Refactor LookDesigner and FashionItemCreator to use the shared GenerationStatus component instead of custom generation UI
**Acceptance:**

- [ ] All three creators use GenerationStatus component
- [ ] PENDING/SUCCESS/FAILED states display consistently
- [ ] No regression in generation flow

#### GAP-9: Profile has no "Save Changes" button

**Spec:** Settings > Profile has Name, Email fields + "Save Changes" button
**Code:** `SettingsPage.tsx:65-85` — Name and Email inputs are `disabled` with no Save button
**Impact:** Users cannot edit their profile information
**Fix:** Make fields editable, add "Save Changes" button that calls the profile update API
**Acceptance:**

- [ ] Name and Email fields are editable
- [ ] "Save Changes" button exists and is enabled when fields are modified
- [ ] Save calls API and shows success toast

---

## Tasks

### FIX-1: Sidebar subscription bug

**File:** `client/src/components/Sidebar.tsx:140`
**Problem:** `useUIStore.getState().sidebarCollapsed` doesn't trigger re-renders.
**Fix:** Replace with `useUIStore((s) => s.sidebarCollapsed)` to subscribe to store changes.
**Acceptance:**

- [ ] Sidebar re-renders when collapsed state changes
- [ ] No regression in sidebar toggle behavior

### FIX-2: ApiKeysPage — replace duplicate table with DataTable

**File:** `client/src/pages/settings/ApiKeysPage.tsx`
**Problem:** Page has its own desktop/mobile table rendering instead of using shared DataTable.
**Fix:** Replace the hand-rolled table + mobile card list with `<DataTable<ApiKey>>`. Define columns with `key`, `header`, `render`. Use `rowActions` for revoke. Keep the create/revoke dialogs unchanged.
**Acceptance:**

- [ ] Page uses DataTable component
- [ ] Desktop table renders correctly with Name, Key, Status, Created columns
- [ ] Mobile card list renders correctly
- [ ] Loading skeleton works via DataTable's built-in loading state
- [ ] Empty state works via DataTable's built-in empty state
- [ ] Revoke action still works via rowActions
- [ ] No visual regression

### FIX-3: CommissionFieldsPage — guard form.fields access

**File:** `client/src/pages/settings/CommissionFormsPage.tsx:74`
**Problem:** `form.fields.length` throws if fields is undefined/null.
**Fix:** Use `form.fields?.length ?? 0`.
**Acceptance:**

- [ ] No crash when form template has no fields
- [ ] Field count displays correctly

### FIX-4: MarketplaceDetail — add error state

**File:** `client/src/pages/marketplace/MarketplaceDetail.tsx`
**Problem:** No error state — only loading and "not found". API errors show nothing.
**Fix:** Add `isError` + `error` handling using `ErrorState` component, matching the pattern in `CommissionDetail.tsx`.
**Acceptance:**

- [ ] Error state renders when API call fails
- [ ] Loading state renders during fetch
- [ ] Not found state renders when listing is null
- [ ] Purchase flow still works

### FIX-5: ApiKeysPage — empty state actionPath

**File:** `client/src/pages/settings/ApiKeysPage.tsx:149,220`
**Problem:** Empty state "New Key" button navigates to `#` instead of opening create dialog.
**Fix:** Replace `EmptyStateV2` with a custom empty state that has an `onClick` handler calling `setShowCreate(true)`, or wrap the action. Since EmptyStateV2 doesn't support onClick, use a simple inline empty state with a Button that calls `setShowCreate(true)`.
**Acceptance:**

- [ ] Empty state "New Key" button opens create dialog
- [ ] No more `actionPath="#"`

### FIX-6: LibraryLayout — add generic type parameter

**File:** `client/src/components/layout/LibraryLayout.tsx`
**Problem:** `items: readonly any[]` and `renderCard: (item: any, index: number)` — no type safety.
**Fix:** Make LibraryLayout generic: `LibraryLayout<T>`, thread T through items, renderCard, renderListRow. Update all call sites to pass the type parameter.
**Acceptance:**

- [ ] LibraryLayout accepts a generic type parameter
- [ ] renderCard receives typed item (not any)
- [ ] All existing call sites still compile (type inference should work)
- [ ] No runtime behavior change

### FIX-7: DataTable sort — fix getSortValue for JSX columns

**File:** `client/src/components/DataTable.tsx:335-345`
**Problem:** getSortValue returns `[object Object]` for ReactNode renders, making sort incorrect.
**Fix:** Add a `sortValue` option to Column interface. When provided, use it for sorting instead of the rendered output. Default to existing behavior for backward compat. Update columns that have JSX renders to provide explicit sortValue.
**Acceptance:**

- [ ] Column interface has optional `sortValue?: (row: T) => string | number`
- [ ] Sort works correctly on columns with JSX renders (e.g., Badge components)
- [ ] No regression for columns without sortValue

### FIX-8: NewCommission — guard brief defaultValues

**File:** `client/src/pages/commissions/NewCommission.tsx:44`
**Problem:** defaultValues computed once, won't update if fields change after mount.
**Fix:** Move defaultValues into a useMemo keyed on fields, or compute inside the form's `defaultValues` option reactively. Since `templatesLoading` gates the form, this is low risk — but make it correct by using `useMemo` for the default brief.
**Acceptance:**

- [ ] Form brief fields update if template changes
- [ ] No regression in form submission

### FIX-9: ErrorState — verify border-border-medium

**File:** `client/src/components/ErrorState.tsx:36`
**Problem:** `border-border-medium` may not be a defined Tailwind class.
**Fix:** Check tailwind config. If undefined, replace with `border-border` or remove.
**Acceptance:**

- [ ] Error state renders with visible border
- [ ] No missing class warning in console

### FIX-10: CommissionsList — memoize formatRelativeTime results

**File:** `client/src/pages/commissions/CommissionsList.tsx:69-81`
**Problem:** formatRelativeTime called for every card on every render.
**Fix:** Memoize the commission list rendering with useMemo, or extract CommissionCard to its own component with React.memo so it only re-renders when props change.
**Acceptance:**

- [ ] CommissionCard doesn't re-render unnecessarily
- [ ] Relative time displays correctly

---

## Execution Order

### Code Review Fixes (FIX-1..FIX-10)

FIX-1, FIX-3, FIX-5, FIX-9 — independent, can be done in any order
FIX-2 — depends on understanding DataTable API (FIX-7 first if doing both)
FIX-4 — independent
FIX-6 — independent, but touches LibraryLayout which many pages use — do early, verify no breakage
FIX-7 — do before FIX-2
FIX-8, FIX-10 — independent, low risk

**Recommended order:**

1. FIX-1 (Sidebar subscription) — 1 line change
2. FIX-3 (form.fields guard) — 1 line change
3. FIX-5 (empty state actionPath) — small change
4. FIX-9 (border class) — 1 line change
5. FIX-6 (LibraryLayout generic) — medium, verify all call sites
6. FIX-7 (DataTable sortValue) — medium, update Column interface
7. FIX-2 (ApiKeysPage → DataTable) — depends on FIX-7
8. FIX-4 (MarketplaceDetail error state) — medium
9. FIX-8 (NewCommission defaultValues) — small
10. FIX-10 (CommissionsList memo) — small

### Spec Compliance Fixes (GAP-1..GAP-9)

GAP-1, GAP-3, GAP-4, GAP-6, GAP-9 — independent, can be done in any order
GAP-2 — depends on backend activity feed support (may need API endpoint)
GAP-5 — depends on notification dispatch infrastructure
GAP-7 — depends on BriefSection audit
GAP-8 — independent, but touches all 3 creator pages

**Recommended order:**

1. GAP-1 (Admin Store link) — 1 line change
2. GAP-9 (Profile Save Changes) — small
3. GAP-3 (Submit to Marketplace missing outputs) — small
4. GAP-4 (Marketplace status badges) — medium
5. GAP-6 (Disabled buttons) — medium
6. GAP-7 (Commission Submitted Work) — medium, needs BriefSection audit
7. GAP-8 (GenerationStatus in all creators) — medium
8. GAP-2 (Recent Activity) — medium, may need backend support
9. GAP-5 (Notification dispatch) — medium, needs hook audit

## Verification

- [ ] `cd client && npx tsc --noEmit` — no type errors
- [ ] `cd client && npx vitest run` — all tests pass
- [ ] `cd server && npx vitest run` — all tests pass (unlikely to break, but verify)
- [ ] Start server + client, manually verify:
  - [ ] Sidebar collapse/expand works (FIX-1)
  - [ ] ApiKeysPage table renders + revoke works (FIX-2)
  - [ ] CommissionFormsPage doesn't crash with empty fields (FIX-3)
  - [ ] MarketplaceDetail shows error on API failure (FIX-4)
  - [ ] LibraryLayout pages still render (FIX-6)
  - [ ] Admin sidebar shows Store link (GAP-1)
  - [ ] Dashboard shows recent activity (GAP-2)
  - [ ] Submit to Marketplace shows missing outputs (GAP-3)
  - [ ] Library cards show marketplace status badges (GAP-4)
  - [ ] Commission detail shows submitted work (GAP-7)
  - [ ] All creators use GenerationStatus (GAP-8)
  - [ ] Profile can be edited and saved (GAP-9)
