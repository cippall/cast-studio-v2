# Implementation Plan: Cast Studio v2

## Overview

Build a multi-tenant digital casting and wardrobe library (Node.js/Express + React/TypeScript + PostgreSQL) from scratch in 28 vertically-sliced tasks across 5 phases. Each task delivers working, testable functionality. No horizontal slicing — every slice goes from database to UI. Full spec implementation — no shortcuts.

### Architecture Decisions

- **Monorepo structure**: `server/` for backend, `client/` for frontend, shared types in `packages/types/`
- **Database**: PostgreSQL with UUID PKs, JSONB for flexible fields (prompt_recipe, generation_params), row-level workspace isolation
- **API convention**: REST, plural nouns, 202 for async generation jobs, Zod validation at boundary
- **Auth**: Dual-mode — session cookies for web, Bearer tokens for API keys; middleware chains `requireSession` or `requireApiKey`
- **Image generation**: fal.ai client abstracted behind a service layer so the rest of the app never touches provider specifics
- **State**: React Query for server state, Zustand for UI state (sidebar, modals, toasts)
- **Styling**: Tailwind CSS + shadcn/ui components
- **Payments**: Stripe integration for wallet top-up (full implementation — checkout session, webhook, ledger credit)
- **Email**: Resend (free tier: 3,000 emails/month) — transactional emails for all notification events

### Parallelization Key

- **[SEQ]** = Must be done sequentially (depends on previous task)
- **[PAR]** = Can run in parallel with other [PAR] tasks in the same phase
- **[PAR-A]** = Parallel Track A (backend-heavy)
- **[PAR-B]** = Parallel Track B (frontend-heavy)

### Dependency Graph (build order)

```
Phase 1: Foundation (all SEQ)
  DB schema + migrations → Auth session → API key auth → Workspaces

Phase 2: Core Asset System (mix SEQ/PAR)
  Asset CRUD (Actor → Look/FashionItem SEQ) → Generation pipeline → Sharing → Versions
  [PAR-A]: Backend asset services
  [PAR-B]: Frontend shell + routing (starts after Phase 1)

Phase 3: Commission + Wallet + Notifications (mix SEQ/PAR)
  Commissions → Wallet/Stripe → Premium unlock integration → Notifications → Agent workflows
  [PAR-A]: Backend services
  [PAR-B]: Frontend pages (lags 1 phase behind backend)

Phase 4: Marketplace (mix SEQ/PAR)
  Submission → Admin review → Purchase → Duplication → Management/settings
  [PAR-A]: Backend services
  [PAR-B]: Frontend pages

Phase 5: Frontend Polish + Integration (all SEQ)
  Admin settings UI → Dashboard → E2E tests → Seed data → Build verification
```

---

## Phase 1: Foundation + Database

### Task 1: Project Scaffolding [SEQ]

**Description**: Initialize monorepo with server, client, and shared packages. Configure TypeScript, ESLint, vitest, and basic tooling.

**Acceptance criteria:**
- [ ] `server/` runs `npm run dev` with ts-node-dev and starts Express on port 3001
- [ ] `client/` runs `npm run dev` with Vite and opens on port 5173
- [ ] `packages/types/` is importable from both server and client
- [ ] Pre-commit hooks via husky/lint-staged run on both packages

**Verification:**
- [ ] `npm run dev` in both server and client works
- [ ] Shared type import works: `import { AssetType } from '@cast/types'`
- [ ] PR ready

**Dependencies**: None
**Files likely touched**: `package.json` (root + 3 packages), `tsconfig.json`, `.eslintrc`, `.husky/`, `server/package.json`, `client/package.json`, `packages/types/package.json`
**Estimated scope**: Medium (3-5 files per package = ~15 total)

---

### Task 2: Database Schema + Migrations [SEQ]

**Description**: Create all 16 tables from the schema spec. Use node-pg-migrate. Include UUID extension, all FK constraints, indexes, and ON DELETE rules.

**Acceptance criteria:**
- [ ] All 16 tables created: workspaces, accounts, api_keys, wallets, ledger, assets, asset_permissions, asset_outputs, asset_output_versions, workflows, commissions, commission_assets, notifications, models, taxonomy, marketplace_listings
- [ ] All indexes from the spec are present
- [ ] `ON DELETE CASCADE` on child tables (asset_outputs→assets, api_keys→accounts, asset_permissions→assets)
- [ ] `ON DELETE SET NULL` on assets.client_id
- [ ] Unique constraints: (workspace_id, email) on accounts, (asset_id, grantee_id) where revoked_at IS NULL on asset_permissions
- [ ] Migration is idempotent — can run `up` and `down`

**Verification:**
- [ ] `npm run migrate:up` creates all tables
- [ ] `npm run migrate:down` drops them cleanly
- [ ] PgAdmin or `psql` confirms index and constraint existence

**Dependencies**: Task 1
**Files likely touched**: `server/src/db/migrations/001_initial_schema.sql`, `server/src/db/config.ts`
**Estimated scope**: Medium (migration file(s) + config)

---

