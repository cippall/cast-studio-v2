# Implementation Plan: Asset Pages Redesign

## Overview

The asset detail pages (Actor, Look, Fashion Item) and library pages look like a database admin UI — not a premium casting platform. Images are small and redundant, metadata uses card grids for key-value pairs, empty states are identical everywhere, and the layout wastes space. This plan redesigns the asset viewing experience around the principle that "content is the interface" — generated images should dominate, metadata should recede, and every page should feel like a gallery, not a spreadsheet.

## Architecture Decisions

- **Images are the product**: Detail pages should show images at full width/aspect ratio, not constrained to `max-w-md` sidebars
- **Split AssetDetailLayout**: One layout for multi-output assets (Actor), another for single-image assets (Look, Fashion Item)
- **Kill the card grid for metadata**: Properties become a simple key-value list, not a grid of identical bordered cards
- **Contextual empty states**: Different messages/ctAs for different missing states, not the same `ImageIcon` everywhere
- **Action hierarchy**: Primary actions (Submit to Marketplace) are visually dominant; secondary actions recede
- **DESIGN.md compliance**: All colors use design tokens (no hardcoded `text-emerald-500`), all spacing uses the 12px base unit scale

## Dependency Graph

```
Shared components (already exist)
    │
    ├── Fix GenerationStatus colors (hardcoded → tokens)
    ├── Fix EmptyStateV2 (contextual variants)
    └── Fix AssetDetailLayout (split into two layouts)
            │
            ├── ActorPage redesign (multi-output layout)
            ├── LookDetail redesign (single-image layout)
            └── FashionItemDetail redesign (single-image layout)
                    │
                    ├── Library card fixes (AssetCardV2 noise reduction)
                    └── ProductCard Buy flow fix
```

## Task List

### Phase 1: Shared Component Fixes

These are prerequisites — small, independent, and needed by multiple pages.

---

#### Task 1: Fix GenerationStatus hardcoded colors

**Description:** Replace hardcoded `text-emerald-500` with the `--success` design token. The component currently uses a Tailwind default that clashes with the warm stone palette.

**Acceptance criteria:**

- [ ] `text-emerald-500` replaced with `text-success` in GenerationStatus.tsx
- [ ] SUCCESS state uses `var(--success)` which is `oklch(0.65 0.15 135)` (muted olive, not emerald)
- [ ] No visual regression — check ActorPage, LookDetail, FashionItemDetail, CommissionDetail

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Generation status indicators render in muted olive green, not emerald

**Dependencies:** None
**Files:** `client/src/components/GenerationStatus.tsx`
**Estimated scope:** S (1 file, 1 line)

---

#### Task 2: Add contextual empty state variants to EmptyStateV2

**Description:** EmptyStateV2 currently accepts a generic icon + title + description. Add a `variant` prop that provides pre-configured empty states for common scenarios (no image, no assets, generation failed, etc.) so pages don't all show the same `ImageIcon`.

**Acceptance criteria:**

- [ ] EmptyStateV2 accepts `variant?: 'no-image' | 'no-assets' | 'generation-failed' | 'no-results'`
- [ ] Each variant has a distinct icon and default message (overridable)
- [ ] Existing usages without `variant` still work (backward compatible)
- [ ] ActorPage output sections use `'generation-failed'` variant for failed states
- [ ] Library pages use `'no-assets'` variant for empty libraries

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Empty states across pages show different icons/messages

**Dependencies:** None
**Files:** `client/src/components/EmptyStateV2.tsx`
**Estimated scope:** S (1 file)

---

#### Task 3: Split AssetDetailLayout into two layouts

**Description:** The current AssetDetailLayout forces every asset type into the same template (image sidebar + tabs). This is wrong for single-image assets (Look, Fashion Item) where the Overview and Outputs tabs show the same image. Create two specialized layouts.

**`MultiOutputAssetLayout`** (for Actors):

