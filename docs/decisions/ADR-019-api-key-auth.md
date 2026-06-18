# ADR-013: API Key Authentication Design

**Status:** Accepted
**Date:** 2026-06-17
**Applies to:** T5 — API Key Auth (Phase 1, Task 5)

## Context

Cast Studio v2 needs programmatic API access for agent workflows and third-party integrations. The existing session-based auth (httpOnly cookies) works for browser users but doesn't support non-interactive clients. API keys must be:

- Secure (not leakable from the database)
- Revocable (deactivate without deleting)
- Identifiable (users can name and recognize their keys)
- Single-use-on-creation (full key shown only once)

## Decision

### Key Format

Keys use the format `cs_live_<64_hex_chars>` (32 random bytes, hex-encoded). The `cs_live_` prefix visually identifies Cast Studio production keys — analogous to Stripe's `sk_live_` convention. Random bytes are generated via `crypto.randomBytes(32)` (Node.js CSPRNG).

### Storage

Only the bcrypt hash of the key is stored in the `api_keys.key_hash` column. The raw key is never stored, logged, or persisted after creation. bcrypt salt rounds = 10 (standard production default, ~100ms per hash on modern hardware).

The existing `api_keys` table (created in migration 001) has a `UNIQUE` constraint on `key_hash` — bcrypt hashes are effectively unique per key+salt, so collision risk is negligible.

### Key Lookup Strategy

Because bcrypt is non-deterministic (different salt per hash), we cannot pre-hash an incoming key for indexed lookup. Instead, the `requireApiKey` middleware:

1. Loads all active keys (`SELECT * FROM api_keys WHERE is_active = true`)
2. Iterates with `bcrypt.compare(incomingKey, row.key_hash)` until finding a match
3. Falls through to 401 if no match

This is O(n) in the number of active keys. Acceptable for MVP scale (<1000 keys). Future optimization: add a `key_hint` column with the first 8 hex chars for indexed prefix lookup, reducing comparisons to ~1 per request at the cost of a schema migration.

### Key Display

- **On creation (POST):** The full raw key (`cs_live_<hex>`) is returned in the `key` field. The user must store it immediately — it will never be shown again.
- **On listing (GET):** A masked placeholder `cs_live_...xxxx` is returned. The actual bcrypt hash is never exposed to the client.
- **Field name:** The API response uses `key` (not `key_hash`) to avoid confusion with the DB column storing the bcrypt hash.

### Authorization Rules

- Only API-enabled accounts can create API keys (`is_api_able = true`). This is enforced in the POST handler.
- The `requireApiKey` middleware additionally checks that the resolved account has `is_api_able = true`. A deactivated account's keys are effectively dead even before revocation.
- The `is_api_able` flag is toggled by admins via `PATCH /api/accounts/:id`. Non-admin users can only update their own `name`.
- `last_used_at` is updated asynchronously (fire-and-forget) on each successful key use for audit visibility.

### Revocation

DELETE on an API key sets `is_active = FALSE`. The key row is preserved for audit. The WHERE clause includes `account_id = $2` to enforce ownership — a user cannot revoke another user's keys.

### Account Management

`PATCH /api/accounts/:id` handles two concerns:

- **Admin:** Can toggle `is_api_able` and update `name` on any account
- **Self-service:** A non-admin can update only their own `name`

The `is_api_able` toggle is admin-gated because it grants programmatic access which has different security implications than session-based access.

## Alternatives Considered

1. **JWT-based API keys:** Stateless, no DB lookup on each request. Rejected because JWTs are opaque to key revocation (can't revoke without a blacklist) and expose the account ID in the token payload.

2. **SHA-256 lookup hash:** Add a `key_digest` column with SHA-256 of the key for fast indexed lookup, then verify with bcrypt. Rejected as premature optimization — the schema change can be added later when key count grows.

3. **Two-part key with prefix:** Store a plaintext prefix (first 8 chars) for indexed lookup. Rejected for same reason as #2 — the brute-force bcrypt iteration is acceptable at current scale.

4. **No masking on GET:** Return the bcrypt hash as a placeholder. Rejected — exposing bcrypt hashes leaks information and confuses the API contract (the field would show a hash, not a key).

## Consequences

**Positive:**

- Keys are cryptographically secure (32 bytes CSPRNG, bcrypt storage)
- Full key exposure is limited to the creation response
- Revocation is immediate (SET is_active = FALSE)
- Key ownership is enforced at the query level
- The pattern mirrors existing session auth (requireApiKey ↔ requireSession)

**Negative:**

- O(n) bcrypt comparison on every API request — potential bottleneck at scale
- No key-prefix identification means users see masked keys that all look the same on the list endpoint
- bcrypt hash uniqueness constraint is probabilistic, not cryptographic — astronomically unlikely collision but theoretically possible