### Task 3: Database Connection + Query Builder Setup [SEQ]

**Description**: Set up PostgreSQL connection pool (pg) with workspace-scoped query helpers. Every table query MUST include `workspace_id` filter. Admin bypass is a parameter.

**Acceptance criteria:**
- [ ] Connection pool connects to local PG via env vars
- [ ] Query helper `queryTable(table, { workspaceId, filters, page, pageSize })` exists
- [ ] Admin queries skip workspace filter
- [ ] Soft delete filter (`deleted_at IS NULL`) applied automatically on all queries by default
- [ ] Connection health check endpoint at `/health`

**Verification:**
- [ ] `GET /health` returns `{ status: 'ok', db: true }`
- [ ] Attempted cross-workspace query returns empty (isolation test)

**Dependencies**: Task 2
**Files likely touched**: `server/src/db/pool.ts`, `server/src/db/query-helper.ts`, `server/src/routes/health.ts`
**Estimated scope**: Small (2-3 files)

---

### Task 4: Auth — Session Login/Register/Logout [SEQ]

**Description**: Implement session-based auth. Admin can create accounts. Login returns httpOnly cookie. Passwords hashed with bcrypt.

**Acceptance criteria:**
- [ ] `POST /api/auth/register` — Admin only, creates account with email/password/role/workspace_id
- [ ] `POST /api/auth/login` — validates credentials, sets session cookie
- [ ] `POST /api/auth/logout` — clears session
- [ ] `GET /api/auth/me` — returns current account from session
- [ ] `requireSession` middleware attaches `req.account` and `req.workspace`
- [ ] Session store is PostgreSQL-backed (connect-pg-simple)

**Verification:**
- [ ] Full register → login → me → logout flow works via curl/Postman
- [ ] Unauthenticated request to protected route returns 401

**Dependencies**: Task 3
**Files likely touched**: `server/src/routes/auth.ts`, `server/src/middleware/requireSession.ts`, `server/src/db/migrations/002_sessions.sql`
**Estimated scope**: Medium (3-4 files)

---

### Task 5: API Key Auth [SEQ]

**Description**: Implement API key generation and authentication. Admin can mark Artist as API-able. API keys are hashed (bcrypt), displayed once on creation.

**Acceptance criteria:**
- [ ] `POST /api/api-keys` — creates key for authenticated API-able account, returns full key once
- [ ] `GET /api/api-keys` — lists keys (masked)
- [ ] `DELETE /api/api-keys/:id` — revokes key
- [ ] `requireApiKey` middleware resolves key → account, attaches `req.account` and `req.workspace`
- [ ] PATCH /api/accounts/:id can toggle `is_api_able`

**Verification:**
- [ ] Create API key → use it in a request → get data
- [ ] Revoked key returns 401

**Dependencies**: Task 4
**Files touched**: `server/src/routes/api-keys.ts`, `server/src/middleware/requireApiKey.ts`, `server/src/utils/key-generation.ts`
**Estimated scope**: Medium (3-4 files)

---

### Task 6: Workspace Endpoints + Middleware [SEQ]

**Description**: CRUD for workspaces (Admin only). Middleware resolves workspace from account and enforces scope.

**Acceptance criteria:**
- [ ] `GET /api/workspaces` — lists all (Admin only)
- [ ] `POST /api/workspaces` — creates workspace
- [ ] `GET /api/workspaces/:id`, `PATCH`, `DELETE`
- [ ] Middleware `requireWorkspace` attaches `req.workspace` based on account's workspace_id
- [ ] Admin bypass: Admin accounts see data across all workspaces

**Verification:**
- [ ] Admin can create workspace, Artist cannot
- [ ] Workspace-scoped queries respect tenant isolation

**Dependencies**: Task 4
**Files touched**: `server/src/routes/workspaces.ts`, `server/src/middleware/requireWorkspace.ts`
**Estimated scope**: Small (2-3 files)

---

## PHASE 1 CHECKPOINT
- [ ] Server runs, DB has all tables, auth works (session + API key), workspace isolation verified
- [ ] **REVIEW BEFORE PROCEEDING**

---

## Phase 2: Core Asset System

### Task 7: Asset CRUD — Actor [SEQ]

**Description**: Create, read, update, delete Actors. First asset type implemented. Two-phase: create identity → generate outputs.

**Acceptance criteria:**
- [ ] `POST /api/actors` — creates actor record (identity only). Supports entry_method: FORM, REFERENCE, TEXT, RANDOMIZE. Returns actor with empty outputs.
- [ ] `GET /api/actors` — list with pagination + taxonomy filters
- [ ] `GET /api/actors/:id` — full actor with all outputs grouped by layout_type
- [ ] `PATCH /api/actors/:id` — edit name + taxonomy values
- [ ] `DELETE /api/actors/:id` — soft delete
- [ ] Output layout types: headshot, fullshot, expressions_3x4, character_sheet, editorial

**Verification:**
- [ ] Full actor CRUD flow via API
- [ ] Soft delete: deleted actor not returned in queries but still in DB

