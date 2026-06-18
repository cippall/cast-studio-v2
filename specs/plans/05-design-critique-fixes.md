# Implementation Plan: Design Critique Fixes

## Overview

Fix the 7 priority issues identified in the full-project design critique. The fixes are ordered by impact: settings page redesign (biggest visual improvement), commission detail hierarchy, dialog polish, notification color, admin power-user features, form guards, and taxonomy label formatting.

All work must follow the project's DESIGN.md tokens (stone palette, Libre Baskerville headings, Inter body, 0px radius, no shadows, borders-only separation). No new colors, fonts, or visual patterns outside the existing system.

**Design system source of truth:** `/home/ciprian/projects/cast-studio-v2/DESIGN.md`
**Product context:** `/home/ciprian/projects/cast-studio-v2/PRODUCT.md`

## Architecture Decisions

- **Settings page**: Replace the card-grid-of-placeholders with a dense list layout showing inline data previews. This matches the "density matches purpose" principle from PRODUCT.md — admin pages need information density, not whitespace.
- **Commission detail**: Keep the unified layout but add visual weight differentiation. Primary actions use `variant="default"`, secondary use `variant="outline"`, destructive use `variant="destructive"`. Remove Card wrappers from sidebar actions — use direct button groups.
- **Dialogs**: Remove the full-screen-mobile pattern. Use consistent centered modal at `max-w-lg`. All dialogs use the same border/shadow tokens as cards.
- **Notifications**: Add a dedicated `--accent` token (warm amber `#CA8A0A` already exists as `--warning`) for attention elements like unread badges.
- **No new dependencies** — all fixes use existing shadcn/ui components and Tailwind utilities.

## Task List

### Phase 1: High-Impact Layout Fixes

- [ ] **Task 1**: Replace settings page card-grid with list layout
- [ ] **Task 2**: Fix commission detail visual hierarchy
- [ ] **Task 3**: Fix dialog/popup design consistency

### Checkpoint: Phase 1

- [ ] Settings page shows data previews, not placeholder cards
- [ ] Commission detail has clear primary/secondary action hierarchy
- [ ] All dialogs use consistent border/radius/padding
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 2: Visual Polish

- [ ] **Task 4**: Fix notification unread indicator color
- [ ] **Task 5**: Add taxonomy key display formatting

### Checkpoint: Phase 2

- [ ] Notification badge uses attention-grabbing color
- [ ] Taxonomy properties show formatted labels (e.g., "Vibe" not "vibe")
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds

### Phase 3: Interaction Hardening

- [ ] **Task 6**: Add unsaved-changes guard to forms
- [ ] **Task 7**: Add keyboard dismiss (Esc) to all dialogs

### Checkpoint: Phase 3

- [ ] Forms warn on navigation with unsaved changes
- [ ] All dialogs close on Esc key
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: key pages load without console errors

---

## Task Details

### Task 1: Replace settings page card-grid with list layout

**Description:** Replace the current SettingsPage implementation where every section is a Card with a "Manage X" button that navigates to a sub-page. Instead, show a list of settings sections with inline data previews (counts, last-modified dates) directly visible. Keep the sub-page navigation for detail views, but the main settings page should feel like a real dashboard, not a directory.

**Acceptance criteria:**

- [ ] Settings page shows a list (not grid) of settings sections
- [ ] Each list item shows: section name, icon, brief description, and a data preview (e.g., "3 active models" for Models, "12 entries" for Actor Properties)
- [ ] List items are clickable and navigate to the sub-page (preserving existing routing)
- [ ] Layout uses the same 12px grid spacing and border tokens as the rest of the app
- [ ] Mobile: single column; Desktop: max-width constrained to 680px (reading measure per DESIGN.md)

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: Settings page at `/settings` shows list with previews instead of cards

**Dependencies:** None

**Files likely touched:**

- `client/src/pages/settings/SettingsPage.tsx` — main settings page
- `client/src/components/layout/SettingsLayout.tsx` — may need minor spacing adjustments

**Estimated scope:** Small (2 files)

**Impeccable skill reference:** `$impeccable shape settings` — use the `shape` command to plan UX before writing code. The settings page needs a clear information architecture: what data is most important to show per section?

---

### Task 2: Fix commission detail visual hierarchy

**Description:** The CommissionDetail page serves 3 roles (Client, Artist, Admin) with different action sets. Currently all actions are wrapped in identical Card components with no visual priority. Redesign the sidebar actions so the primary action per role is visually dominant (filled button), secondary actions are outline buttons, and destructive actions are clearly marked. Remove Card wrappers — use a simple button group with proper spacing.

**Acceptance criteria:**

