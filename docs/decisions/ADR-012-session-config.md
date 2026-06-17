# ADR-012: Session Configuration with connect-pg-simple

## Status

Accepted

## Date

2026-06-17

## Context

Task T4 requires session-based authentication for web users. We need a session store that:

- Persists sessions across server restarts (no in-memory)
- Works with our existing PostgreSQL database (no additional infrastructure)
- Supports the express-session API
- Scales to multiple server instances (for future deployment)

## Decision

Use **express-session** with **connect-pg-simple** as the session store backend.

### Session Store

- connect-pg-simple stores sessions in a `session` table in PostgreSQL
- Table schema: `sid VARCHAR PRIMARY KEY, sess JSON, expire TIMESTAMP(6)`
- Session expiration is handled by the database (index on `expire`) and pruneSessions()

### Session Cookie

- **httpOnly:** true — prevents XSS access to session token
- **secure:** true only in production (NODE_ENV === 'production') — ensures HTTPS-only in production, allows HTTP in development
- **sameSite:** lax — allows the cookie to be sent for top-level navigations (e.g., OAuth redirects) while still providing CSRF protection
- **maxAge:** 24 hours — reasonable session lifetime for a browser-based tool

### Session Config

- **resave:** false — don't save session if unmodified (best practice)
- **saveUninitialized:** false — don't create session until something is stored (best practice)
- **secret:** from `SESSION_SECRET` env var, with a development-only fallback

### Session Data

- Store only `accountId` in the session (minimal)
- Full account + workspace are loaded on each request by the `requireSession` middleware
- This approach avoids stale account data in the session

### Password Hashing

- **bcryptjs** (pure JavaScript, no native compilation) for password hashing
- Salt rounds: 10 (good balance of security and speed)
- No passwords stored in plaintext at any point

### Zod Validation

- All auth inputs validated with Zod schemas at the API boundary
- `registerSchema`: email, password (min 8 chars), name, role (enum), workspace_id (UUID v4 compliant)
- `loginSchema`: email, password
- Zod's `.uuid()` validator in v4 checks UUID version and variant bits (v4: third group starts with 4, fourth with 8/9/a/b)

### API Design

- `POST /api/auth/register` — Admin only (requires session + ADMIN role). Creates account with hashed password.
- `POST /api/auth/login` — Public. Validates credentials, sets `session.accountId`, returns account without password_hash.
- `POST /api/auth/logout` — Session required. Destroys session, clears cookie.
- `GET /api/auth/me` — Session required. Returns current account without password_hash.

## Alternatives Considered

### Redis Session Store

- Pros: Fast, in-memory, widely used
- Cons: Adds Redis dependency to the stack
- Rejected: connect-pg-simple uses our existing PostgreSQL, no extra infrastructure

### JWT-only (no sessions)

- Pros: Stateless, works for both web and API
- Cons: Token revocation hard, XSS-prone without httpOnly cookies
- Rejected: See ADR-003. Sessions for web, API keys for programmatic access.

### In-memory session store (express-session default)

- Pros: Zero configuration
- Cons: Lost on server restart, doesn't scale to multiple instances
- Rejected: Data loss unacceptable for a production tool

### SQLite session store

- Pros: File-based, zero configuration
- Cons: Not concurrent-safe, doesn't scale
- Rejected: PostgreSQL is already in the stack

## Consequences

- Session table in PostgreSQL adds minimal storage overhead
- `requireSession` middleware performs 2 DB queries per request (account + workspace) — acceptable latency for an internal tool
- connect-pg-simple automatically prunes expired sessions
- Session secret must be configured via env var in production
- Zod v4 UUID validation is stricter than v3 — test data must use valid UUIDs with correct version/variant bits