**Dependencies**: Task 6
**Files touched**: `server/src/routes/actors.ts`, `server/src/services/actor-service.ts`, `server/src/db/repositories/asset-repo.ts`
**Estimated scope**: Medium (3-4 files)

---

### Task 8: Asset CRUD — Look + Fashion Item [SEQ]

**Description**: Implement Look and Fashion Item CRUD. Same pattern as Actor but with their own entry methods and output types.

**Acceptance criteria:**
- [ ] `POST /api/looks` — entry_method: PROMPT, REFERENCE, COMPOSITE. Returns 4 PENDING outputs with auto_name.
- [ ] `PATCH /api/looks/:id` — select output + rename
- [ ] `GET /api/looks`, `GET /api/looks/:id`, `DELETE /api/looks/:id`
- [ ] `POST /api/fashion-items` — entry_method: PROMPT, REFERENCE. Returns 4 PENDING outputs with auto_name.
- [ ] `PATCH /api/fashion-items/:id` — select output + rename
- [ ] `GET /api/fashion-items`, `GET /api/fashion-items/:id`, `DELETE /api/fashion-items/:id`

**Verification:**
- [ ] Create Look via prompt → get 4 options → select one → Look is finalized
- [ ] Same flow for Fashion Item

**Dependencies**: Task 7 (shares asset-repo pattern)
**Files touched**: `server/src/routes/looks.ts`, `server/src/routes/fashion-items.ts`, `server/src/services/look-service.ts`, `server/src/services/fashion-item-service.ts`
**Estimated scope**: Medium (4-5 files)

---

### Task 9: Image Generation Pipeline (fal.ai) [SEQ]

**Description**: Abstract fal.ai behind a service. Async generation: API returns 202 immediately, background worker polls fal.ai, updates output status. Store generation_params, reference_images, source_asset_outputs.

**Acceptance criteria:**
- [ ] `POST /api/actors/:id/generate` — accepts layout_type, model, options. Creates PENDING asset_output row(s). Returns 202.
- [ ] `POST /api/actors/:id/regenerate` — archives current output to asset_output_versions, marks downstream as obsolete, creates new PENDING row with version+1
- [ ] `POST /api/actors/:id/character-sheet` — accepts look_id, composes actor + look
- [ ] Background worker polls fal.ai for PENDING outputs → updates to SUCCESS/FAILED
- [ ] generation_params stores complete fal.ai request JSON
- [ ] FAILED outputs still charge credits, show error, have Retry button in API response
- [ ] Generation queue is debounced — only one worker processes jobs

**Verification:**
- [ ] Trigger generation → poll GET /api/generation-jobs/:id → status goes PENDING → SUCCESS
- [ ] Regenerate archives old version, increments version number, marks downstream obsolete
- [ ] Failed generation stores error_message, still has cost_credits

**Dependencies**: Task 7, Task 8
**Files touched**: `server/src/services/fal-service.ts`, `server/src/workers/generation-worker.ts`, `server/src/routes/generation-jobs.ts`, `server/src/services/generation-service.ts`
**Estimated scope**: Large (5-6 files — core of the system)

---

### Task 10: Image Upload + Storage [SEQ]

**Description**: Handle reference image uploads. Store to local disk (backup). Abstract storage behind interface for future S3.

**Acceptance criteria:**
- [ ] `POST /api/upload` — accepts multipart image, saves to `/uploads/ref/`, returns URL
- [ ] File naming: `ref_{asset_id}_{version}_{short_uuid}.png`
- [ ] Storage interface: `StorageProvider` with `save()`, `getUrl()`, `delete()` methods. Local implementation now, S3 later.
- [ ] Max file size: 10MB. Allowed types: png, jpg, webp.
- [ ] Signed URLs for private workspace images

**Verification:**
- [ ] Upload reference image → get URL back
- [ ] File exists on disk at expected path

**Dependencies**: Task 9
**Files touched**: `server/src/routes/upload.ts`, `server/src/services/storage/local-storage.ts`, `server/src/services/storage/types.ts`
**Estimated scope**: Small (2-3 files)

---

### Task 11: Asset Sharing (asset_permissions) [PAR-A]

**Description**: Implement sharing layer. Artists can share assets with specific clients (CLIENT_SHARED). Hard cutoff via revoked_at.

**Acceptance criteria:**
- [ ] `POST /api/assets/:id/share` — creates asset_permissions record with grantee_id
- [ ] `GET /api/assets/:id/permissions` — lists active permissions
- [ ] `DELETE /api/permissions/:id` — sets revoked_at (hard cutoff)
- [ ] `shared_with_me` filter on all asset list endpoints checks asset_permissions
- [ ] Sharing scope enforces: Private (creator+Admin), Studio Public (all Artists in workspace), Client Shared (specific client)

**Verification:**
- [ ] Artist shares Actor with Client → Client sees it in "shared with Me" filter
- [ ] Revoke → Client no longer sees it

**Dependencies**: Task 7 (needs asset CRUD)
**Files touched**: `server/src/routes/sharing.ts`, `server/src/services/sharing-service.ts`, updates to asset-repo.ts
**Estimated scope**: Small (2-3 files)

