# Implementation Plan: UI Design System + Responsive Layouts

## Overview

The UI ignores the DESIGN.md spec entirely — wrong colors (cold grayscale instead of warm stone), wrong fonts (Geist instead of Libre Baskerville + Inter), wrong radius (10px instead of 0px), wrong shadows (present instead of flat). 20 of 33 pages have zero responsive breakpoints. 12 of 27 installed shadcn components are unused. Pages are built as one-off layouts with zero shared content patterns — no reusable StatCard, ProductCard, DetailLayout, or DataTable. This plan implements DESIGN.md compliance, builds a shared composite component library, adds multi-device support, and migrates all 33 pages to the new system in small, independently-committable vertical slices.

## Architecture Decisions

- **DESIGN.md is the source of truth** — not the shadcn defaults. Every CSS variable, font, and component style must match the spec.
- **Foundation first** — CSS variables and Tailwind config before touching any component. If the foundation is wrong, every component built on it is wrong.
- **Responsive is a layout concern, not a component concern** — shared layout components (PageContainer, PageHeader) handle breakpoints so individual pages don't reinvent them.
- **Each slice must compile and run** — no broken states between slices. Verify with tsc + vite + manual check after each.
- **Shared components before page migration** — build composite components (LibraryLayout, AssetDetailLayout, DataTable, etc.) first, then pages adopt them. This prevents each page from reinventing layout and ensures consistency.
- **Wire up unused shadcn primitives** — 12 of 27 installed components are unused (Tabs, DropdownMenu, Avatar, Tooltip, Progress, Alert, etc.). These are the building blocks for the composite components.

## Slicing Strategy

Vertical slices, foundation-first:

```
Phase 1: Design Foundation
  Slice 1: CSS variables + Tailwind config (foundation)
      → Colors, fonts, radius, shadows match DESIGN.md
      → App still works, just looks different
  Slice 2: Font installation + loading
      → Libre Baskerville + Inter + Source Code Pro loaded
      → Headings use serif, body uses sans

Phase 2: Core Components
  Slice 3: Button component → DESIGN.md spec
      → Padding, radius, flat, colors match spec
  Slice 4: Card component → DESIGN.md spec
      → 36px padding, border-only, no shadow
  Slice 5: Input/Form components → DESIGN.md spec
      → 48px height, 0px radius, focus ring
  Slice 5b: Theme toggle + dark mode palette
      → Warm dark palette, toggle button in TopBar

Phase 2.5: Shared Composite Components
  Slice 6: Install missing shadcn primitives (Sheet, Breadcrumb, AspectRatio)
  Slice 7: PageContainer + PageHeader + PageToolbar
  Slice 8: StatCard (dashboard stats)
  Slice 9: AssetCardV2 (library cards with consistent metadata)
  Slice 10: LibraryLayout (grid/list toggle + filter sidebar + sort + pagination)
  Slice 11: AssetDetailLayout (tabs-based detail: Overview / Outputs / Properties)
  Slice 12: SettingsLayout (sidebar nav + content area)
  Slice 13: DataTable (sortable, paginated table for admin/settings)
  Slice 14: EmptyStateV2 + ErrorState + LoadingState
  Slice 15: ProductCard (marketplace listings)

Phase 3: Responsive App Shell
  Slice 16: AppShell + Sidebar + TopBar → responsive + DESIGN.md
      → Mobile: collapsible sidebar → Sheet drawer, TopBar adapts
      → Desktop: sidebar visible, TopBar full

Phase 4: Page Migration (pages adopt shared components)
  Slice 17: Dashboard → StatCard + PageContainer
  Slice 18: Library pages → LibraryLayout + AssetCardV2
  Slice 19: Detail pages → AssetDetailLayout
  Slice 20: Marketplace pages → ProductCard + PageContainer
  Slice 21: Commission pages → PageContainer + responsive
  Slice 22: Settings pages → SettingsLayout + DataTable
  Slice 23: Admin pages → DataTable + PageContainer
  Slice 24: Designer/Creator pages → responsive wizard

Phase 5: Polish
  Slice 25: Audit remaining shadcn defaults
  Slice 26: Error + loading states everywhere
```

## Task List

### Phase 1: Design Foundation

#### Task 1: CSS variables + Tailwind config (Slice 1)