- Image sidebar (sticky on desktop) showing the primary output (headshot)
- Tabbed content area: Overview (metadata), Outputs (collapsible sections per output type), Properties (taxonomy)
- Each output section shows its own image + regenerate button
- Empty states per output section are contextual

**`SingleAssetLayout`** (for Looks, Fashion Items):

- Full-width hero image at top (not constrained to sidebar)
- Below image: name, badges, actions in a single row
- Tabbed content: Overview (metadata + source info), Properties (taxonomy)
- No redundant Outputs tab — the image IS the output
- Generation controls inline (regenerate button below image), not hidden in a tab

**Acceptance criteria:**

- [ ] `MultiOutputAssetLayout` created with breadcrumb, header, image sidebar, tabbed content
- [ ] `SingleAssetLayout` created with hero image, header, tabbed content
- [ ] Both use DESIGN.md typography (Libre Baskerville headings, Inter body)
- [ ] Both are responsive: stacked on mobile, side-by-side on desktop
- [ ] Image in SingleAssetLayout uses `w-full` with `aspect-ratio` container, not `max-w-md`

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] ActorPage uses MultiOutputAssetLayout (migrated in Task 4)
- [ ] LookDetail and FashionItemDetail use SingleAssetLayout (migrated in Tasks 5-6)

**Dependencies:** Tasks 1-2
**Files:** `client/src/components/layout/MultiOutputAssetLayout.tsx`, `client/src/components/layout/SingleAssetLayout.tsx`
**Estimated scope:** M (2 new files)

---

### Phase 2: Asset Detail Page Redesigns

---

#### Task 4: Redesign ActorPage with MultiOutputAssetLayout

**Description:** Migrate ActorPage to the new MultiOutputAssetLayout. Fix the redundant image display (sidebar + Overview tab showing same headshot). Fix the properties tab card grid. Fix action hierarchy.

**Acceptance criteria:**

- [ ] ActorPage uses `MultiOutputAssetLayout`
- [ ] Image sidebar shows headshot at full width of sidebar (not `max-w-md`)
- [ ] Overview tab shows metadata only (taxonomy values as key-value list, NOT card grid)
- [ ] Outputs tab shows collapsible sections per output type with contextual empty states
- [ ] Properties tab shows taxonomy as a simple list: `Label: Value` rows, no cards
- [ ] Primary action (Submit to Marketplace) is visually larger/more prominent
- [ ] Secondary actions (Duplicate, Regenerate) are outline/ghost buttons
- [ ] Missing outputs show what's needed: "Missing: character_sheet, editorial" text below disabled Submit button
- [ ] No duplicate image display (sidebar image removed from Overview tab)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Actor with all outputs: images are large, metadata is clean
- [ ] Actor with no outputs: empty states are contextual per section
- [ ] Responsive at 375px, 768px, 1024px, 1440px

**Dependencies:** Task 3
**Files:** `client/src/pages/actors/ActorPage.tsx`, `client/src/pages/actors/useActorPageRender.tsx`
**Estimated scope:** M (2 files)

---

#### Task 5: Redesign LookDetail with SingleAssetLayout

**Description:** Migrate LookDetail to SingleAssetLayout. The current page shows the same image in the sidebar AND in the Overview AND in the Outputs tab. The hero image should be the focus. Properties should be a list, not a card grid.

**Acceptance criteria:**

- [ ] LookDetail uses `SingleAssetLayout`
- [ ] Hero image fills the content width (constrained by aspect ratio, not `max-w-2xl`)
- [ ] No redundant Outputs tab — image is shown once at top
- [ ] Overview tab shows source info only (no duplicate image)
- [ ] Properties tab shows taxonomy as key-value list, not card grid
- [ ] Regenerate button is inline below image, not hidden in a tab
- [ ] Empty state for no image: contextual message ("No look generated yet") with Generate button
- [ ] Status badges use design token colors (not hardcoded)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Look with image: hero image dominates, metadata below
- [ ] Look without image: empty state with Generate CTA
- [ ] Responsive at 375px, 768px, 1024px

