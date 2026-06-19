# ADR-042: Dialog Consistency — Remove Full-Screen-Mobile Pattern

## Status

Accepted

## Date

2026-06-19

## Context

The design system (DESIGN.md) specifies sharp-edge, flat design with 0px radius, borders-only separation, and no shadows. Some dialogs were using a `border-0 p-0` + `sm:border sm:p-6` pattern for full-screen-mobile behavior that conflicted with this system. Additionally, dialog widths were inconsistent (`sm:max-w-md` in some, bare `DialogContent` in others, `max-w-lg` in the premium unlock dialog).

## Decision

Standardize all dialogs to use consistent styling:

- All `DialogContent` components use `className="max-w-lg"` for consistent width
- All dialogs have `border` and `p-6` on all screen sizes (no full-screen-mobile pattern)
- All `DialogFooter` components use the default `flex-col-reverse gap-2 sm:flex-row sm:justify-end` pattern for mobile stacking
- Cost breakdown typography in PremiumUnlockDialog uses `text-base font-semibold` (not `text-lg`) to match the app's typography scale

## Alternatives Considered

### Keep full-screen-mobile pattern

- Pros: Better mobile UX for complex dialogs
- Cons: Conflicts with DESIGN.md sharp-edge system; inconsistent with rest of app
- Rejected: Design system consistency takes priority; the shadcn DialogContent already handles mobile well with `max-w-[calc(100%-2rem)]`

### Use sm:max-w-md for all dialogs

- Pros: Narrower dialogs feel less overwhelming
- Cons: Too narrow for some content; inconsistent with PremiumUnlockDialog
- Rejected: max-w-lg provides better content space while still being constrained

## Consequences

- All 5 targeted dialogs (PremiumUnlock, Request Changes, Assign, Delete Model, Edit User) now have identical width and border behavior
- No visual inconsistency between dialogs at any viewport size
- Future dialogs should follow the same pattern: `DialogContent className="max-w-lg"` with bare `DialogFooter`

## Files Changed

- `client/src/pages/commissions/PremiumUnlockDialog.tsx`
- `client/src/pages/commissions/CommissionDetail.tsx`
- `client/src/pages/settings/ModelsPage.tsx`
- `client/src/pages/settings/UsersPage.tsx`