**Description:** Rewrite index.css :root variables and tailwind.config.js to match DESIGN.md color palette, radius, and spacing.

**Acceptance criteria:**

- [ ] Primary is #78716C (stone), not pure black
- [ ] Background is #FAFAF9 (warm white), not pure white
- [ ] Text primary is #1C1917 (warm black)
- [ ] --radius is 0px
- [ ] All shadow utilities removed from tailwind config
- [ ] Semantic colors defined (success #65A30D, warning #CA8A04, error #DC2626)
- [ ] Border colors defined (subtle #E7E5E4, medium #D6D3D1, strong #A8A29E)
- [ ] Dark mode variables updated to warm dark equivalents

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] `npx vite build` succeeds
- [ ] App loads, colors are visibly different (warm stone palette)
- [ ] No console errors

**Dependencies:** None
**Estimated scope:** S (2 files: index.css, tailwind.config.js)

---

#### Task 2: Font installation + loading (Slice 2)

**Description:** Install Libre Baskerville, Inter, and Source Code Pro. Wire them into the font system per DESIGN.md typography spec.

**Acceptance criteria:**

- [ ] Libre Baskerville installed and loaded (headings)
- [ ] Inter installed and loaded (body/UI)
- [ ] Source Code Pro installed and loaded (code)
- [ ] CSS variables --font-heading, --font-body, --font-mono set correctly
- [ ] Geist Variable import removed
- [ ] Tailwind config fontFamily maps to the new fonts

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] App loads, headings render in serif, body in sans-serif
- [ ] No font loading errors in console

**Dependencies:** Task 1
**Estimated scope:** S (3-4 files: package.json, index.css, tailwind.config.js)

---

### Checkpoint: Foundation

- [ ] Colors match DESIGN.md
- [ ] Fonts match DESIGN.md
- [ ] Radius is 0px everywhere
- [ ] No shadows
- [ ] App is usable, just restyled
- [ ] Review with human before proceeding

---

### Phase 2: Core Components

#### Task 3: Button component → DESIGN.md spec (Slice 3)

**Description:** Update button.tsx to match DESIGN.md button spec — padding, flat styling, colors, sizes.

**Acceptance criteria:**

