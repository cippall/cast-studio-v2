# ADR-017: Asset Sharing Model

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio requires a sharing mechanism for assets (Actors, Looks, Fashion Items) that allows:

1. **Artists** to share their assets with specific clients for review
2. **Hard cutoff revocation** — when sharing is revoked, the grantee immediately loses access
3. **Scope enforcement** — three visibility levels defined in the spec:
   - **Private** — only the creating Artist + Admins can see
   - **Studio Public** — all Artists in the same Studio Workspace can see
   - **Client Shared** — specific Clients can see (via explicit grant)

The database schema already includes an `asset_permissions` table with `asset_id`, `grantee_id`, `granted_at`, and `revoked_at` columns.

## Decision

### Architecture

Three-layer pattern matching the existing asset system:

- **Repository** (`asset-repo.ts`) — raw SQL operations on `asset_permissions` table
- **Service** (`sharing-service.ts`) — business logic (who can share, access validation)
- **Routes** (`sharing.ts`) — HTTP endpoints with Zod validation

### Sharing Endpoints

- `POST /api/assets/:assetId/share` — Share an asset with a specific client. Only the asset creator or an admin can share. Cannot share client-owned or marketplace-frozen assets.
- `GET /api/assets/:assetId/permissions` — List active permissions for an asset. Only the asset creator or admin can view.
- `DELETE /api/permissions/:permissionId` — Revoke a permission. Hard cutoff via `revoked_at = NOW()`. Only the asset creator or admin can revoke.

### Access Enforcement

- **List** (`GET /api/actors`, etc.) — All Artists in the same workspace see all non-deleted assets (Studio Public default). Clients see their own plus assets shared via `asset_permissions`. The `shared_with_me=true` query parameter restricts the list to only shared assets.
- **Single Get** (`GET /api/actors/:id`, etc.) — Access is checked via `checkAssetAccess()` which returns true if the account is an Admin, the creator, or has an active `asset_permissions` record.

### `shared_with_me` Filter Implementation

Rather than adding a column to the `assets` table, the filter works by joining with `asset_permissions`:

```sql
INNER JOIN asset_permissions ap ON ap.asset_id = a.id
WHERE ap.grantee_id = ? AND ap.revoked_at IS NULL
```

This keeps the sharing layer completely external to the asset data model.

### Revocation Semantics

Revocation is a **hard cutoff** — setting `revoked_at = NOW()` makes the permission immediately inactive. No soft transition period. All queries filter by `revoked_at IS NULL`.

## Alternatives Considered

### Visibility Column on Assets Table

- **Pros**: Simple, single-query filtering for "Private" vs "Studio Public"
- **Cons**: Rigid, hard to extend for client-specific sharing without a join table anyway
- **Rejected**: The spec already has the `asset_permissions` table, which is more flexible

### Soft Delete with Deleted At

- **Pros**: Consistent with asset soft-delete pattern
- **Cons**: The spec explicitly says "Hard Cutoff" for sharing revocation
- **Rejected**: We use `revoked_at` with immediate effect, as specified

### Shared With Me as Query Params on Client Side

- **Pros**: No server-side changes needed for list endpoints
- **Cons**: Client-side filtering is insecure — data already leaked
- **Rejected**: The `shared_with_me` filter must be server-side for security

## Consequences

- Sharing is fully external to the asset records — no schema changes to `assets` table needed
- Revocation is immediate and irreversible (short of creating a new permission)
- The `shared_with_me` filter requires a JOIN with `asset_permissions`, which adds minimal overhead for the added visibility control
- "Private" assets are not explicitly stored as a scope — only enforced via access check. Studio Public is the default within workspace. Client Shared is explicit via permissions.
- `findAssetById` with `includeDeleted=false` already filters out deleted assets, so separate `deleted_at` checks in the sharing service are redundant and have been removed.

## Files Changed

- `server/src/db/repositories/asset-repo.ts` — Added `createAssetPermission`, `findAssetPermission`, `listAssetPermissions`, `revokeAssetPermission`, `checkAssetAccess` functions; updated `listAssets` to support `sharedWithMeAccountId`
- `server/src/services/sharing-service.ts` — New service with `shareAsset`, `getAssetPermissions`, `revokePermission`
- `server/src/routes/sharing.ts` — New routes for share, list permissions, revoke
- `server/src/routes/actors.ts` — Added `shared_with_me` query parameter support, access check on GET /:id
- `server/src/services/actor-service.ts` — Pass `sharedWithMeAccountId` through to asset-repo
- `server/src/server.ts` — Registered sharing routes at `/api`
- `server/tests/sharing.test.ts` — 16 new tests covering all sharing endpoints
