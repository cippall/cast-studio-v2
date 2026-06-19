# ADR-003: Split admin route file into domain-specific modules

## Status

Accepted

## Date

2026-06-19

## Context

The `server/src/routes/admin/admin.ts` file had grown to 617 lines, violating the AGENTS.md rule of max 200 lines per file. It contained fal.ai key management, model CRUD, system prompts, taxonomy CRUD, and commission forms — all in a single file with manual `if (!field)` validation instead of Zod schemas.

## Decision

Split `admin.ts` into 7 focused files under `server/src/routes/admin/`:

```
admin.ts               (35 lines — router setup + auth middleware)
validation.ts          (83 lines — Zod schemas for all endpoints)
fal-key-routes.ts      (196 lines — fal.ai key save/test/disconnect/status)
fal-models-routes.ts   (55 lines — fal.ai model browsing)
model-routes.ts        (152 lines — AI model CRUD)
model-schema-routes.ts (78 lines — model parameter schema from fal.ai)
prompt-routes.ts       (53 lines — system prompts placeholder stubs)
taxonomy-routes.ts     (153 lines — taxonomy CRUD)
```

Each sub-router enforces admin role via its own `router.use()` middleware, replacing the per-handler `requireAdmin()` calls. All POST/PATCH endpoints now use Zod validation with consistent error format (`{ error: { code, message, details } }`).

## Alternatives Considered

### Single file with Zod (no split)

- Pros: Fewer files, simpler imports
- Cons: Still violates 200-line rule, harder to navigate
- Rejected: File size rule exists for readability

### Service layer extraction

- Pros: Thinner route files, business logic separated
- Cons: Over-engineering for current codebase size
- Rejected: Routes are thin already; splitting by domain is sufficient

## Consequences

- All admin endpoints now use Zod validation (previously manual checks)
- Error format is consistent across all admin endpoints
- Each file is under 200 lines, compliant with AGENTS.md
- All 508 existing tests pass without modification
- `npx tsc --noEmit` passes clean