- [ ] Primary: bg #78716C, text #FAFAF9, 0px radius, 12px 24px padding
- [ ] Secondary: transparent bg, #78716C text, 1px solid #D6D3D1 border
- [ ] Ghost: transparent, no border, #78716C text
- [ ] Destructive: bg #DC2626, text #FAFAF9
- [ ] Hover states match spec (Primary → #57534E, Secondary/Ghost → bg #F5F5F4)
- [ ] Sizes: Small (8px 16px / 13px), Medium (12px 24px / 15px), Large (16px 36px / 17px)
- [ ] Disabled: opacity 0.4, no hover change
- [ ] forwardRef preserved (from earlier fix)
- [ ] No shadow utilities

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Buttons render with correct colors and flat styling
- [ ] Hover states work

**Dependencies:** Task 1
**Estimated scope:** S (1 file: button.tsx)

---

#### Task 4: Card component → DESIGN.md spec (Slice 4)

**Description:** Update card.tsx to match DESIGN.md — 36px padding, border-only separation, no shadow, 0px radius.

**Acceptance criteria:**

- [ ] Default card: bg #FAFAF9, 1px solid #E7E5E4 border, 0px radius, 36px padding
- [ ] Hover: border #D6D3D1 (not shadow)
- [ ] Elevated variant: bg #F5F5F4, 1px solid #D6D3D1
- [ ] No shadow utilities anywhere
- [ ] No rounded corners

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Cards render flat with borders, no shadows

**Dependencies:** Task 1
**Estimated scope:** S (1 file: card.tsx)

---

#### Task 5: Input/Form components → DESIGN.md spec (Slice 5)

**Description:** Update input.tsx, textarea.tsx, checkbox.tsx, radio-group.tsx, select.tsx to match DESIGN.md form specs.

**Acceptance criteria:**

- [ ] Text input: 48px height, #FAFAF9 bg, 1px solid #D6D3D1 border, 0px radius, 12px 16px padding
- [ ] Focus: border #78716C, ring 0 0 0 2px #FAFAF9, 0 0 0 4px #78716C
- [ ] Error: border #DC2626
- [ ] Disabled: bg #F5F5F4, opacity 0.5
- [ ] Checkbox: 18px, 1.5px solid #D6D3D1, 0px radius, checked bg #78716C
- [ ] Radio: 18px, 9999px radius (only round element besides avatars), selected border #78716C
- [ ] Labels: 13px, weight 600, color #57534E

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Form inputs render with correct height, borders, focus states

**Dependencies:** Task 1
**Estimated scope:** M (5 files: input.tsx, textarea.tsx, checkbox.tsx, radio-group.tsx, select.tsx)

---

### Checkpoint: Core Components

- [ ] All core components match DESIGN.md
- [ ] No shadcn default styling remains
- [ ] App is fully usable with new design system
- [ ] Review with human before proceeding

---

### Phase 2.5: Shared Composite Components

These components are what make the UI consistent. Instead of each page hand-rolling its own layout, every page adopts these shared patterns. They are built on top of the DESIGN.md-compliant core components from Phase 2 and the shadcn primitives.

---

#### Task 6: Install missing shadcn primitives

**Description:** Install the shadcn components that are missing but needed by the composite components below.

**Acceptance criteria:**

- [ ] Sheet installed (slide-over panel for mobile filters/nav)
- [ ] Breadcrumb installed (page hierarchy on detail pages)
- [ ] AspectRatio installed (consistent image containers)
- [ ] All installed components match DESIGN.md (0px radius, no shadow, stone colors)
- [ ] `npx tsc --noEmit` passes

**Verification:**

- [ ] Components import without errors
- [ ] No console errors

**Dependencies:** Tasks 1-5
**Estimated scope:** S (3 new files in components/ui/)

---

#### Task 7: PageContainer + PageHeader + PageToolbar

**Description:** Create the three foundational layout components that every page will use.

**PageContainer:**

- Responsive max-width: full-width mobile, max-w-7xl desktop
- Responsive padding: 16px mobile, 24px tablet, 48px desktop
- Consistent vertical spacing between sections

**PageHeader:**

- Title in Libre Baskerville (serif)
- Optional description in Inter (muted-foreground)
- Optional action slot (buttons on the right)
- Responsive: stacked on mobile, row on desktop

**PageToolbar:**

- Horizontal bar below header for filters, sort, view toggles
- Responsive: wraps on mobile, single row on desktop
- Used by library pages, admin pages, marketplace

**Acceptance criteria:**

- [ ] All three components created, typed, documented
- [ ] Dashboard migrated to PageContainer + PageHeader as proof of concept
- [ ] Responsive at 375px, 768px, 1024px, 1440px

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Dashboard renders correctly with new layout components

**Dependencies:** Tasks 1-2, 6
**Estimated scope:** M (4 files: PageContainer.tsx, PageHeader.tsx, PageToolbar.tsx, Dashboard.tsx)

---

#### Task 8: StatCard

**Description:** Reusable stat card for the dashboard — icon + label + value, consistent every time.

**Acceptance criteria:**

- [ ] Props: icon, label, value, isLoading, optional trend indicator
- [ ] Loading state shows Skeleton
- [ ] Uses DESIGN.md colors (icon in primary, label in text-secondary, value in text-primary)
- [ ] Responsive: min-width on mobile, fixed grid on desktop
- [ ] Replaces the hand-rolled stat cards in Dashboard

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Dashboard admin stats use StatCard

**Dependencies:** Tasks 1-5, 7
**Estimated scope:** S (1 file: StatCard.tsx + Dashboard.tsx update)

---

#### Task 9: AssetCardV2

**Description:** Replace the current minimal AssetCard with a richer card that has consistent metadata.

**Acceptance criteria:**

- [ ] Uses AspectRatio for image (no more broken aspect ratios)
- [ ] Shows: image, name, type badge, creator name, created date, optional status badge
- [ ] Hover: border color change (not shadow) per DESIGN.md
- [ ] Clickable: navigates to detail page
- [ ] Responsive: 1 col mobile, 2-4 col desktop (controlled by parent grid)
- [ ] Optional menu (DropdownMenu) for actions: duplicate, delete, share
- [ ] Loading skeleton variant (AssetCardSkeleton already exists — integrate)

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] ActorLibrary uses AssetCardV2
- [ ] Images are consistent sizes (no stretching)