**Dependencies:** Task 3
**Files:** `client/src/pages/looks/LookDetail.tsx`
**Estimated scope:** S (1 file)

---

#### Task 6: Redesign FashionItemDetail with SingleAssetLayout

**Description:** Same as Task 5 but for Fashion Items. Identical structure, different data.

**Acceptance criteria:**

- [ ] FashionItemDetail uses `SingleAssetLayout`
- [ ] Hero image fills content width
- [ ] No redundant Outputs tab
- [ ] Properties as key-value list
- [ ] Regenerate button inline
- [ ] Contextual empty states

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Same visual quality as LookDetail

**Dependencies:** Task 3
**Files:** `client/src/pages/fashion-items/FashionItemDetail.tsx`
**Estimated scope:** S (1 file)

---

### Phase 2b: Action Toolbar Hierarchy (after Tasks 4-6)

---

#### Task 6b: Fix action toolbar visual hierarchy on all asset detail pages

**Description:** All three asset detail pages render action buttons with equal visual weight (`flex flex-wrap gap-2`). "Submit to Marketplace" looks identical to "Duplicate." Primary actions should be visually dominant; secondary actions should recede.

**Acceptance criteria:**

- [ ] Primary action (Submit to Marketplace) uses `size="default"` filled button (already default variant)
- [ ] Secondary actions (Duplicate, Regenerate Headshot) use `variant="outline" size="sm"` — smaller, outline style
- [ ] Destructive action (Delete) uses `variant="outline" size="sm"` with `text-destructive` — clearly dangerous but not competing with primary
- [ ] Actions ordered left-to-right: [Primary] [Secondary...] [Destructive last]
- [ ] Applied to ActorPage, LookDetail, FashionItemDetail
- [ ] Missing outputs hint ("Missing: character_sheet, editorial") shown as muted text below the disabled Submit button, not as a tooltip

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Submit to Marketplace is visually the most prominent button
- [ ] Duplicate/Regenerate are clearly secondary
- [ ] Delete looks dangerous but not primary

**Dependencies:** Tasks 4, 5, 6
**Files:** `client/src/pages/actors/useActorPageRender.tsx`, `client/src/pages/looks/LookDetail.tsx`, `client/src/pages/fashion-items/FashionItemDetail.tsx`
**Estimated scope:** S (3 files, small changes)

---

#### Task 6c: Add image zoom/lightbox to asset detail pages

**Description:** For a casting platform where "the generated images ARE the product," there's no way to view images at full resolution. Images are constrained to `max-w-md` or `max-w-2xl`. Add a click-to-zoom lightbox so users can inspect generated images at full resolution.

**Acceptance criteria:**

- [ ] Clicking any image on a detail page opens a lightbox overlay
- [ ] Lightbox shows the image at full resolution (up to viewport size)
- [ ] Lightbox has a close button (X) and closes on Escape key or clicking outside
- [ ] Lightbox has a subtle backdrop blur (not full black — keep it elegant)
- [ ] Works on ActorPage (sidebar image + each output image), LookDetail (hero image), FashionItemDetail (hero image)
- [ ] Mobile: lightbox fills the screen, image is pinch-to-zoom capable (browser default)
- [ ] No layout shift when lightbox opens (position: fixed overlay)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Click image → lightbox opens with full-res image
- [ ] Close button, Escape, and click-outside all close the lightbox
- [ ] No console errors
- [ ] Works at 375px, 768px, 1024px, 1440px

**Dependencies:** Tasks 4, 5, 6
**Files:** `client/src/components/ui/ImageLightbox.tsx` (new), `client/src/components/layout/MultiOutputAssetLayout.tsx`, `client/src/components/layout/SingleAssetLayout.tsx`
**Estimated scope:** M (1 new component + integrate into 2 layouts)

---

### Phase 3: Library Card & Marketplace Fixes

---

#### Task 7: Reduce AssetCardV2 visual noise

**Description:** Library cards currently show up to 4 badges (type, status, marketplace, tags) plus creator name plus date plus hover actions. At 10px font size, badges are barely readable. Simplify.