---

### Task 12: Asset Version History [SEQ]

**Description**: Expose version history endpoint. When regenerating, old outputs are archived to asset_output_versions.

**Acceptance criteria:**
- [ ] `GET /api/assets/:id/outputs/:outputId/versions` — returns current + archived versions
- [ ] Regenerate in Task 9 already archives old version (verify integration)
- [ ] Version numbers increment correctly (1, 2, 3...)
- [ ] Each archived version preserves generation_params, image_url, model, status

**Verification:**
- [ ] Regenerate headshot 3 times → version history shows all 3

**Dependencies**: Task 9
**Files touched**: `server/src/routes/actors.ts` (add version endpoint), updates to generation-service.ts
**Estimated scope**: Small (1-2 files)

---

### Task 22: Frontend Foundation — App Shell + Routing [PAR-B]

**STARTS AFTER TASK 6 (Phase 1 complete). Runs in parallel with Tasks 7-12.**

**Description**: React app shell with sidebar, top bar, routing, React Query setup, Zustand UI store.

**Acceptance criteria:**
- [ ] AppShell component: Sidebar + TopBar + main content area
- [ ] Sidebar renders nav items based on role (Artist/Client/Admin)
- [ ] React Router with all routes from spec
- [ ] React Query client configured with query key patterns from spec
- [ ] Zustand store: sidebarCollapsed, activeModal, toastQueue
- [ ] Auth flow: login page → session → redirect to dashboard
- [ ] Protected routes redirect to login

**Verification:**
- [ ] Login → Dashboard renders with correct sidebar for role
- [ ] Navigate to /actors → Actor Library page (empty state)

**Dependencies**: Task 6 (needs auth API)
**Files touched**: `client/src/App.tsx`, `client/src/components/AppShell.tsx`, `client/src/components/Sidebar.tsx`, `client/src/components/TopBar.tsx`, `client/src/router.tsx`, `client/src/store/ui-store.ts`, `client/src/lib/query-client.ts`
**Estimated scope**: Large (6-7 files)

---

## PHASE 2 CHECKPOINT
- [ ] Full asset CRUD for all 3 types, generation pipeline async with versioning, sharing works
- [ ] Frontend shell renders with routing and auth
- [ ] **REVIEW BEFORE PROCEEDING**

---

## Phase 3: Commission + Wallet + Notifications

### Task 13: Commission Workflow [SEQ]

**Description**: Full commission lifecycle. Client submits, Admin assigns, Artist executes, Client reviews, approve/changes, premium unlock.

**Acceptance criteria:**
- [ ] `POST /api/commissions` — Client submits request with title + brief (JSONB form data)
- [ ] `GET /api/commissions` — filtered by role (Client: own, Artist: assigned, Admin: all)
- [ ] `GET /api/commissions/:id` — with linked assets
- [ ] `PATCH /api/commissions/:id/assign` — Admin assigns to Artist
- [ ] `PATCH /api/commissions/:id/status` — status transitions with validation:
  - Artist → SUBMITTED (with premium_cost + asset_ids)
  - Client → CHANGES_REQUESTED
  - Client → APPROVED (triggers premium unlock)
  - Any → CANCELLED
- [ ] Status transition validates: Requested → Assigned → In Progress → Submitted → Changes Requested → Approved → Cancelled
- [ ] commission_assets table links submitted work

**Verification:**
- [ ] Full flow: submit → assign → in progress → submit work → approve → client_id set on assets

**Dependencies**: Task 7 (assets exist)
**Files touched**: `server/src/routes/commissions.ts`, `server/src/services/commission-service.ts`, `server/src/db/repositories/commission-repo.ts`
**Estimated scope**: Medium (3-4 files)

---

### Task 14: Wallet + Ledger + Stripe Integration [SEQ]

**Description**: Client wallet system with full Stripe integration. Credit deduction on generation, top-up via Stripe checkout, marketplace purchase, commission premium unlock.

**Acceptance criteria:**
- [ ] `GET /api/wallet` — returns balance
- [ ] `POST /api/wallet/top-up` — creates Stripe Checkout Session, returns session URL
- [ ] `POST /api/wallet/stripe-webhook` — handles Stripe webhook (checkout.session.completed), credits wallet via ledger TOP_UP entry
- [ ] `GET /api/wallet/transactions` — ledger entries with pagination
- [ ] Ledger entries created for: CHARGE (generation), TOP_UP, ESCROW_HOLD, ESCROW_REFUND
- [ ] Generation deducts credits before calling fal.ai (or immediately on PENDING)
- [ ] Insufficient balance returns 422 with clear error
- [ ] Stripe webhook is idempotent (handles duplicate events)
- [ ] Stripe test mode works with test keys

**Verification:**
- [ ] Top up via Stripe test mode → webhook fires → balance increases
- [ ] Generate (costs 0.05) → balance decreases, ledger shows CHARGE
- [ ] Ledger shows all transaction types