- [ ] Primary action per role uses `variant="default"` (filled)
- [ ] Secondary actions use `variant="outline"`
- [ ] Destructive actions (Delete) use red text styling
- [ ] Actions are NOT wrapped in Card components — use a `div` with `flex flex-col gap-3` directly
- [ ] Commission detail page still shows: title, status badge, timestamps, brief, submitted work, and role-specific actions
- [ ] Layout: stacked on mobile, 2-column (main + sidebar) on desktop per existing pattern

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: `/commissions/:id` shows clear action hierarchy for each role

**Dependencies:** None

**Files likely touched:**

- `client/src/pages/commissions/CommissionDetail.tsx` — main page layout
- `client/src/pages/commissions/AdminActions.tsx` — admin action buttons
- `client/src/pages/commissions/ClientActions.tsx` — client action buttons
- `client/src/pages/commissions/ArtistActions.tsx` — artist action buttons

**Estimated scope:** Small (4 files)

**Impeccable skill reference:** `$impeccable layout commission-detail` — use the `layout` command to fix spacing, rhythm, and visual hierarchy on this page.

---

### Task 3: Fix dialog/popup design consistency

**Description:** PremiumUnlockDialog and other dialogs use a `border-0 p-0` + `sm:border sm:p-6` pattern for full-screen mobile that conflicts with the sharp-edge design system. Fix all dialogs to use consistent styling: always bordered, always with padding, centered at `max-w-lg` on both mobile and desktop. Remove the full-screen-mobile pattern.

**Acceptance criteria:**