**Acceptance criteria:**

- [ ] Remove the separate type badge — type is conveyed by the library section heading
- [ ] Combine status + marketplace into a single indicator (dot + tooltip, not two badges)
- [ ] Tags shown as simple text, not Badge components
- [ ] Creator name removed from card (shown on detail page instead)
- [ ] Date shown as relative time ("2d ago") not absolute
- [ ] Hover actions simplified: only the 3-dot menu (remove AddToCollection from card — it belongs in the detail page)
- [ ] Badge font size minimum 11px (not 10px)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Library cards are cleaner, less cluttered
- [ ] All information still accessible (just not all on the card)

**Dependencies:** None
**Files:** `client/src/components/AssetCardV2.tsx`
**Estimated scope:** S (1 file)

---

#### Task 8: Fix ProductCard Buy flow

**Description:** ProductCard's `onBuy` callback navigates to the detail page instead of purchasing. The button says "Buy" but doesn't buy. Either rename to "View Details" or implement quick-purchase.

**Acceptance criteria:**

- [ ] ProductCard button renamed to "View Details" (since it navigates to detail)
- [ ] OR: implement quick-purchase dialog from the card (preferred — keeps the "Buy" label)
- [ ] If quick-purchase: show a confirmation dialog with price + balance, then purchase
- [ ] Insufficient balance state still works (disabled button with explanation)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Marketplace cards have clear, honest CTAs

**Dependencies:** None
**Files:** `client/src/components/ProductCard.tsx`, `client/src/pages/marketplace/MarketplacePage.tsx`
**Estimated scope:** S (2 files)

---

#### Task 9: Fix library grid to use auto-fit

**Description:** All library pages use fixed breakpoint grids (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). When there are fewer items than columns, empty gaps appear. User preference: "No empty grid gaps."

**Acceptance criteria:**

- [ ] LibraryLayout grid uses `grid-cols-[repeat(auto-fill,minmax(280px,1fr))]`
- [ ] No empty gaps regardless of item count
- [ ] Cards still have a reasonable max width (don't stretch to fill 2000px)
- [ ] All three library pages (Actors, Looks, Fashion Items) updated

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] 2 items in a library: no empty gap in row 2
- [ ] 5 items: fills naturally without forced 4-col layout

**Dependencies:** None
**Files:** `client/src/components/layout/LibraryLayout.tsx`
**Estimated scope:** S (1 file, 1 line)

---

### Phase 4: ActorOutputs cleanup

---

#### Task 10: Remove Card wrapper from ActorOutputs collapsibles

**Description:** Each output section in ActorOutputs is a `Card` containing a `Collapsible`. This creates nested borders (Card border + Collapsible border = ghost card pattern). Remove the Card wrapper.

**Acceptance criteria:**

- [ ] ActorOutputs uses Collapsible directly, no Card wrapper
- [ ] Each output section has a single border (from Collapsible)
- [ ] GenerationStatus moved outside the collapsible trigger (shown in section header)
- [ ] No visual regression in spacing or alignment

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Actor output sections have clean single borders
- [ ] Expand/collapse still works

**Dependencies:** Task 4
**Files:** `client/src/pages/actors/ActorOutputs.tsx`
**Estimated scope:** S (1 file)

---

#### Task 11: Fix ActorPage properties tab — use formatLabel

**Description:** The Properties tab in useActorPageRender.tsx renders raw taxonomy keys (`body_type`) instead of formatted labels (`Body Type`). The Overview tab correctly uses `formatLabel()`.

**Acceptance criteria:**

