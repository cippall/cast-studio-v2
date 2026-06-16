# ADR-006: Asset Ownership Model — client_id as Single Source of Truth

## Status
Accepted

## Date
2026-06-17

## Context
Assets can be owned by the Studio or by a Client. The ownership model must be simple, unambiguous, and enforceable at the API level. The spec states: "`client_id` is the single source of truth. No exceptions."

## Decision

### Ownership Rule
- `assets.client_id = NULL` → Studio owns the asset. Artists have full control (edit, regenerate, share, use).
- `assets.client_id = <uuid>` → Client owns the asset. Artists can view only. Client has full control.

### How client_id Gets Set (only two ways)
1. **Marketplace Purchase**: Client buys from marketplace → duplicate asset created in Client's workspace with `client_id` set, `source_type = 'MARKETPLACE_PURCHASE'`
2. **Commission Premium Unlock**: Client approves commission → `client_id` set on linked assets, `source_type = 'COMMISSION'`

### Source Types
| source_type | Meaning |
|---|---|
| `ORIGINAL` | Created from scratch, no source |
| `MARKETPLACE_PURCHASE` | Bought from marketplace |
| `COMMISSION` | Created via commission and premium unlocked |
| `DUPLICATE` | Duplicated from another asset (Artist only) |

### Permission Enforcement
- API middleware checks `client_id` before allowing edit/regenerate/delete operations
- If `client_id` is set and requester is not the owner (or Admin) → 403
- Artist can duplicate any asset they own or marketplace-frozen asset (creates new editable copy with `source_type = 'DUPLICATE'`)

## Alternatives Considered

### Separate ownership table
- Pros: More flexible, can track ownership history
- Cons: More complex, joins required for every asset query
- Rejected: Single `client_id` column is simpler and covers all cases. History is tracked via `source_type` + `source_asset_id`.

### Role-based permissions table for ownership
- Pros: Fine-grained control
- Cons: Over-engineered for binary ownership (Studio vs Client)
- Rejected: `client_id` NULL/set is the simplest model that works.

### Transfer API endpoint
- Pros: Flexible ownership transfers
- Cons: Adds attack surface, spec doesn't require it
- Rejected: Only marketplace purchase and commission unlock set `client_id`. No manual transfer.

## Consequences
- Every asset mutation endpoint must check `client_id` before proceeding
- `source_asset_id` + `source_type` provide full provenance chain
- Duplication creates new asset with new ID but same image URLs (no re-generation)
- Commission approval flow must atomically: deduct wallet, set `client_id`, notify artist
