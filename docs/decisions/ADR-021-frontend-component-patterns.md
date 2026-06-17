# ADR-021: Frontend Component Patterns for Asset Libraries

## Status

Accepted

## Date

2026-06-17

## Context

Task 23 required building the Dashboard page and three asset library pages (Actors, Looks, Fashion Items) with grid layouts, filter panels, pagination, loading skeletons, and role-specific sections. We needed reusable component patterns that follow shadcn/ui conventions and the project's design system.

## Decision

### Component Architecture

- **AssetCard**: Reusable card component for all three asset types (actor/look/fashion-item). Accepts a `type` prop to determine the detail page route. Shows thumbnail, name, taxonomy tags, relative timestamp, and a hover overlay with "View" action.
- **FilterPanel**: Reusable filter sidebar with collapsible groups, checkbox options, active filter chips with remove buttons, a "Shared with Me" toggle (Client role only), and a reset button. Uses URL search params for filter state.
- **AssetCardSkeleton**: Loading placeholder matching the AssetCard shape using shadcn Skeleton component.
- **EmptyState**: Already existed, used for empty library views.

### Data Fetching

- Custom hooks (`useActors`, `useLooks`, `useFashionItems`) wrap React Query with proper query keys and URL-synced pagination.
- Filter state is synced to URL search params for shareable/bookmarkable filter states.
- Each hook builds query strings from filter objects, supporting taxonomy filters defined in the API spec.

### Role-Specific Dashboard

- **Client**: Wallet balance card with "Top Up" button linking to `/settings/wallet`.
- **Admin**: Stats row showing total actors, looks, items, active members, and pending commissions.
- **All roles**: Quick action cards (New Actor, New Look, New Item, New Commission for Client).

### Filter Configuration

- Filter groups are defined as static configuration arrays per library type, matching the taxonomy categories from the spec.
- Actor filters: Gender, Age, Vibe, Style.
- Look filters: Gender, Style, Season, Color, Occasion.
- Fashion Item filters: Gender, Item Type, Sub-type, Style, Color, Season.

## Alternatives Considered

### Single Generic Library Page

Could have built one `<AssetLibrary type="actor">` component with all filter logic parameterized. Rejected because each library has substantially different filter configurations and the duplication is moderate (~100 lines per page). A premature abstraction would add indirection without meaningful code reduction.

### Client-Side Filtering

Could have fetched all assets and filtered client-side. Rejected because pagination requires server-side filtering, and the API already supports taxonomy query params.

### Storing Filter State in Zustand

Could have used global UI store for filter state. Rejected in favor of URL search params, which are shareable, bookmarkable, and survive page refreshes without additional state management.

## Consequences

- Three similar but independent library pages — acceptable duplication for clarity.
- URL-driven filter state means filters work with browser back/forward navigation.
- Filter group configuration is static (not from API) — will need updating when admin adds new taxonomy categories.
- The `asChild` prop is not available on the base Button component — used `onClick` with `window.location.href` for link-style buttons instead.
