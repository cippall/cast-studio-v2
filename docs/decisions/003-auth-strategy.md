# ADR-003: Authentication Strategy — Dual Mode

## Status
Accepted

## Date
2026-06-17

## Context
Cast Studio v2 has two distinct access patterns: (1) Web users (Admin, Artist, Client) who log in via browser and need session persistence, (2) Programmatic agents (API-enabled Artists, Agents) who authenticate via API keys for automated workflows. A single auth mechanism doesn't serve both well.

## Decision
Dual authentication system:

### Web Users — Session Cookies
- `POST /api/auth/login` validates credentials (bcrypt), creates session in PostgreSQL session store (connect-pg-simple)
- Session cookie: httpOnly, secure, sameSite=strict
- `requireSession` middleware resolves session → account + workspace, attaches to `req`
- `POST /api/auth/logout` destroys session
- Admin creates accounts via `POST /api/auth/register` (no public registration)

### Programmatic Access — API Keys
- API-enabled accounts (Admin, API-able Artists) can generate multiple API keys
- Keys hashed with bcrypt before storage, displayed once on creation
- `Authorization: Bearer ` header on every request
- `requireApiKey` middleware resolves key → account + workspace
- Clients never get API keys (per spec)
- Each key tracks cost usage independently via `api_key_id` FK in ledger

### Common Rules
- Admin bypass: Admin accounts skip workspace filtering (see all data)
- All other accounts scoped to their workspace
- Every query filters by `workspace_id` (enforced at query helper level)

## Alternatives Considered

### JWT-only (no sessions)
- Pros: Stateless, works for both web and API
- Cons: Token revocation is hard (need blacklist), token storage in browser is XSS-prone (localStorage) or requires cookie anyway
- Rejected: Sessions are simpler for web, API keys for programmatic — cleaner separation

### OAuth 2.0 / SSO
- Pros: Industry standard, no password management
- Cons: Overkill for a casting studio tool with admin-created accounts, adds dependency on OAuth provider
- Rejected: Admin creates all accounts. No self-registration. Simple email/password is sufficient.

### API keys for everyone (including Clients)
- Pros: Uniform auth model
- Cons: Spec explicitly says Clients never get API keys. Clients pay per wallet credit, not per API call.
- Rejected: Follows spec. Clients use session auth only.

## Consequences
- Two middleware chains: `requireSession` and `requireApiKey`
- Session table in PostgreSQL (connect-pg-simple) — adds a table but no external dependency
- API key generation uses `crypto.randomUUID()` for the key, bcrypt for storage
- `requireApiKey` must handle: key not found (401), key revoked (401), account not API-able (403)
- Frontend doesn't manage tokens — browser handles session cookies automatically
