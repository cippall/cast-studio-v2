# ADR-041: Commission Detail Visual Hierarchy

## Status: Accepted

## Context

The CommissionDetail page serves 3 roles (Client, Artist, Admin) with different action sets. All action components (`ClientActions`, `ArtistActions`, `AdminActions`) were wrapped in identical `Card` components with `CardHeader`/`CardTitle`/`CardDescription` and `CardContent`, giving every action equal visual weight. This made it hard for users to identify the primary action for their role.

Additionally, the sidebar actions scrolled away on desktop, reducing visibility during review.

## Decision

Removed all Card wrappers from action components. Replaced with `div.flex.flex-col.gap-3` button groups using `h3` headings for section labels. Applied shadcn Button variants for visual hierarchy:

- **Primary action per role** → `variant="default"` (filled)
  - Client: "Approve & Unlock"
  - Artist: "Submit Work"
  - Admin: "Assign to Artist/Agent"
- **Secondary actions** → `variant="outline"`
  - Client: "Request Changes"
  - Artist: "Start Working"
- Added `lg:sticky lg:top-6 lg:self-start` to sidebar for desktop scroll visibility

Card wrappers are retained for content sections (error banner, premium cost banner) where Card semantics are appropriate.

## Alternatives Considered

1. **Keep Cards with variant styling** — Would reduce visual noise less effectively; Card containers add unnecessary nesting for simple button groups.
2. **Use `variant="destructive"` for destructive actions** — No destructive actions exist in the current action sets (Delete is handled elsewhere). Not needed.

## Consequences

- Reduced DOM nesting in sidebar (Card → CardHeader → CardTitle/CardDescription → CardContent → Button becomes div → h3 + Button)
- Primary actions now visually dominant via filled variant
- Sidebar stays visible during scroll on desktop
- 4 files changed: `CommissionDetail.tsx`, `ClientActions.tsx`, `ArtistActions.tsx`, `AdminActions.tsx`
- Net reduction: -12 lines (removed 50, added 38)
