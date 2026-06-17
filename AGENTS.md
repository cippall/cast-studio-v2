# Cast Studio v2 — Agent Operating Contract

## Project

Cast Studio v2: Multi-tenant digital casting and wardrobe library. Node.js/Express + React + PostgreSQL.
Specs: `specs/` (spec.md, database-schema.md, api.md, ui.md)
Plan: `specs/implementation-plan.md`

## Required Skills

### taste-skill

**Load this skill at the beginning of every session** before writing any frontend/UI code or making design decisions.

Load with: `skill_view(name="taste-skill")`

This skill provides anti-slop frontend design rules for landing pages, portfolios, and redesigns. It covers:

**Brief inference** — read the room before coding; state a one-line "Design Read" (Section 0)
**Three Dials** — DESIGN_VARIANCE / MOTION_INTENSITY / VISUAL_DENSITY gating all layout decisions (Section 1)
**Design system selection** — when to use official packages (Fluent, Material, Carbon, GOV.UK, USWDS, shadcn/ui) vs. aesthetic-native CSS (Section 2)
**Stack defaults** — React RSC, Tailwind v4, Motion for animation, Phosphor/HugeIcons for icons (Section 3)
**Typography discipline** — sans-serif default (Inter very discouraged), serif only with justification, paired font stacks (Section 4.1)
**Color calibration** — one accent, lock it, AI-purple ban, premium-consumer palette ban (Section 4.2)
**Layout diversification** — anti-center bias, bento rhythm, zigzag cap (Section 4.3-4.4)
**Image strategy** — generate images first or use Picsum seeds; no div-based fake screenshots (Section 4.8)
**Content density** — ≤25 words sub-paragraphs, no spec-table hairlines, quotes ≤3 lines (Section 4.9)
**AI Tells** — forbidden patterns: AI-purple, Inter default, em-dash, three equal cards, fake "Jane Doe" names, startup-slop brand names, scroll cues (Section 9)
**Pre-Flight Check** — 50+ point mandatory checklist before shipping any UI work (Section 14)
**When building any UI (frontend pages, components, layouts): always load taste-skill first and follow its Pre-Flight Check.**

### agent-skills-documentation-and-adrs

**Load this skill after each implementation task** to document decisions, write ADRs, and update project documentation.

Load with: `skill_view(name="agent-skills-documentation-and-adrs")`

**When to document (mandatory):**
- After every architectural decision (framework choice, data model change, API design, auth strategy)
- After every public API addition or change
- After shipping any feature that changes user-facing behavior
- After overcoming a non-trivial bug or pitfall (document the gotcha)
- After every implementation plan task (Task 1 through Task 28)

**What to produce:**
- ADRs stored in `docs/decisions/` with sequential numbering (ADR-001, ADR-002, ...)
- Inline comments for non-obvious *why* (never restate *what*)
- Updated README if project setup/commands change
- Changelog entries for shipped features

**ADR template:** See the documentation-and-adrs skill for the full template. Minimum viable ADR: Context → Decision → Alternatives Considered → Consequences.

### agent-skills-code-simplification

**Load this skill after each task, before marking it complete**, to simplify code for clarity without changing behavior.

Load with: `skill_view(name="agent-skills-code-simplification")`

**When to simplify (mandatory):**
- After every implementation task — review what was written and simplify if needed
- When a function exceeds 50 lines or nests 3+ levels deep
- When the same logic is duplicated in 2+ places
- When variable/function names are generic (`data`, `result`, `temp`, `item`)
- When tests pass but the code is harder to read than it should be

**Simplification principles (from the skill):**
1. **Preserve behavior exactly** — all tests must still pass without modification
2. **Follow project conventions** — match existing patterns, don't impose external style
3. **Prefer clarity over cleverness** — explicit > compact when compact requires mental parsing
4. **Maintain balance** — don't over-inline helpers that name a concept; don't combine unrelated logic
5. **Scope to what changed** — simplify recently written code, not unrelated modules

