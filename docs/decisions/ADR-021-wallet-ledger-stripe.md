# ADR-021: Wallet, Ledger, and Stripe Integration

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 needs a monetization layer so that:

1. Clients pay for AI image generation (0.05 credits per image)
2. Clients can top up their balance via Stripe
3. All financial transactions are auditable via an immutable ledger
4. Generation is blocked when balance is insufficient (422 error)

The system uses a double-entry wallet model: a `wallets` table stores the current balance, and a `ledger` table stores every transaction. Stripe Checkout handles real-money payments; the webhook credits the wallet.

## Decision

### Wallet Model

- **One wallet per account per workspace** — unique on `(workspace_id, account_id)`
- `balance_credits` is a `DECIMAL(12,4)` updated via `UPDATE ... RETURNING *`
- Wallets are auto-created on first access (`allowCreate: true`)
- All monetary values use 4 decimal places to avoid floating-point drift

### Ledger Design

- **Immutable append-only log** — entries are never updated or deleted
- Four entry types: `CHARGE` (generation), `TOP_UP` (Stripe), `ESCROW_HOLD`, `ESCROW_REFUND`
- Negative amounts = debits, positive amounts = credits
- `workflow_id` links to the originating workflow (for CHARGE entries)
- `api_key_id` tracks which API key was used (for programmatic access)
- Idempotency for Stripe webhooks: checked via `workflow_id` matching the Stripe session ID

### Credit Deduction Flow

Generation service calls `reserveCreditsForGeneration` before calling fal.ai:

1. Find or create wallet
2. Check balance >= cost (0.05 credits per image)
3. If insufficient, throw `InsufficientCreditsError` → 422 response
4. Deduct cost from balance
5. Create `CHARGE` ledger entry (negative amount)

This is called in three places: `generateActorOutput`, `regenerateActorOutput`, `generateCharacterSheet`.

### Stripe Integration (Stub)

The Stripe integration is architected but not fully implemented:

- `stripe-service.ts` exports `createCheckoutSession` and `verifyWebhookEvent`
- Both throw when `STRIPE_SECRET_KEY` is not configured (503 for checkout, `StripeWebhookNotFoundError` for webhook)
- `wallet-service.ts` `createStripeTopUp` returns 501 (not implemented) — the route handler catches this and returns the correct status
- When implemented, the flow will be:
  1. `POST /api/wallet/top-up` → creates Stripe Checkout Session → returns session URL
  2. Stripe redirects to success/cancel URLs
  3. Stripe sends `checkout.session.completed` webhook
  4. `POST /api/wallet/stripe-webhook` verifies signature, credits wallet via `applyStripeTopUp`

### Error Handling

- `InsufficientCreditsError` → 422 with message "Insufficient credits. Balance: X, Required: Y"
- `StripeWebhookNotFoundError` → 500 (internal, not exposed to client)
- Stripe not configured → 503 for checkout, 501 for top-up (current stub)
- All errors use the standard `{ error: { code, message } }` format

### Module Structure

```
server/src/
  routes/wallet.ts              # GET /, POST /top-up, GET /transactions, POST /stripe-webhook
  services/wallet-service.ts    # Balance, top-up, webhook handling, credit reservation
  services/stripe-service.ts    # Stripe Checkout + webhook verification (stub)
  services/generation-integration.ts  # Re-exports reserveCreditsForGeneration
  db/repositories/wallet-repo.ts      # findWallet, createLedgerEntry, updateWalletBalance, listLedgerEntries, reserveCreditsForGeneration
  errors/stripe-error.ts        # StripeWebhookNotFoundError
```

### Test Strategy

- `tests/wallet.test.ts` — 7 tests covering routes and repo (balance, top-up 501, validation, transactions, credit reservation, insufficient credits)
- `tests/generation.test.ts` — 24 tests, 5 of which now include wallet mock seeding (`seedWalletCreditMocks`) to satisfy the credit deduction calls added in T14
- All 313 tests pass

## Alternatives Considered

### Single wallet table (no ledger)

- Pros: Simpler, fewer tables
- Cons: No audit trail, can't reconstruct balance history, can't detect discrepancies
- Rejected: Financial systems require an immutable audit log

### Database transactions for credit deduction

- Pros: Atomic wallet update + ledger insert
- Cons: Current architecture doesn't use transactions; would require connection-level `BEGIN/COMMIT`
- Rejected: Acceptable risk for MVP; the wallet balance is derived from the ledger and can be rebuilt

### Stripe SDK integration in wallet-service

- Pros: Direct, fewer layers
- Cons: Harder to test, mixes concerns
- Rejected: `stripe-service.ts` is the provider adapter (same pattern as `fal-service.ts`)

### Separate escrow wallet

- Pros: Clean separation of held vs available funds
- Cons: Adds complexity; escrow types are not needed for MVP
- Rejected: `ESCROW_HOLD` and `ESCROW_REFUND` types are defined in the schema for future use but not yet implemented

## Consequences

- Every generation call now requires wallet access — if the wallet query fails, generation fails
- The `seedWalletCreditMocks` helper is needed in all generation tests that exercise the happy path
- Stripe integration is architected but requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` env vars to activate
- The `createStripeTopUp` function in `wallet-service.ts` currently throws 501 — when Stripe is configured, it should delegate to `stripeService.createCheckoutSession`
- Ledger entries use `workflow_id` for idempotency — Stripe session IDs are stored there to prevent double-credits
- The `InsufficientCreditsError` class lives in `wallet-repo.ts` (not `errors/`) because it's a domain error thrown by the repository layer