**Dependencies:** Tasks 1-5, 6, 7
**Estimated scope:** M (2 files: AssetCardV2.tsx, ActorLibrary.tsx update)

---

#### Task 10: LibraryLayout

**Description:** Composite layout component for all library pages (Actors, Looks, Fashion Items). Eliminates the per-page layout duplication.

**Acceptance criteria:**

- [ ] Props: title, description, filterGroups, data, cardRenderer, pagination, onReset
- [ ] Desktop: filter sidebar (left) + grid (right) with sort dropdown and view toggle
- [ ] Mobile: filter button opens Sheet (slide-over) with FilterPanel inside
- [ ] View toggle: grid/list (ToggleGroup) — grid uses AssetCardV2, list uses compact rows
- [ ] Sort dropdown: by date (default), name, status
- [ ] Pagination: compact on mobile, full on desktop
- [ ] Empty state uses EmptyStateV2 (Task 14)
- [ ] All three library pages migrate to use this

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] All three library pages use LibraryLayout
- [ ] Mobile: filter Sheet opens/closes
- [ ] Grid/list toggle works
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 6, 7, 9, 14
**Estimated scope:** L (2 files: LibraryLayout.tsx + update 3 library pages. Break into sub-increments: layout shell → filter integration → grid/list toggle → migrate each page)

---

#### Task 11: AssetDetailLayout

**Description:** Composite layout for detail pages (Actor, Look, FashionItem). Uses Tabs to separate sections instead of flat scroll.

**Acceptance criteria:**

- [ ] Breadcrumb at top (Library > Item Name)
- [ ] Header: name, type badge, status badge, action toolbar (edit, generate, etc.)
- [ ] Tabs: Overview (image + metadata), Outputs (image grid), Properties (taxonomy fields)
- [ ] Desktop: image sidebar (left, sticky) + tabs (right)
- [ ] Mobile: stacked — image, then tabs
- [ ] Output grid inside Outputs tab: 1 col mobile, 2 col tablet, 3 col desktop
- [ ] Action buttons: full-width on mobile, auto on desktop
- [ ] All three detail pages migrate to use this

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] All three detail pages use AssetDetailLayout
- [ ] Tabs work, breadcrumb navigates back
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 6, 7
**Estimated scope:** L (2 files: AssetDetailLayout.tsx + update 3 detail pages. Break into sub-increments: layout shell → tabs → migrate each page)

---

#### Task 12: SettingsLayout

**Description:** Composite layout for the settings section. Sidebar nav on desktop, horizontal tabs on mobile.

**Acceptance criteria:**

- [ ] Desktop: sidebar nav (left) + content (right)
- [ ] Mobile: horizontal scrollable tabs or Select for section switching
- [ ] Nav items: Users & Roles, Models, System Prompts, Taxonomy, Commission Forms, API Keys, Wallet
- [ ] Active section highlighted
- [ ] Content area uses PageContainer
- [ ] SettingsPage migrates to use this

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Settings section uses SettingsLayout
- [ ] Mobile: tab switching works
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 6, 7
**Estimated scope:** M (2 files: SettingsLayout.tsx, SettingsPage.tsx)

---

#### Task 13: DataTable

**Description:** Reusable sortable, paginated table for admin and settings pages. Replaces the raw Table usage.

**Acceptance criteria:**

- [ ] Props: columns (key, header, render, sortable), data, pagination, onSort, isLoading
- [ ] Sortable columns: click header to sort asc/desc
- [ ] Pagination: compact on mobile, full on desktop
- [ ] Loading: skeleton rows
- [ ] Empty: EmptyStateV2
- [ ] Mobile: transforms to card list (each row becomes a card with label: value pairs)
- [ ] Row actions via DropdownMenu (edit, delete, etc.)
- [ ] Used by: UsersPage, ModelsPage, TaxonomyPage, WalletPage, MarketplaceManage, AdminSubmissions

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] At least 2 pages migrated to DataTable
- [ ] Mobile: card list renders correctly
- [ ] Sorting works

**Dependencies:** Tasks 6, 7, 14
**Estimated scope:** L (2 files: DataTable.tsx + migrate pages. Break into sub-increments: table component → mobile card mode → migrate pages one by one)

---

#### Task 14: EmptyStateV2 + ErrorState + LoadingState

**Description:** Three state components that every page uses for consistent empty/error/loading UX.