**What NOT to do:**
- Don't simplify code you don't fully understand yet
- Don't batch multiple simplifications into one untested change
- Don't remove error handling to make code "cleaner"
- Don't refactor unrelated code outside the current task scope
- Don't change behavior — if tests need updating, you changed behavior

**Process:** Make one simplification → run tests → if pass, continue; if fail, revert. Commit simplifications separately from feature changes.

### agent-skills-code-review-and-quality

**Load this skill before marking any task complete** to review code across five axes: correctness, readability, architecture, security, and performance.

Load with: `skill_view(name="agent-skills-code-review-and-quality")`

**When to review (mandatory):**
- After every implementation task — review what was written before committing
- Before merging any change — no exceptions
- After any bug fix — review both the fix and the regression test
- When code exceeds ~300 lines changed — split it instead of reviewing one massive change

**Five review axes:**
1. **Correctness** — Does it match the spec? Edge cases handled? Error paths? Tests actually test the right things?
2. **Readability** — Can another engineer understand this without help? Names descriptive? No unnecessary complexity?
3. **Architecture** — Follows existing patterns? Clean module boundaries? No circular dependencies?
4. **Security** — Input validated? Secrets out of code? Auth checks in place? SQL parameterized?
5. **Performance** — No N+1 queries? No unbounded loops? Pagination on list endpoints?

**Severity labels for findings:**
- `Critical:` — Blocks merge (security, data loss, broken functionality)
- *(no prefix)* — Required change before merge
- `Nit:` — Minor, optional (formatting, style preferences)
- `Optional:` / `Consider:` — Suggestion, not required
- `FYI` — Informational only, no action needed

**Change sizing:**
- ~100 lines → Good, reviewable in one sitting
- ~300 lines → Acceptable if single logical change
- ~1000+ lines → Too large, split it

**Separate refactoring from feature work.** A change that refactors AND adds behavior is two PRs.

## Execution Rules

1. Read the relevant spec(s) and implementation plan before writing code
2. Follow the plan tasks in order — phases are sequential, tasks within phases follow dependency order
3. Test-first: write failing test → implement → verify pass → commit
4. Commit after each task step with conventional commit messages
5. Never edit files outside your domain (backend-dev ≠ frontend-dev)
6. Run `npm run typecheck` and `npm run test` before committing
7. **Max 200 lines per file.** If a file exceeds 200 lines, split it into smaller modules with clear responsibilities. No exceptions for "it's all related."
8. **Max 50 lines per function.** If a function exceeds 50 lines, extract helper functions. Each function should do one thing.

## Naming Conventions

Follow these conventions consistently. Load `agent-skills-code-simplification` and `agent-skills-code-review-and-quality` for detailed guidance.

### General
- **No generic names:** `data`, `result`, `temp`, `val`, `item` — always describe the content (`userProfile`, `validationErrors`, `pendingJobs`)
- **No abbreviations:** `usr`, `cfg`, `btn`, `evt` — use full words unless the abbreviation is universal (`id`, `url`, `api`)
- **Names must match behavior:** A function named `get` that also mutates state must be renamed to reflect what it actually does