**Dependencies**: Task 9 (generation pipeline)
**Files touched**: `server/src/routes/wallet.ts`, `server/src/services/wallet-service.ts`, `server/src/services/stripe-service.ts`, `server/src/db/repositories/wallet-repo.ts`
**Estimated scope**: Large (5-6 files — Stripe integration is non-trivial)

---

### Task 15: Commission Premium Unlock Integration [SEQ]

**Description**: Wire commission approval to wallet deduction and asset ownership transfer.

**Acceptance criteria:**
- [ ] When commission status → APPROVED: deduct premium_cost from client wallet (ledger entry), set client_id on all linked assets, set source_type = 'COMMISSION'
- [ ] Insufficient balance → return 402, prompt top-up, do NOT approve
- [ ] Assets appear in Client's library after unlock
- [ ] Artist can no longer edit client-owned assets (enforced at API level)

**Verification:**
- [ ] Approve commission with premium_cost 5.00 → wallet deducted → assets owned by Client

**Dependencies**: Task 13, Task 14
**Files touched**: `server/src/services/commission-service.ts` (update), `server/src/services/wallet-service.ts` (update)
**Estimated scope**: Small (1-2 files)

---

### Task 16: Notifications + Resend Email [SEQ]

**Description**: In-app notifications for all key events. Email via Resend (free tier: 3,000/month). Both channels fire for every notification event.

**Acceptance criteria:**
- [ ] `GET /api/notifications` — paginated, filter by is_read
- [ ] `PATCH /api/notifications/:id/read` — mark as read
- [ ] `POST /api/notifications/read-all` — mark all read
- [ ] Notifications created for: COMMISSION_ASSIGNED, COMMISSION_SUBMITTED, COMMISSION_APPROVED, COMMISSION_CHANGES_REQUESTED, ASSET_SHARED, WORKFLOW_COMPLETED, WORKFLOW_FAILED
- [ ] Notification service called from commission, sharing, generation services
- [ ] Resend integration: sends HTML email for each notification event
- [ ] Email templates for each notification type (minimal but styled)
- [ ] Unread count badge works
- [ ] Email sending is async (non-blocking) — failures logged but don't break the request

**Verification:**
- [ ] Commission assigned → Artist gets in-app notification + email
- [ ] Work submitted → Client gets in-app notification + email
- [ ] Mark as read → unread count decreases

**Dependencies**: Task 13, Task 9
**Files touched**: `server/src/routes/notifications.ts`, `server/src/services/notification-service.ts`, `server/src/services/email-service.ts`, `server/src/db/repositories/notification-repo.ts`, `server/src/templates/emails/`
**Estimated scope**: Large (5-6 files — email templates + Resend integration)

---

### Task 17: Workflow Endpoints (API/Agent) [SEQ]

**Description**: Agent workflow support with pre-flight escrow. Agents start a workflow, max estimated cost is locked (escrow), consumed credits tracked, unconsumed refunded on cancel.

**Acceptance criteria:**
- [ ] `POST /api/workflows/start` — agent starts workflow with steps[]. Calculates max escrow from steps, locks it in ledger (ESCROW_HOLD). Returns workflow ID.
- [ ] `GET /api/workflows/:id` — status + consumed credits + step progress
- [ ] `POST /api/workflows/:id/cancel` — stops workflow, auto-refunds unconsumed escrow (ESCROW_REFUND)
- [ ] Workflow table tracks: agent_id, total_escrow, consumed_credits, status, error_code, error_reason

**Verification:**
- [ ] Start workflow → escrow held → cancel → escrow refunded
- [ ] Balance returns to original after cancellation

**Dependencies**: Task 5 (API keys), Task 14 (wallet/ledger)
**Files touched**: `server/src/routes/workflows.ts`, `server/src/services/workflow-service.ts`, `server/src/workers/workflow-worker.ts`
**Estimated scope**: Medium (3-4 files)

---

### Task 23: Dashboard + Asset Libraries (UI) [PAR-B]

**STARTS AFTER TASK 22. Runs in parallel with Tasks 13-17.**

**Description**: Dashboard page with quick actions + recent activity. Actor/Look/Fashion Item library pages with grid + filters.

**Acceptance criteria:**
- [ ] Dashboard: quick action cards, recent activity list, wallet balance (Client), stats (Admin)
- [ ] Actor Library: grid of cards (headshot + name + tags), filter panel, pagination, "Shared with Me" toggle
- [ ] Look Library: same pattern with look-specific filters
- [ ] Fashion Item Library: same pattern with item-specific filters
- [ ] Empty states with illustration + action button
- [ ] Loading skeletons matching card shape

**Verification:**
- [ ] Create actor via API → appears in library grid
- [ ] Filter by gender → only matching actors shown

**Dependencies**: Task 22, Task 7, Task 8 (needs asset APIs)
**Files touched**: `client/src/pages/Dashboard.tsx`, `client/src/pages/actors/ActorLibrary.tsx`, `client/src/pages/looks/LookLibrary.tsx`, `client/src/pages/fashion-items/FashionItemLibrary.tsx`, `client/src/components/AssetCard.tsx`, `client/src/components/FilterPanel.tsx`, `client/src/components/EmptyState.tsx`
**Estimated scope**: Large (7-8 files)

