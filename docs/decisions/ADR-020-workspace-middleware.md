# ADR-014: Workspace Middleware + Endpoints Design

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 requires tenant isolation via workspaces. Every entity in the system belongs to a workspace. The auth middleware (`requireSession` and `requireApiKey`) already loads `req.account` and `req.workspace`, but a reusable middleware is needed to:

1. Guarantee workspace context is available on routes that need it
2. Provide a clear point for admin-bypass logic
3. Work with both session-based and API-key-based auth

Additionally, Admin-only CRUD endpoints for workspaces were needed to manage tenant containers.

## Decision

### requireWorkspace Middleware

- Created as a standalone middleware in `server/src/middleware/requireWorkspace.ts`
- Checks `req.account` is set (401 if not)
- If `req.workspace` is already loaded (by prior middleware like `requireSession`), skips the DB query
- Otherwise, queries the `workspaces` table by `req.account.workspace_id`
- Returns 404 if workspace not found, 500 on DB error
- Designed to stack after `requireSession` or `requireApiKey`

### requireAdmin Helper

- Inline helper in `server/src/routes/workspaces.ts` (`requireAdmin(req, res): boolean`)
- Checks `req.account?.role === 'ADMIN'`, returns 403 if not
- Used by every workspace endpoint for authorization
- Pattern can be extracted to shared utility when more admin-only modules exist

### Workspace CRUD Endpoints

All endpoints require `requireSession` + `requireAdmin`:

- `GET /api/workspaces` — paginated list (page, pageSize query params, defaults page=1, pageSize=20)
- `POST /api/workspaces` — create with Zod validation (name, slug, workspace_type default STUDIO)
- `GET /api/workspaces/:id` — single workspace
- `PATCH /api/workspaces/:id` — partial update (name, slug, workspace_type)
- `DELETE /api/workspaces/:id` — hard delete (no soft delete on workspaces table; cascades to all child data)

### Validation

- Zod schemas matching the project pattern from auth.ts
- Slug regex: `/^[a-z0-9-]+$/` (lowercase letters, numbers, hyphens)
- Slug uniqueness enforced at DB level (unique constraint) + application check with clear 409 error
- Workspace type enum: `['STUDIO', 'CLIENT']`

### Admin Bypass

- Admin accounts (role === 'ADMIN') see all workspaces via the list endpoint
- Workspace-scoped data queries in the rest of the app use the `queryTable` helper which supports `adminBypass: true`
- No workspace filter is applied to admin queries

## Alternatives Considered

### RequireWorkspace as a wrapper around requireSession

- Pros: Simpler API, fewer middleware layers
- Cons: Not reusable with API-key auth (Task 5)
- Rejected: `requireWorkspace` is designed to compose with any auth middleware, not replace it

### Soft delete on workspaces

- Pros: Consistent with other entity types (assets, accounts)
- Cons: Workspace deletion is a rare, intentional admin action. Child data cascade is expected. Soft delete adds complexity without benefit for this administrative operation.
- Rejected: Workspaces use hard delete with CASCADE.

### Separate repository layer for workspaces

- Pros: Consistent with future modules
- Cons: Workspace CRUD is simple DML with no business logic (no generation, no versioning). Direct SQL in routes is appropriate for this case.
- Deferred: Move to repository pattern when workspace logic becomes non-trivial.

## Consequences

- All admin-only workspace management is centralized in one route file
- `requireWorkspace` middleware is reusable across session and API key auth paths
- 32 tests verify auth guards (401/403), validation (422), conflict (409), and success paths (200/201)
- Hard delete on workspace is destructive — admin-only guard is the primary protection
- Workspace isolation for tenant data continues to use the `queryTable` helper