### TypeScript / JavaScript
- **Variables, functions, parameters:** `camelCase`
- **Types, interfaces, classes, enums:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE` for true constants; `camelCase` for module-level `const` values
- **React components:** `PascalCase` (both the component name and the file name)
- **React hooks:** `use` prefix + descriptive name (`useAuth`, `useGeneration`)
- **Files:** `camelCase.ts` for utilities/services, `PascalCase.tsx` for components
- **API fields:** `camelCase` (per API spec convention)
- **Enum values:** `UPPER_SNAKE_CASE` (per database schema convention: `MARKETPLACE_PENDING`, `ASSET_TYPE_ACTOR`)

### Database
- **Tables:** plural, `snake_case` (`asset_outputs`, `marketplace_listings`)
- **Columns:** `snake_case` (`workspace_id`, `deleted_at`, `client_id`)
- **Enum types:** `UPPER_SNAKE_CASE` values (`PENDING`, `SUCCESS`, `FAILED`)
- **Foreign keys:** `<table>_id` (`account_id`, `asset_id`, `workspace_id`)
- **Indexes:** `idx_<table>_<column>` or let PostgreSQL auto-name

### API
- **Endpoints:** plural nouns (`/api/actors`, `/api/looks`)
- **Route params:** `:id` (UUID)
- **Query params:** `camelCase` (`page`, `pageSize`, `sortBy`, `sortOrder`, `sharedWithMe`)
- **Request/response body fields:** `camelCase`
- **Error codes:** `UPPER_SNAKE_CASE` (`VALIDATION_ERROR`, `NOT_FOUND`)

### CSS / Tailwind
- **Custom class names:** `kebab-case` (if not using utility-only approach)
- **CSS custom properties:** `--kebab-case` (`--color-primary`, `--spacing-unit`)

## Directory Structure

```
server/                          # Backend (backend-dev domain)
  src/
    db/
      migrations/                # node-pg-migrations
      repositories/              # asset-repo, look-repo, fashion-item-repo, commission-repo, wallet-repo, etc.
      pool.ts                    # PostgreSQL connection pool
      query-helper.ts            # Workspace-scoped query builder
    middleware/
      requireSession.ts          # Session auth → req.account + req.workspace
      requireApiKey.ts           # API key auth → req.account + req.workspace
      requireWorkspace.ts        # Workspace resolution + admin bypass
      requireRole.ts             # Role-based access control
    routes/
      auth.ts                    # POST /register, /login, /logout, GET /me
      actors.ts                  # CRUD + generate + regenerate + character-sheet
      looks.ts                   # CRUD + select output
      fashion-items.ts           # CRUD + select output
      commissions.ts             # CRUD + assign + status transitions
      marketplace.ts             # Browse, purchase, submit, manage
      admin/
        marketplace.ts           # Submissions review, listings settings
        models.ts                # Model CRUD
        prompts.ts               # System prompt CRUD
        taxonomy.ts              # Taxonomy CRUD
        commission-forms.ts      # Form template CRUD
      wallet.ts                  # Balance, top-up, transactions, stripe-webhook
      workflows.ts               # Agent workflow start/cancel
      notifications.ts           # List, mark read
      sharing.ts                 # Asset permissions
      upload.ts                  # Image upload
      generation-jobs.ts         # Poll generation status
    services/
      fal-service.ts             # fal.ai client (abstracted)
      generation-service.ts      # Generation orchestration + versioning
      actor-service.ts           # Actor business logic
      look-service.ts            # Look business logic
      fashion-item-service.ts    # Fashion item business logic
      commission-service.ts      # Commission workflow logic
      wallet-service.ts          # Credit deduction + balance checks
      stripe-service.ts          # Checkout session + webhook handling
      email-service.ts           # Resend email sending
      notification-service.ts    # In-app + email notification dispatch
      marketplace-service.ts     # Submission, approval, purchase, duplication
      workflow-service.ts        # Agent workflow orchestration
      storage/
        types.ts                 # StorageProvider interface
        local-storage.ts         # Local disk implementation
    workers/
      generation-worker.ts       # Polls fal.ai for PENDING outputs
      workflow-worker.ts         # Executes agent workflow steps
    server.ts                    # Express app entry