**Acceptance criteria:**

- [ ] EmptyStateV2: icon, title, description, optional action button. Replaces existing EmptyState.
- [ ] ErrorState: icon, message, retry button. Uses Alert component.
- [ ] LoadingState: configurable skeleton layout (grid, list, detail, table)
- [ ] All three use DESIGN.md colors and typography
- [ ] All three are responsive
- [ ] At least 3 pages updated to use them

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Pages show proper states when data is empty/erroring/loading

**Dependencies:** Tasks 1-5, 7
**Estimated scope:** M (3 files: EmptyStateV2.tsx, ErrorState.tsx, LoadingState.tsx)

---

#### Task 15: ProductCard

**Description:** Reusable card for marketplace listings. Consistent product presentation.

**Acceptance criteria:**

- [ ] Uses AspectRatio for product image
- [ ] Shows: image, name, seller name, price (in credits), type badge
- [ ] Buy button (disabled if insufficient balance, with Tooltip explaining why)
- [ ] Hover: border color change per DESIGN.md
- [ ] Clickable: navigates to listing detail
- [ ] Responsive: 1 col mobile, 2-4 col desktop
- [ ] Used by MarketplacePage

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] MarketplacePage uses ProductCard
- [ ] Buy button disabled state works

**Dependencies:** Tasks 1-5, 6, 7
**Estimated scope:** M (2 files: ProductCard.tsx, MarketplacePage.tsx update)

---

### Checkpoint: Shared Composite Components

- [ ] All composite components created and tested
- [ ] At least one page per component type migrated as proof of concept
- [ ] Components are responsive at 375px, 768px, 1024px, 1440px
- [ ] DESIGN.md compliance verified (colors, fonts, radius, no shadows)
- [ ] Review with human before proceeding

---

### Phase 3: Responsive App Shell

#### Task 16: AppShell + Sidebar + TopBar → responsive + DESIGN.md

**Description:** Make the app shell responsive. Sidebar becomes a slide-in drawer on mobile. TopBar adapts to show hamburger on mobile.

**Acceptance criteria:**

- [ ] Desktop (≥1024px): Sidebar visible by default, TopBar full
- [ ] Tablet (768-1023px): Sidebar collapsible, overlay when open
- [ ] Mobile (<768px): Sidebar hidden, hamburger menu opens drawer, TopBar compact
- [ ] Sidebar uses stone palette per DESIGN.md
- [ ] TopBar shows workspace name (not UUID)
- [ ] No layout shift on breakpoint transitions

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px width: sidebar is drawer, hamburger works
- [ ] Test at 1024px: sidebar visible, no hamburger
- [ ] No console errors

**Dependencies:** Tasks 1-2, 5b, 7
**Estimated scope:** M (4 files: AppShell.tsx, Sidebar.tsx, TopBar.tsx, ui-store.ts)

---

### Checkpoint: Responsive App Shell

- [ ] App shell is responsive
- [ ] Mobile navigation works (Sheet drawer)
- [ ] Theme toggle works
- [ ] Review with human before proceeding

---

### Phase 4: Page Migration

Pages adopt the shared composite components from Phase 2.5. Each task migrates a group of pages to use the new components, making them responsive and consistent simultaneously.

---

#### Task 17: Dashboard → StatCard + PageContainer

**Description:** Migrate Dashboard to use PageContainer/PageHeader. Make all grids responsive.

**Acceptance criteria:**

- [ ] Quick actions: 1 col mobile, 2 col tablet, 4 col desktop
- [ ] Admin stats: 2 col mobile, 3 col tablet, 5 col desktop
- [ ] Wallet card: full-width mobile, 320px desktop
- [ ] Recent activity: full-width, responsive
- [ ] Uses PageContainer + PageHeader
- [ ] Headings in Libre Baskerville

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px, 1440px

**Dependencies:** Tasks 1-2, 7-8
**Estimated scope:** S (1 file: Dashboard.tsx)

---

#### Task 18: Library pages → LibraryLayout + AssetCardV2

**Description:** Make ActorLibrary, LookLibrary, FashionItemLibrary responsive. Filter panel becomes a drawer on mobile.

**Acceptance criteria:**