---

## PHASE 3 CHECKPOINT
- [ ] Commission flow end-to-end, wallet + Stripe deductions correct, notifications + email fire, agent workflows work
- [ ] Dashboard + library pages render data from API
- [ ] **REVIEW BEFORE PROCEEDING**

---

## Phase 4: Marketplace

### Task 18: Marketplace Submission + Admin Review [SEQ]

**Description**: Artists submit assets to marketplace. Admin reviews queue, approves (sets price) or rejects.

**Acceptance criteria:**
- [ ] `POST /api/marketplace/submit` — Artist submits asset. Validates all required outputs are SUCCESS. Sets marketplace_status = PENDING.
- [ ] `GET /api/marketplace/submissions` — Artist views own submissions with status
- [ ] `GET /api/admin/marketplace/submissions` — Admin views all pending submissions with full output previews
- [ ] `POST /api/admin/marketplace/submissions/:assetId/approve` — Admin approves, sets price, creates marketplace_listing record. Sets marketplace_status = APPROVED, is_marketplace_frozen = TRUE.
- [ ] `POST /api/admin/marketplace/submissions/:assetId/reject` — Admin rejects. Sets marketplace_status = REJECTED.
- [ ] Frozen assets: cannot edit, regenerate, delete. Can view and duplicate.

**Verification:**
- [ ] Artist submits with incomplete outputs → 409 error listing what's missing
- [ ] Admin approves → listing created → asset frozen
- [ ] Frozen asset edit attempt → 403

**Dependencies**: Task 9 (outputs), Task 7 (assets)
**Files touched**: `server/src/routes/marketplace.ts`, `server/src/routes/admin/marketplace.ts`, `server/src/services/marketplace-service.ts`
**Estimated scope**: Medium (4-5 files)

---

### Task 19: Marketplace Listings + Client Purchase [SEQ]

**Description**: Client-facing storefront. Browse, buy, duplicate created in client workspace.

**Acceptance criteria:**
- [ ] `GET /api/marketplace` — Client browses active listings (paginated, filter by type/price/artist)
- [ ] `GET /api/marketplace/:id` — listing detail with all output images
- [ ] `POST /api/marketplace/:id/purchase` — validates balance, deducts wallet, creates duplicate asset in Client's workspace with client_id set, source_asset_id, source_type = MARKETPLACE_PURCHASE, sets purchased_by/purchased_at on listing
- [ ] Actor Package purchase duplicates all outputs (headshot, fullshot, expressions, character_sheet, editorial)
- [ ] Insufficient balance → 402 with top-up prompt
- [ ] Already purchased listing → 409

**Verification:**
- [ ] Client with balance purchases Actor Package → assets appear in their library
- [ ] Balance correctly deducted, source tracking correct

**Dependencies**: Task 18, Task 14
**Files touched**: `server/src/routes/marketplace.ts` (add purchase endpoint), `server/src/services/marketplace-service.ts`, `server/src/services/wallet-service.ts`
**Estimated scope**: Medium (3-4 files)

---

### Task 20: Asset Duplication [SEQ]

**Description**: Artist duplicates any asset they own or marketplace-frozen asset. Duplicate gets new name, same everything, source_type = DUPLICATE. Fully editable.

**Acceptance criteria:**
- [ ] `POST /api/assets/:id/duplicate` — accepts optional name, creates duplicate with source_asset_id, source_type = DUPLICATE
- [ ] Duplicate inherits: seed, prompt_recipe, taxonomy_values, all output image URLs
- [ ] Duplicate outputs are new asset_output rows (new IDs, same image_urls)
- [ ] Duplicate is editable (not frozen)

**Verification:**
- [ ] Duplicate Actor → get new Actor with new ID, same images, source_asset_id points to original

**Dependencies**: Task 7, Task 9
**Files touched**: `server/src/services/actor-service.ts` (add duplicate), `server/src/routes/actors.ts`
**Estimated scope**: Small (1-2 files)

---

### Task 21: Artist Marketplace Management + Listings Settings [SEQ]

**Description**: Artist/Admin manage listings. Admin configures what constitutes a marketplace package.

**Acceptance criteria:**
- [ ] `GET /api/marketplace/manage` — Artist sees own listings, Admin sees all
- [ ] `PATCH /api/marketplace/manage/:id` — update price, toggle active
- [ ] `DELETE /api/marketplace/manage/:id` — remove listing (DELISTED)
- [ ] `GET /api/admin/marketplace/settings` — get package configuration
- [ ] `PUT /api/admin/marketplace/settings` — set required_outputs per listing type, generic_standard_look_id, editorial_count
- [ ] Agent marketplace submission: `POST /api/agent/marketplace/submit` (API key auth only)

**Verification:**
- [ ] Admin sets Actor Package to require headshot+fullshot+expressions+character_sheet+editorial
- [ ] Artist submits asset missing editorial → rejected with clear message

