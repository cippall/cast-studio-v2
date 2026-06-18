# ADR-001: Tech Stack Selection

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 is a greenfield multi-tenant web application requiring: backend API, frontend UI, database, image generation, payments, and email. Need to choose a cohesive tech stack that a single developer (or two-agent team) can build and maintain efficiently.

## Decision

| Layer            | Choice                                          |
| ---------------- | ----------------------------------------------- |
| Backend          | Node.js + Express + TypeScript ESM              |
| Frontend         | React 18 + TypeScript                           |
| Database         | PostgreSQL                                      |
| Image Generation | fal.ai API                                      |
| Payments         | Stripe (Checkout + Webhooks)                    |
| Email            | Resend                                          |
| Validation       | Zod                                             |
| Testing          | Vitest                                          |
| Styling          | Tailwind CSS + shadcn/ui                        |
| Server State     | TanStack Query v5                               |
| UI State         | Zustand                                         |
| Routing          | React Router v6                                 |
| Forms            | React Hook Form + Zod                           |
| Migrations       | node-pg-migrate                                 |
| Auth             | Session cookies (web) + API keys (programmatic) |

## Alternatives Considered

### Next.js (full-stack)

- Pros: Unified framework, SSR, API routes built-in
- Cons: Heavier, more opinionated, harder to separate backend/frontend concerns for multi-agent development
- Rejected: Separate Express + React gives cleaner module boundaries for parallel agent work

### tRPC instead of REST

- Pros: End-to-end type safety, no manual API client
- Cons: Tighter coupling, harder for external API consumers (Agents use REST via API keys)
- Rejected: REST is the spec, required for Agent API key access

### Prisma instead of raw pg

- Pros: Type-safe queries, auto-generated client, migrations
- Cons: Heavy abstraction, harder to optimize complex queries, migration control less transparent
- Rejected: Raw `pg` driver + node-pg-migrate gives full control over SQL and performance

### SendGrid instead of Resend

- Pros: More mature, larger ecosystem
- Cons: Paid tiers only for production volume, more complex setup
- Rejected: Resend has a generous free tier (3,000/month) and simpler API

### AWS S3 for image storage (now)

- Pros: Durable, scalable
- Cons: Adds infrastructure complexity, cost for small scale
- Rejected: fal.ai URLs as primary + local backup is sufficient for v1. S3 migration path is abstracted behind StorageProvider interface.

## Consequences

- Monorepo structure: `server/`, `client/`, `packages/types/`
- Two-agent parallelization: backend-dev and frontend-dev can work simultaneously after Phase 1
- All API contracts defined in `specs/api.md` — both agents must conform to this contract
- Stripe integration requires webhook endpoint (must be publicly accessible in production)
- Resend requires domain verification for email delivery