- [ ] Grid: 1 col mobile, 2 col tablet, 3 col desktop, 4 col large desktop
- [ ] Filter panel: sidebar on desktop, slide-in drawer on mobile with toggle button
- [ ] Pagination: compact on mobile, full on desktop
- [ ] Uses PageContainer + PageHeader
- [ ] All three library pages follow the same responsive pattern

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test each library page at 375px, 768px, 1024px, 1440px
- [ ] Filter drawer opens/closes on mobile

**Dependencies:** Tasks 9, 10, 16
**Estimated scope:** M (3 files: ActorLibrary.tsx, LookLibrary.tsx, FashionItemLibrary.tsx)

---

#### Task 19: Detail pages → AssetDetailLayout

**Description:** Make ActorPage, LookDetail, FashionItemDetail responsive. Image + content stacks on mobile, side-by-side on desktop.

**Acceptance criteria:**

- [ ] Mobile: single column — image first, then metadata, then outputs
- [ ] Desktop: 2-column layout — image sidebar + content main
- [ ] Output grids: 1 col mobile, 2 col tablet, 3 col desktop
- [ ] Action buttons: full-width on mobile, auto on desktop
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test each detail page at 375px, 768px, 1024px

**Dependencies:** Tasks 11, 16
**Estimated scope:** M (3 files: ActorPage.tsx, LookDetail.tsx, FashionItemDetail.tsx)

---

#### Task 20: Marketplace pages → ProductCard + PageContainer

**Description:** Make MarketplacePage, MarketplaceDetail, MarketplaceManage, NewListing responsive.

**Acceptance criteria:**

- [ ] Listing grid: 1 col mobile, 2 col tablet, 3 col desktop, 4 col large
- [ ] Detail page: stacked on mobile, side-by-side on desktop
- [ ] Manage page: table becomes card list on mobile
- [ ] New listing form: single column on mobile, 2-column on desktop
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 13, 15, 16
**Estimated scope:** M (4 files)

---

#### Task 21: Commission pages → PageContainer + responsive

**Description:** Make CommissionsList, CommissionDetail, NewCommission, PremiumUnlockDialog responsive.

**Acceptance criteria:**

- [ ] List: 1 col mobile, 2 col tablet, 3 col desktop
- [ ] Detail: stacked on mobile, 2-column on desktop
- [ ] New commission form: single column mobile, 2-column desktop
- [ ] Dialog: full-screen on mobile, centered modal on desktop
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 7, 16
**Estimated scope:** M (4 files)

---

#### Task 22: Settings pages → SettingsLayout + DataTable

**Description:** Make all settings pages responsive. SettingsPage becomes a tabbed interface on mobile, sidebar on desktop.

**Acceptance criteria:**

- [ ] SettingsPage: sidebar nav on desktop, horizontal tabs or select on mobile
- [ ] All sub-pages: single column mobile, 2-column desktop where applicable
- [ ] Tables (UsersPage, ModelsPage, TaxonomyPage): card list on mobile, table on desktop
- [ ] WalletPage: stacked on mobile
- [ ] ApiKeysPage: implement (currently 9-line stub)
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 12, 13, 16
**Estimated scope:** L (8 files — break into sub-increments: SettingsLayout → migrate each settings page → ApiKeysPage implementation → DataTable migration)

---

#### Task 23: Admin pages → DataTable + PageContainer

**Description:** Make AdminSubmissions, AdminListingsSettings responsive.

**Acceptance criteria:**

- [ ] Submissions grid: 1 col mobile, 2 col desktop
- [ ] Settings: stacked on mobile, 2-column on desktop
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 13, 16
**Estimated scope:** S (2 files)

---

#### Task 24: Designer/Creator pages → responsive wizard

**Description:** Make ActorDesigner, LookDesigner, FashionItemCreator responsive. These are the most complex — multi-step wizards with image grids.

**Acceptance criteria:**

- [ ] Wizard steps: full-width on mobile, constrained on desktop
- [ ] Image option grid: 2 col mobile, 4 col desktop
- [ ] Forms: single column mobile, 2-column desktop
- [ ] Stepper: horizontal scroll on mobile if needed
- [ ] Uses PageContainer + PageHeader

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test at 375px, 768px, 1024px

**Dependencies:** Tasks 7, 16
**Estimated scope:** L (3 files — large files, may need sub-increments: layout → image grid → forms)

---

### Checkpoint: All Pages Responsive