**Dependencies**: Task 18
**Files touched**: `server/src/routes/admin/marketplace.ts`, `server/src/services/marketplace-service.ts`
**Estimated scope**: Small (2-3 files)

---

### Task 24: Actor Designer + Actor Page (UI) [PAR-B]

**STARTS AFTER TASK 23. Runs in parallel with Tasks 18-21.**

**Description**: Multi-step Actor creation wizard (entry method → iterate headshot/fullshot/expressions → name & save). Actor Page with all output sections.

**Acceptance criteria:**
- [ ] Stage 1: 4 entry method cards (Form, Reference, Text, Randomize)
- [ ] Stage 2: Horizontal stepper (Headshot → Fullshot → Expressions). Each step: grid of generated options, select one, Regenerate, Confirm.
- [ ] Stage 3: Name + properties form → save → redirect to Actor Page
- [ ] Actor Page: name + headshot top, action buttons, collapsible sections per asset type, obsolete banners, character sheet look selector
- [ ] Generation status component: PENDING (spinner), SUCCESS (checkmark), FAILED (error + Retry)
- [ ] Marketplace freeze indicators: disabled buttons, lock icon, status badge

**Verification:**
- [ ] Full actor creation flow: Form entry → generate headshot → select → fullshot → select → expressions → select → name → save → Actor Page
- [ ] Regenerate headshot → fullshot shows obsolete banner

**Dependencies**: Task 22, Task 9, Task 7
**Files touched**: `client/src/pages/actors/ActorDesigner.tsx`, `client/src/pages/actors/ActorPage.tsx`, `client/src/components/GenerationCard.tsx`, `client/src/components/ImageGrid.tsx`, `client/src/components/Stepper.tsx`
**Estimated scope**: Large (5-6 files)

---

## PHASE 4 CHECKPOINT
- [ ] Marketplace submission → approval → purchase → duplication all work
- [ ] Actor Designer + Actor Page UI functional
- [ ] **REVIEW BEFORE PROCEEDING**

---

## Phase 5: Frontend Polish + Admin + Integration

### Task 25: Look Designer + Fashion Item Creator (UI) [SEQ]

**Description**: Look creation (3 input methods) and Fashion Item creation (2 input methods). Both converge to select + name + save.

**Acceptance criteria:**
- [ ] Look Designer: 3 input method cards. Prompt → textarea. Reference → upload + extracted pieces checkboxes. Compose → Fashion Item multi-select grid.
- [ ] Look Designer: generated options grid, select one, auto-name, edit name, save
- [ ] Fashion Item Creator: 2 input methods (Prompt, Reference). Same select + name + save flow.
- [ ] Look Detail page: image, name, taxonomy values, actions
- [ ] Fashion Item Detail page: same pattern

**Verification:**
- [ ] Create Look from prompt → 4 options → select → name → save → Look Detail page
- [ ] Create Fashion Item from reference → upload → extract → select → save

**Dependencies**: Task 22, Task 8
**Files touched**: `client/src/pages/looks/LookDesigner.tsx`, `client/src/pages/looks/LookDetail.tsx`, `client/src/pages/fashion-items/FashionItemCreator.tsx`, `client/src/pages/fashion-items/FashionItemDetail.tsx`
**Estimated scope**: Medium (4-5 files)

---

### Task 26: Commission UI [SEQ]

**Description**: Commission pages for all 3 roles. Commission detail with submitted work, approve/changes flow.

**Acceptance criteria:**
- [ ] Client: "My Commissions" list with status tabs, "New Commission" form (dynamic from admin template)
- [ ] Artist: "Assigned Commissions" list, "View Brief" + "Submit Work" buttons
- [ ] Admin: "All Commissions" list, "Assign to Artist/Agent" action
- [ ] Commission Detail: brief display, submitted work thumbnails, Approve/Changes buttons (Client), premium cost display
- [ ] Premium unlock confirmation dialog with cost + balance after

**Verification:**
- [ ] Client submits commission → Admin sees it → assigns → Artist submits work → Client approves → assets owned

**Dependencies**: Task 22, Task 13, Task 15
**Files touched**: `client/src/pages/commissions/CommissionList.tsx`, `client/src/pages/commissions/CommissionDetail.tsx`, `client/src/pages/commissions/NewCommission.tsx`, `client/src/components/TaxonomyForm.tsx`
**Estimated scope**: Medium (4-5 files)

---

### Task 27: Marketplace UI + Admin Settings [SEQ]

**Description**: Client marketplace (browse/buy), Artist submission button, Admin review queue + listings settings. Admin taxonomy/model/prompt management.

**Acceptance criteria:**
- [ ] Client Marketplace: grid of listings (thumbnail + name + artist + price + Buy), filter by type/price, detail page with all outputs, purchase confirmation dialog
- [ ] Artist: "Submit to Marketplace" button on asset pages (disabled with missing outputs listed), status badges
- [ ] Admin Submissions: review queue with Preview/Approve/Reject, approve dialog with price input
- [ ] Admin Listings Settings: configure required outputs per package type, generic standard look selector, editorial count
- [ ] Admin Settings pages: Users & Roles table, Models table, System Prompts editor, Taxonomy management (CRUD), Commission Forms management
- [ ] Notification center dropdown with unread count