- [ ] Properties tab uses `formatLabel(key)` instead of raw `key`
- [ ] Properties displayed as a simple list, not a card grid
- [ ] Single implementation shared between Overview and Properties (don't duplicate the taxonomy rendering)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Properties tab shows "Body Type: Athletic" not "body_type: Athletic"

**Dependencies:** Task 4
**Files:** `client/src/pages/actors/useActorPageRender.tsx`
**Estimated scope:** S (1 file)

---

## Execution Order

```
Phase 1 (parallel):  Task 1, Task 2, Task 9
                      ↓
Phase 2 (sequential): Task 3 → Task 4, Task 5, Task 6 (parallel after Task 3)
                      ↓
Phase 3 (parallel):  Task 7, Task 8
                      ↓
Phase 4 (after T4):  Task 10, Task 11
```

**Recommended order:**

1. Task 1 (GenerationStatus colors) — 1 line, no risk
2. Task 2 (EmptyStateV2 variants) — backward compatible
3. Task 9 (Library grid auto-fit) — 1 line, no risk
4. Task 3 (Split AssetDetailLayout) — foundation for Tasks 4-6
5. Task 4 (ActorPage redesign) — depends on Task 3
6. Task 5 (LookDetail redesign) — depends on Task 3, parallel with Task 4
7. Task 6 (FashionItemDetail redesign) — depends on Task 3, parallel with Tasks 4-5
8. Task 7 (AssetCardV2 noise reduction) — independent
9. Task 8 (ProductCard Buy flow) — independent
10. Task 10 (ActorOutputs Card removal) — depends on Task 4
11. Task 11 (formatLabel fix) — depends on Task 4

## Checkpoints

### Checkpoint 1: After Tasks 1-3, 9

- [ ] `npx tsc --noEmit` passes
- [ ] Generation status uses muted olive, not emerald
- [ ] Library grids use auto-fit
- [ ] Empty state variants available
- [ ] Two new layout components created

### Checkpoint 2: After Tasks 4-6

- [ ] All three detail pages use new layouts
- [ ] Images are full-width, not constrained
- [ ] No redundant image display
- [ ] Properties are lists, not card grids
- [ ] Responsive at all breakpoints

### Checkpoint 3: After Tasks 7-8

- [ ] Library cards are cleaner
- [ ] ProductCard Buy flow is honest
- [ ] No visual regression

### Checkpoint 4: After Tasks 10-11

- [ ] ActorOutputs has clean single borders
- [ ] Properties show formatted labels
- [ ] All acceptance criteria met

## Risks and Mitigations

| Risk                                                                         | Impact | Mitigation                                                                                    |
| ---------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| New layout components break existing pages still using old AssetDetailLayout | High   | Keep old AssetDetailLayout until all pages migrate; delete only after all migrations complete |
| Removing Card wrapper from ActorOutputs changes spacing                      | Medium | Verify padding matches DESIGN.md spec (36px → use p-6)                                        |
| EmptyStateV2 variant prop breaks existing usages                             | Low    | Make variant optional; existing usages without it still work                                  |
| ProductCard quick-purchase requires wallet balance check                     | Medium | Reuse existing `useWalletBalance` hook; show loading state while fetching                     |

## Recommended Skills Per Task

| Task    | Skill                                             | Why                                                      |
| ------- | ------------------------------------------------- | -------------------------------------------------------- |
| Task 1  | None                                              | Single-line color token fix                              |
| Task 2  | impeccable                                        | Component API design — backward-compatible prop addition |
| Task 3  | impeccable + agent-skills-frontend-ui-engineering | Layout component design — the core structural change     |
| Task 4  | impeccable + agent-skills-frontend-ui-engineering | Page-level redesign with layout adoption                 |
| Task 5  | impeccable + agent-skills-frontend-ui_engineering | Page-level redesign (same pattern as Task 4)             |
| Task 6  | impeccable + agent-skills-frontend_ui_engineering | Page-level redesign (same pattern as Tasks 4-5)          |
| Task 7  | impeccable                                        | Component simplification — reducing visual noise         |
| Task 8  | None                                              | Simple flow fix — rename or add dialog                   |
| Task 9  | None                                              | Single-line grid fix                                     |
| Task 10 | None                                              | Remove wrapper component                                 |
| Task 11 | None                                              | Single-line formatLabel fix                              |