- [ ] Every page works at 375px, 768px, 1024px, 1440px
- [ ] No horizontal scroll on mobile
- [ ] No overlapping elements
- [ ] Navigation works on all breakpoints
- [ ] Review with human before proceeding

---

### Phase 5: Polish

#### Task 25: Remove all remaining shadcn defaults

**Description:** Audit all components for any remaining shadcn default styling that contradicts DESIGN.md.

**Acceptance criteria:**

- [ ] No rounded corners except avatars and radio buttons
- [ ] No shadows anywhere
- [ ] No default blue/purple colors
- [ ] All hover states use DESIGN.md colors
- [ ] All borders use DESIGN.md border colors

**Verification:**

- [ ] grep for `rounded`, `shadow`, `ring-` in source — verify each is spec-compliant
- [ ] Visual audit at all breakpoints

**Dependencies:** All previous tasks
**Estimated scope:** M (audit + fixes across multiple files)

---

#### Task 26: Responsive error + loading states

**Description:** Add error and loading states to the 15 pages that lack them.

**Acceptance criteria:**

- [ ] Every page with data fetching has a loading skeleton
- [ ] Every page with data fetching has an error state
- [ ] Error states are responsive
- [ ] Loading states are responsive

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Test with network throttled / API down

**Dependencies:** All previous tasks
**Estimated scope:** M (15 files, mostly small additions)

---

## Risks and Mitigations

| Risk                                                            | Impact | Mitigation                                                                         |
| --------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------- |
| DESIGN.md colors look wrong in dark mode (only light specified) | Medium | Derive warm dark palette from light palette — keep chroma, invert lightness        |
| Libre Baskerville not available as npm package                  | Low    | Use @fontsource package or Google Fonts CDN                                        |
| Removing shadows breaks visual hierarchy                        | Medium | Replace with borders per DESIGN.md — test each component                           |
| Responsive sidebar drawer adds complexity                       | Medium | Use existing Zustand store for open/close state, CSS transform for drawer          |
| Large files (ActorDesigner 612 lines) hard to make responsive   | Medium | Sub-increment: layout first, then grid, then forms                                 |
| 0px radius looks harsh on some components                       | Low    | Trust the DESIGN.md — it's intentional. Test and adjust only if usability suffers. |

## Resolved Questions

1. **Dark mode**: Yes — derive a warm dark palette (stone-900 background, stone-100 text). Add a theme toggle button in TopBar. Task added below.
2. **ApiKeysPage**: Implement fully — API key generation, list, revoke. Task added below.
3. **Font loading**: @fontsource packages (already used for Geist, works offline, consistent setup).

## Additional Tasks (added from Q&A)

#### Task 5b: Theme toggle + dark mode palette

**Description:** Derive warm dark palette from DESIGN.md light palette. Add theme toggle button to TopBar. Persist preference in localStorage.

**Acceptance criteria:**

- [ ] Dark mode CSS variables: warm dark equivalents (stone-900 #1C1917 bg, stone-100 #F5F5F4 text, #44403C primary)
- [ ] Theme toggle button in TopBar (sun/moon icon)
- [ ] Preference persisted in localStorage
- [ ] Respects system preference on first visit (prefers-color-scheme)
- [ ] No flash of wrong theme on page load (set class on <html> before React renders)
- [ ] All components render correctly in dark mode

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Toggle works, persists across refresh
- [ ] All pages look correct in both themes

**Dependencies:** Task 1
**Estimated scope:** M (3 files: index.css, TopBar.tsx, new theme.ts hook)

---

#### Task 13b: Implement ApiKeysPage

**Description:** Replace the 9-line stub with a full API key management page — generate, list, revoke.

**Acceptance criteria:**

- [ ] List existing API keys (name, created date, status, last used)
- [ ] Generate new key — name input, create button, show key once with copy button
- [ ] Revoke key — confirmation dialog, soft-delete
- [ ] Responsive: card list on mobile, table on desktop
- [ ] Uses PageContainer + PageHeader
- [ ] Loading and error states

**Verification:**

- [ ] `npx tsc --noEmit` passes
- [ ] Can create, view, and revoke keys
- [ ] Key is shown only once on creation
- [ ] Works at 375px and 1024px

**Dependencies:** Tasks 6-7
**Estimated scope:** M (1 file: ApiKeysPage.tsx, possibly a hook)
