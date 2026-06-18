# Changelog

## [1.0.0] - 2026-06-18

### Added

- **Actor System**: Full actor creation pipeline with 3-stage wizard (identity → iterate outputs → name + save). Supports 4 entry methods: Form, Reference, Text, Randomize. Dependency chain (headshot → fullshot → expressions → character sheet → editorial) with versioning and obsolete asset tracking.
- **Look Designer**: Create looks via prompt, reference extraction (simulated), or Fashion Item composition. Look detail page with marketplace submission.
- **Fashion Item Creator**: Create fashion items via prompt or reference extraction. Detail page with marketplace submission.
- **Commission Workflow**: End-to-end commission lifecycle (Requested → Assigned → In Progress → Submitted → Changes Requested → Approved → Cancelled). Premium unlock on approval deducts wallet credits and transfers asset ownership.
- **Marketplace**: Studio-only storefront. Artists submit assets for admin review. Clients browse, purchase, and receive duplicated assets with `client_id` set.
- **Wallet + Stripe**: Client wallet with credit tracking. Stripe Checkout Session for top-up. Ledger entries for all transactions (CHARGE, TOP_UP, ESCROW_HOLD, ESCROW_REFUND).
- **Notifications**: In-app + email notifications for commission events (assigned, submitted, approved, changes requested), asset sharing, and workflow completion/failure.
- **API Key Auth**: Admin can mark Artists as API-able. API keys are hashed with bcrypt, displayed once on creation. Cost tracking per key.
- **Session Auth**: PostgreSQL-backed sessions with httpOnly cookies. Admin can create accounts.
- **Workspace Isolation**: All queries filter by `workspace_id`. Admin bypass is explicit. Studio and Client workspaces are fully isolated except via sharing.
- **Asset Sharing**: `asset_permissions` table with `revoked_at` hard cutoff. "Shared with Me" filter on all asset libraries.
- **Asset Duplication**: Artists can duplicate any asset. Duplicates inherit all fields, get new name, are fully editable.
- **Marketplace Freeze**: Approved marketplace assets are frozen (no edit/regenerate/delete). Can view and duplicate.
- **Soft Delete**: All assets use `deleted_at` timestamp. Queries filter `deleted_at IS NULL`.
- **Versioning**: Regenerate archives old output to `asset_output_versions`, increments version, marks downstream obsolete.
- **Storage Abstraction**: `StorageProvider` interface with local disk implementation. Ready for S3 migration.
- **Image Upload**: Reference image uploads with `ref_{asset_id}_{version}_{short_uuid}.png` naming.
- **Agent Workflows**: Pre-flight escrow with auto-refund on failure. Workflow status tracking.
- **Admin Settings**: Users & Roles, Models, System Prompts, Taxonomy, Commission Forms management.
- **Seed Script**: Development database seed with sample workspaces, accounts, assets, and API keys.
- **Integration Tests**: 18 service-level integration tests covering commission lifecycle, marketplace purchase, actor generation + versioning, notification dispatch, and wallet operations.

### Technical Details

- **Backend**: Node.js + Express + TypeScript ESM, PostgreSQL (pg), fal.ai, Stripe, Resend
- **Frontend**: React 18 + TypeScript, React Router v6, TanStack Query v5, Zustand, Tailwind CSS, shadcn/ui
- **Testing**: Vitest (437 tests across 22 test files)
- **Validation**: Zod at API boundary
- **Total ADRs**: 29 (ADR-001 through ADR-029)