client/                          # Frontend (frontend-dev domain)
  src/
    components/
      AppShell.tsx               # Sidebar + TopBar + main content
      Sidebar.tsx                # Role-based navigation
      TopBar.tsx                 # Logo, workspace, notifications, avatar
      PageHeader.tsx             # Page title + actions
      EmptyState.tsx             # Illustration + message + action
      LoadingState.tsx           # Skeleton loaders
      ErrorState.tsx             # Error + retry
      ConfirmDialog.tsx          # Destructive action confirmation
      StatusBadge.tsx            # Colored status badges
      GenerationCard.tsx         # PENDING/SUCCESS/FAILED states
      AssetCard.tsx              # Thumbnail + name + tags + hover actions
      FilterPanel.tsx            # Collapsible filter sidebar
      Pagination.tsx             # Page navigation
      Toast.tsx                  # Notification toasts
      NotificationDropdown.tsx   # Notification center
      ModelSelector.tsx          # Model dropdown (Artist only)
      SettingsSlider.tsx         # Generation settings slider
      TaxonomyForm.tsx           # Dynamic form from taxonomy entries
      ImageUpload.tsx            # Drag-and-drop upload
      ImageGrid.tsx              # Selectable image grid
      MarketplaceCard.tsx        # Listing card with buy button
      PurchaseDialog.tsx         # Purchase confirmation
      Stepper.tsx                # Horizontal step indicator
      WalletBalance.tsx          # Balance + top-up button
      DataTable.tsx              # Generic sortable/filterable table
    pages/
      Dashboard.tsx              # Quick actions + recent activity
      actors/
        ActorLibrary.tsx         # Actor grid + filters
        ActorDesigner.tsx        # 3-stage creation wizard
        ActorPage.tsx            # Full actor view + all outputs
      looks/
        LookLibrary.tsx          # Look grid + filters
        LookDesigner.tsx         # 3 input methods → select → save
        LookDetail.tsx           # Look view page
      fashion-items/
        FashionItemLibrary.tsx   # Item grid + filters
        FashionItemCreator.tsx   # 2 input methods → select → save
        FashionItemDetail.tsx    # Item view page
      marketplace/
        Marketplace.tsx          # Client storefront
        MarketplaceDetail.tsx    # Listing detail + purchase
      commissions/
        CommissionList.tsx       # Role-filtered list
        CommissionDetail.tsx     # Brief + submitted work + approve/changes
        NewCommission.tsx        # Dynamic form
      admin/
        Submissions.tsx          # Review queue
        ListingsSettings.tsx     # Package configuration
        Settings.tsx             # Users, Models, Prompts, Taxonomy, Forms
    hooks/
      useAuth.ts                 # Auth state + login/logout
      useGeneration.ts           # Generation polling
    services/
      api.ts                     # Axios client (session cookie auth)
    store/
      ui-store.ts                # Zustand: sidebar, modals, toasts
    lib/
      query-client.ts            # React Query client + query key patterns
    types/                       # Frontend-specific types
    App.tsx
    main.tsx

packages/types/                  # Shared TypeScript types (both domains)
  src/
    asset.ts                     # AssetType, Asset, AssetOutput, etc.
    commission.ts                # Commission, CommissionStatus, etc.
    marketplace.ts               # MarketplaceListing, ListingType, etc.
    workspace.ts                 # Workspace, Account, Role, etc.
    wallet.ts                    # Wallet, LedgerEntry, etc.
    notification.ts              # Notification, NotificationType, etc.
    api.ts                       # API request/response types

specs/
  spec.md                        # System spec
  database-schema.md             # 16 tables schema
  api.md                         # ~65 REST endpoints
  ui.md                          # Pages + components
  implementation-plan.md         # 28 tasks, 5 phases

docs/
  decisions/                     # Architecture Decision Records (ADRs)
    001-tech-stack.md
    002-database-choice.md
    003-auth-strategy.md
    004-workspace-isolation.md
    005-async-generation.md
    006-ownership-model.md
    007-marketplace-freeze.md
    008-versioning-strategy.md
  CHANGELOG.md