- [ ] All DialogContent components use consistent className: `max-w-lg` (no border-0/p-0 conditional)
- [ ] Dialogs have `border` and `p-6` on all screen sizes
- [ ] Cost breakdown in PremiumUnlockDialog uses the same typography scale as the rest of the app
- [ ] DialogFooter uses `flex-col sm:flex-row` for mobile stacking (keep this — it's correct)
- [ ] No full-screen-mobile pattern anywhere

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: all dialogs (PremiumUnlock, Request Changes, Assign, Delete confirmation) show consistent styling

**Dependencies:** None

**Files likely touched:**

- `client/src/pages/commissions/PremiumUnlockDialog.tsx` — primary target
- `client/src/pages/commissions/CommissionDetail.tsx` — contains inline dialogs (Request Changes, Assign)
- `client/src/pages/settings/ModelsPage.tsx` — contains delete confirmation dialog
- `client/src/pages/settings/UsersPage.tsx` — contains edit dialog

**Estimated scope:** Medium (4 files)

**Impeccable skill reference:** `$impeccable polish dialogs` — use the `polish` command for final quality pass on modal/dialog elements.

---

### Task 4: Fix notification unread indicator color

**Description:** The notification unread badge currently uses `bg-primary` (#78716C, muted stone) which doesn't draw attention. Change it to use the warning/attention color (`#CA8A0A` amber) or add a dedicated `--notification-accent` CSS variable. The unread dot in the notification list should also use this color.

**Acceptance criteria:**

- [ ] Unread count badge uses amber/attention color instead of muted stone
- [ ] Unread dot indicator in notification dropdown uses the same attention color
- [ ] Badge text is readable against the new background (use `--primary-foreground` or `--background` for contrast)
- [ ] No other elements change color (only notification indicators)

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: notification bell shows amber badge when unread > 0

**Dependencies:** None

**Files likely touched:**

- `client/src/components/NotificationDropdown.tsx` — unread badge and dot
- `client/src/index.css` — possibly add `--notification-accent` token

**Estimated scope:** XS (1-2 files)

**Impeccable skill reference:** `$impeccable colorize notifications` — use the `colorize` command to add strategic color to the notification system.

---

### Task 5: Add taxonomy key display formatting

**Description:** In ActorPage, LookDetail, and FashionItemDetail, taxonomy property keys are displayed as raw database strings (e.g., "vibe", "gender"). These should be formatted for display: capitalize first letter, replace underscores with spaces. Ideally, the admin taxonomy configuration should include a `display_name` field, but as a minimum, format the keys in the UI.

**Acceptance criteria:**

- [ ] Taxonomy keys in ActorPage properties section show formatted labels (e.g., "Vibe" not "vibe", "Gender" not "gender")
- [ ] Taxonomy keys in LookDetail and FashionItemDetail also show formatted labels
- [ ] Empty taxonomy values still show "No taxonomy properties set" message
- [ ] Layout unchanged — only the key label text changes

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: `/actors/:id` shows formatted taxonomy labels

**Dependencies:** None

**Files likely touched:**

- `client/src/pages/actors/ActorPage.tsx` — properties grid
- `client/src/pages/looks/LookDetail.tsx` — properties grid
- `client/src/pages/fashion-items/FashionItemDetail.tsx` — properties grid
- Possibly a new utility: `client/src/lib/utils.ts` — add `formatLabel()` helper

**Estimated scope:** Small (3-4 files)

**Impeccable skill reference:** `$impeccable clarify taxonomy` — use the `clarify` command to improve labels and terminology.

---

### Task 6: Add unsaved-changes guard to forms

**Description:** ActorDesigner Stage 3 (Name & Properties) and FashionItemCreator Step 2 (Name & Save) have no protection against navigating away with unsaved changes. Add a `useUnsavedChanges` hook that shows a browser confirmation dialog when the user tries to navigate away with dirty form state.

**Acceptance criteria:**

- [ ] Hook `useUnsavedChanges(dirty: boolean)` exists and intercepts navigation when form is dirty
- [ ] Browser shows "You have unsaved changes. Leave anyway?" confirmation when navigating away with dirty state
- [ ] Guard is active on ActorDesigner (Stage 3) and FashionItemCreator (Step 2)
- [ ] Guard is NOT active on settings pages (they auto-save or are standalone)
- [ ] Guard cleans up on successful save/submit

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: fill in Actor Designer name field → click Back → browser warns about unsaved changes

**Dependencies:** None

**Files likely touched:**

- `client/src/hooks/useUnsavedChanges.ts` — new hook
- `client/src/pages/actors/ActorDesigner.tsx` — use hook in Stage 3
- `client/src/pages/fashion-items/FashionItemCreator.tsx` — use hook in Step 2

**Estimated scope:** Small (3 files)

**Impeccable skill reference:** `$impeccable harden forms` — use the `harden` command for production-ready error handling and edge cases.

---

### Task 7: Add keyboard dismiss (Esc) to all dialogs

**Description:** Some dialogs (especially the inline ones in CommissionDetail) may not properly close on Esc. Verify all dialogs use the Radix Dialog component correctly with `onOpenChange` handler, which supports Esc by default. If any dialog uses a custom implementation, fix it to use the standard Dialog primitive.

**Acceptance criteria:**

- [ ] All dialogs close when pressing Esc key
- [ ] All dialogs close when clicking the overlay backdrop
- [ ] No custom dialog implementations that bypass Radix behavior

**Verification:**

- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Manual check: open each dialog → press Esc → dialog closes

**Dependencies:** None

**Files likely touched:**

- `client/src/pages/commissions/CommissionDetail.tsx` — inline dialogs
- `client/src/pages/settings/ModelsPage.tsx` — delete dialog
- `client/src/pages/settings/UsersPage.tsx` — edit dialog

**Estimated scope:** Small (3 files)

**Impeccable skill reference:** `$impeccable harden dialogs` — use the `harden` command for production-ready dialog behavior.

---

## Risks and Mitigations

| Risk                                                           | Impact | Mitigation                                                                  |
| -------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- |
| Settings page redesign changes navigation patterns             | Medium | Keep the same routes — only change the visual presentation, not the routing |
| Commission detail hierarchy changes may confuse existing users | Low    | Keep the same actions, only change visual weight — no functionality removed |
| Unsaved-changes hook may trigger false positives               | Medium | Only set `dirty=true` when form fields actually change from initial state   |
| Dialog styling changes may look worse on mobile                | Low    | Test at 375px viewport; the consistent border/padding should work fine      |

## Open Questions

1. **Settings data previews**: Should the settings page fetch actual counts (e.g., "3 active models") or just show static descriptions? Fetching counts requires API calls; static descriptions are simpler but less useful. Recommendation: start with static descriptions, add counts in a follow-up.

2. **Commission action layout**: Should the sidebar actions be sticky on desktop when scrolling? Recommendation: yes, add `lg:sticky lg:top-6` to the sidebar for better visibility during scroll.

3. **Taxonomy display names**: Should we add a `display_name` field to the admin taxonomy configuration, or just format keys in the UI? Recommendation: UI-only formatting for now. Adding display_name is a separate product decision.

---

## Skill References

All tasks should reference the impeccable skill for design guidance:

| Task   | Impeccable Command                     | Purpose                                        |
| ------ | -------------------------------------- | ---------------------------------------------- |
| Task 1 | `$impeccable shape settings`           | Plan settings page UX before implementation    |
| Task 2 | `$impeccable layout commission-detail` | Fix visual hierarchy on commission detail      |
| Task 3 | `$impeccable polish dialogs`           | Final quality pass on all dialogs              |
| Task 4 | `$impeccable colorize notifications`   | Add strategic color to notification indicators |
| Task 5 | `$impeccable clarify taxonomy`         | Improve taxonomy property labels               |
| Task 6 | `$impeccable harden forms`             | Production-ready form handling                 |
| Task 7 | `$impeccable harden dialogs`           | Production-ready dialog behavior               |

**Before starting each task**, load the impeccable skill and run the referenced command to get design-specific guidance. The skill will provide concrete CSS/layout recommendations that respect DESIGN.md tokens.
