# ADR-028: Marketplace + Admin Settings UI Patterns

## Status

Accepted

## Context

Task 27 required building all marketplace UI pages (Client browse/buy, Artist management, Admin review/settings) and Admin settings pages (Users, Models, Prompts, Taxonomy, Commission Forms), plus the Notification center and Wallet page. These complete the frontend for Phase 5.

## Decision

### Marketplace Architecture

- **Client Marketplace** (`/marketplace`): Grid of `MarketplaceCard` components with type filter tabs (All/Actor Packages/Looks), price display, and Buy button. Insufficient balance shows "Need X more" with link to wallet top-up.
- **Marketplace Detail** (`/marketplace/:id`): Full output image gallery, seller info, price panel with purchase confirmation dialog. Purchase flow: click Buy → confirm dialog → POST to `/api/marketplace/:id/purchase` → redirect to library on success.
- **Artist Management** (`/marketplace/manage`): Table of listings with activate/deactivate toggle and delete. New Listing form selects asset from workspace library and sets price.
- **Admin Submissions** (`/admin/marketplace/submissions`): Tabbed view (Pending/Approved/Rejected) with Preview modal (shows all output images), Approve dialog (with price input), and Reject button.
- **Admin Listings Settings** (`/admin/marketplace/settings`): Configure required outputs per package type (checkboxes), generic standard look selector (dropdown from Look library), and editorial count.

### Admin Settings Architecture

- **Users & Roles**: Table with role filter, Edit dialog for role + API access toggle.
- **Models**: Table with activate/deactivate toggle and delete.
- **System Prompts**: Card list with Edit dialog (textarea for template) and delete.
- **Taxonomy**: Table with Add/Edit dialog (key, label, input type, required), delete. Category from URL param.
- **Commission Forms**: Card list with delete (form builder deferred).

### Notification Center

- Bell icon in TopBar with unread count badge (polls every 30s).
- Popover dropdown showing recent notifications (title, message, relative time).
- Unread notifications have blue dot indicator.
- Click to mark read + navigate (commissions or assets).
- "Mark all read" button when unread > 0.

### Wallet Page

- Balance display card with Top Up button.
- Transaction history table (amount, type, date).
- Top-up dialog → POST to `/api/wallet/top-up` → redirect to Stripe checkout.

### State Management

- All data fetched via React Query hooks (`useMarketplace`, `useAdminSubmissions`, `useWalletBalance`, etc.).
- Mutations invalidate relevant query keys on success.
- URL search params for marketplace filters (type, page).
- `useState<string | null>` for Select values (base-ui Select passes `string | null`).

### Component Patterns

- Reused existing shadcn components: `Table`, `Card`, `Badge`, `Button`, `Dialog`, `Select`, `Tabs`, `Popover`, `ScrollArea`.
- `sonner` for toast notifications.
- `EmptyState` component for empty lists.
- `Loader2` spinner for loading states.

## Alternatives Considered

- **Custom notification panel vs Popover**: Used Popover for simplicity; a full-page notification center could be added later.
- **Inline editing vs dialog for admin tables**: Chose dialogs for consistency with existing patterns and to avoid complex inline state management.
- **Separate marketplace card component vs inline**: Used inline card rendering in MarketplacePage to keep it simple; could extract to `MarketplaceCard` if reused.

## Consequences

- All marketplace flows are now fully functional end-to-end (submit → review → purchase).
- Admin can configure marketplace rules, manage users/models/prompts/taxonomy.
- Notification center provides real-time awareness (polled, not WebSocket).
- Wallet page enables self-service top-up.
- Build output: 821KB JS (2366 modules), within acceptable range for this stage.