```

## Key Invariants

- **Workspace isolation**: ALL queries filter by `workspace_id`. Admin bypass is explicit, not implicit.
- **Soft delete**: Assets use `deleted_at` timestamp. All queries filter `deleted_at IS NULL` by default. Only Admin can hard-delete.
- **client_id is single source of truth**: NULL = Studio owns, set = Client owns. Only set via marketplace purchase or commission premium unlock.
- **Async generation**: All image generation returns 202 immediately. Background worker polls fal.ai. Store full `generation_params` for reproducibility.
- **Versioning**: Regenerate archives old output to `asset_output_versions`, increments version, marks downstream obsolete.
- **Marketplace freeze**: When `marketplace_status = APPROVED`, asset is frozen — no edit/regenerate/delete. Can view and duplicate.
- **Save is explicit**: Nothing enters the library without deliberate save action.
- **Test-first**: No code without a failing test first.

## Tech Stack

- **Backend**: Node.js + Express + TypeScript ESM, PostgreSQL (pg), fal.ai, Stripe, Resend
- **Frontend**: React 18 + TypeScript, React Router v6, TanStack Query v5, Zustand, Tailwind CSS, shadcn/ui
- **Testing**: Vitest (both server and client)
- **Validation**: Zod at API boundary

## Test Commands

- `cd server && npm run test` — full backend suite
- `cd server && npx vitest run tests/unit/auth.test.ts` — single file
- `cd client && npm run test` — full frontend suite
- `cd server && npm run typecheck` — TypeScript check
- `cd client && npm run typecheck` — TypeScript check
- `cd server && npm run lint` — ESLint
- `cd client && npm run lint` — ESLint

## Git

- Commit after each plan task step
- Use conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`
- Never commit broken tests
- Never commit secrets

## Agent Rules

### Rule 1 — Think Before Coding
State assumptions explicitly. If uncertain, ask rather than guess.
Present multiple interpretations when ambiguity exists.
Push back when a simpler approach exists.
Stop when confused. Name what's unclear.

### Rule 2 — Simplicity First
Minimum code that solves the problem. Nothing speculative.
No features beyond what was asked. No abstractions for single-use code.
Test: would a senior engineer say this is overcomplicated? If yes, simplify.

### Rule 3 — Surgical Changes
Touch only what you must. Clean up only your own mess.
Don't "improve" adjacent code, comments, or formatting.
Don't refactor what isn't broken. Match existing style.

### Rule 4 — Goal-Driven Execution
Define success criteria. Loop until verified.
Don't follow steps. Define success and iterate.
Strong success criteria let you loop independently.

### Rule 5 — Use the model only for judgment calls
Use me for: classification, drafting, summarization, extraction.
Do NOT use me for: routing, retries, deterministic transforms.
If code can answer, code answers.

### Rule 6 — Token budgets are not advisory
Per-task: 40,000 tokens. Per-session: 150,000 tokens.
If approaching budget, summarize and start fresh.
Surface the breach. Do not silently overrun.

### Rule 7 — Surface conflicts, don't average them
If two patterns contradict, pick one (more recent / more tested).
Explain why. Flag the other for cleanup.
Don't blend conflicting patterns.

### Rule 8 — Read before you write
Before adding code, read exports, immediate callers, shared utilities.
"Looks orthogonal" is dangerous. If unsure why code is structured a way, ask.

### Rule 9 — Tests verify intent, not just behavior
Tests must encode WHY behavior matters, not just WHAT it does.
A test that can't fail when business logic changes is wrong.

### Rule 10 — Checkpoint after every significant step
Summarize what was done, what's verified, what's left.
Don't continue from a state you can't describe back.
If you lose track, stop and restate.

### Rule 11 — Match the codebase's conventions, even if you disagree
Conformance > taste inside the codebase.
If you genuinely think a convention is harmful, surface it. Don't fork silently.

### Rule 12 — Fail loud
"Completed" is wrong if anything was skipped silently.
"Tests pass" is wrong if any were skipped.
Default to surfacing uncertainty, not hiding it.
