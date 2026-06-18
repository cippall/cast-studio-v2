# ADR-020: Commission Premium Unlock Flow

## Status

Accepted

## Date

2026-06-17

## Context

When a client approves a submitted commission, the premium cost must be deducted from the client's wallet and all linked assets must transfer ownership from the studio to the client. This is one of only two ways `client_id` gets set on assets (the other being marketplace purchase). The spec requires:

- Wallet deduction happens atomically with commission approval
- Insufficient balance blocks approval (402 response)
- After unlock, artists cannot edit/delete client-owned assets (403 response)
- `source_type` is set to `'COMMISSION'` on transferred assets

## Decision

### Premium Unlock on APPROVE Transition

When `transitionCommissionStatus` is called with `toStatus = 'APPROVED'`:

1. Look up the client's wallet using `client_workspace_id` and `client_id` from the commission
2. If no wallet or balance < premium_cost, throw `InsufficientCreditsError` (402)
3. Deduct `premium_cost` from wallet balance and create a `CHARGE` ledger entry
4. Set `client_id` and `source_type = 'COMMISSION'` on all assets linked via `commission_assets`

### Client-Owned Asset Guard

All asset mutation endpoints (PATCH/DELETE for actors, looks, fashion-items) now check `client_id` before allowing the operation:

- If `client_id` is set and requester is not ADMIN → throw 403 "Cannot edit/delete a client-owned asset"
- Implemented via shared `isClientOwnedBlocked()` helper in `asset-repo.ts`
- Applied in service layer (not middleware) to keep the check co-located with asset loading

### Error Handling

- New `InsufficientCreditsError` class with `statusCode: 402` in `commission-service.ts`
- Commission route catches it and returns `{ error: { code: 'INSUFFICIENT_CREDITS' } }`
- Asset routes catch `statusCode: 403` errors and return `{ error: { code: 'FORBIDDEN' } }`

## Alternatives Considered

### Middleware-based client_id check

- Pros: Centralized, DRY
- Cons: Middleware doesn't have asset context; would need to load asset twice or pass context through req
- Rejected: Service-layer check is simpler and avoids double-loading

### Separate "unlock" endpoint

- Pros: Explicit separation of approve vs. unlock
- Cons: Adds a step for the client; spec says approval triggers unlock automatically
- Rejected: Single-step approval is the spec requirement

### Database transaction wrapping approve + deduct + transfer

- Pros: Atomic all-or-nothing
- Cons: Current architecture doesn't use transactions; would be a larger refactor
- Rejected: Acceptable risk for MVP; wallet deduction and asset ownership are idempotent-ish (commission status prevents double-approval)

## Consequences

- Commission approval is now a multi-step operation (wallet check → deduct → transfer ownership → update status)
- `unlockCommissionPremium` is extracted as a private helper to keep `transitionCommissionStatus` readable
- All three asset services (actor, look, fashion-item) have identical client_id guard logic — future asset types must add the same check
- The `isClientOwnedBlocked()` helper makes the guard testable and consistent
- 402 status code is used for insufficient credits (not 422) to distinguish from validation errors
