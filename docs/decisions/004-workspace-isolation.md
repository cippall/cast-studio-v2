# ADR-004: Workspace Isolation Model

## Status
Accepted

## Date
2026-06-17

## Context
Cast Studio v2 is multi-tenant. Data must be strictly isolated between workspaces. The spec defines a two-workspace model: one Studio Workspace (Artists + Admins) and multiple Client Workspaces (one per client). Admin sees everything.

## Decision

### Workspace Types
- `STUDIO` — where Artists and Admins work. Contains full creation tools, asset library, model management.
- `CLIENT` — where Clients operate. Contains shared assets (filtered view), commission submission, wallet management.
- One Client = one Client Workspace. One Studio = one Studio Workspace.

### Isolation Mechanism
- Every table has `workspace_id` UUID FK → `workspaces.id`
- Query helper automatically appends `WHERE workspace_id = $1` to every query
- Admin accounts bypass workspace filter (see all workspaces)
- No cross-workspace queries except: sharing (asset_permissions), commissions (client→studio), marketplace (studio→client)

### Cross-Workspace Connections
1. **Sharing**: `asset_permissions` table grants specific accounts access to specific assets across workspaces
2. **Commissions**: `commissions` table has both `client_workspace_id` and `studio_workspace_id`
3. **Marketplace**: Purchase creates a duplicate asset in the buyer's workspace (new `workspace_id`, same image URLs)

## Alternatives Considered

### Row-Level Security (RLS) in PostgreSQL
- Pros: Database-enforced isolation, can't be bypassed by buggy queries
- Cons: Harder to test, more complex migration, admin bypass is tricky
- Rejected: Application-level isolation via query helper is simpler and testable. May add RLS later as defense-in-depth.

### Schema-per-tenant
- Pros: Complete isolation at schema level
- Cons: Migration complexity, connection pooling issues, hard to query across tenants (admin view)
- Rejected: Shared schema with workspace_id filter is the right balance for this scale.

### Separate databases per workspace
- Pros: Maximum isolation
- Cons: Operational nightmare, can't do cross-workspace operations
- Rejected: Overkill for the current scale.

## Consequences
- Query helper is the single enforcement point — if it's wrong, isolation breaks
- Integration test required: verify cross-workspace data leak returns empty
- Admin queries must explicitly opt out of workspace filter (`adminBypass: true`)
- `asset_permissions` is the only cross-workspace access table — audit it carefully
- Commission and marketplace flows are the only legitimate cross-workspace operations