**Verification:**
- [ ] Full marketplace flow: Artist submits → Admin approves → Client buys → assets in Client library
- [ ] Admin adds new taxonomy entry → appears in Actor Designer form

**Dependencies**: Task 22, Task 18, Task 19, Task 21
**Files touched**: `client/src/pages/marketplace/Marketplace.tsx`, `client/src/pages/marketplace/MarketplaceDetail.tsx`, `client/src/pages/admin/Submissions.tsx`, `client/src/pages/admin/ListingsSettings.tsx`, `client/src/pages/admin/Settings.tsx`, `client/src/components/NotificationDropdown.tsx`
**Estimated scope**: Large (8-10 files)

---

### Task 28: Integration + End-to-End Testing [SEQ]

**Description**: Wire everything together. Integration tests for critical paths. Seed data script. Final verification of all success criteria.

**Acceptance criteria:**
- [ ] Seed script creates: 1 Studio workspace, 1 Admin, 2 Artists (1 API-enabled), 1 Client workspace with Client, sample assets
- [ ] Integration tests for: Actor creation → generation → versioning, Commission full flow, Marketplace purchase flow, API key auth flow, Stripe top-up flow, Email notification flow
- [ ] All success criteria from spec.md verified
- [ ] Build passes: `npm run build` in both server and client
- [ ] No TypeScript errors, no ESLint warnings

**Verification:**
- [ ] `npm test` passes
- [ ] `npm run build` passes
- [ ] Manual smoke test: login as each role, verify core flows

**Dependencies**: All previous tasks
**Files touched**: `server/src/db/seed.ts`, `server/src/__tests__/integration/*.test.ts`, `client/src/__tests__/*.test.tsx`
**Estimated scope**: Large (5-8 test files + seed)

---

## PHASE 5 CHECKPOINT — SHIP
- [ ] Full UI for all roles, all flows work end-to-end, tests pass, build clean
- [ ] All spec success criteria verified

---

## Parallelization Summary

| Phase | Sequential Tasks | Parallel Track A (Backend) | Parallel Track B (Frontend) |
|-------|-----------------|---------------------------|---------------------------|
| 1 | Tasks 1-6 | — | — |
| 2 | Tasks 7-12 | Tasks 7-12 | Task 22 (starts after T6) |
| 3 | Tasks 13-17 | Tasks 13-17 | Task 23 (starts after T22) |
| 4 | Tasks 18-21 | Tasks 18-21 | Task 24 (starts after T23) |
| 5 | Tasks 22-28 | — | — (all sequential — integration) |

**Critical path**: T1→T2→T3→T4→T5→T6→T7→T8→T9→T10→T11→T12→T13→T14→T15→T16→T17→T18→T19→T20→T21→T25→T26→T27→T28

**Parallel speedup**: Frontend Track B starts after Phase 1 (T6) and runs ~2 phases behind backend. Total wall-clock time with 2 workers: ~60% of sequential time.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| fal.ai API changes / downtime | High — blocks all generation | Abstract behind service interface, mock in tests, queue retries |
| Complex dependency chain (headshot→fullshot→expressions) | Medium — easy to break downstream | Versioning + obsolete logic in single service, tested in isolation |
| Workspace isolation bugs | High — data leak between tenants | Query helper enforces workspace_id on every query, integration test for cross-tenant access |
| Async generation race conditions | Medium — double-spend credits | DB transaction wraps credit deduction + PENDING row creation |
| Marketplace purchase race (two clients buy same listing) | Medium — double-sell | DB unique constraint on purchased_by + transaction lock |
| Frontend state complexity (generation polling) | Medium — UI gets out of sync | React Query refetch on notification, polling fallback, optimistic updates |
| Stripe webhook reliability | Medium — missed top-ups | Idempotent webhook handler, ledger transaction deduplication, retry queue |
| Resend email deliverability | Low — emails in spam | Proper DKIM/SPF setup, use Resend's domain verification |

---

## Third-Party Services Summary

| Service | Purpose | Free Tier | Config |
|---------|---------|-----------|--------|
| **fal.ai** | Image generation (text-to-image, image-to-image, vision) | Pay-per-use | API key in env |
| **Stripe** | Wallet top-up payments | No monthly fee, 2.9% + 30¢/transaction | Secret key + webhook secret in env |
| **Resend** | Transactional email notifications | 3,000 emails/month | API key + verified domain in env |

---

## Open Questions

1. **fal.ai model catalog caching**: Fetch models on admin page load, or cache in DB? Recommend cache in DB with refresh button.
2. **Image backup worker**: Local backup of fal.ai images — run as separate worker or part of generation worker? Recommend part of generation worker for simplicity.
3. **Multiple workspaces per user**: Spec says one Client = one workspace. Defer multi-workspace support to post-MVP.
