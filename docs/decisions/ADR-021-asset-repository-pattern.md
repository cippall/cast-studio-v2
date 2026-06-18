# ADR-015: Asset Repository Pattern for Workspace-Scoped CRUD

## Status

Accepted

## Date

2026-06-17

## Context

Task 7 (Asset CRUD — Actor) requires implementing create, read, update, and delete operations for the `assets` table. The `assets` table is the central entity in the system, shared by all three asset types (Actor, Look, Fashion Item) with workspace isolation, soft-delete, and taxonomy (JSONB) filtering.

Key requirements:

- All queries must filter by `workspace_id` (multi-tenant isolation)
- Soft delete via `deleted_at` timestamp — all queries default to `deleted_at IS NULL`
- Taxonomy values stored as JSONB in `prompt_recipe.identity`
- List endpoint must support dynamic taxonomy filters via query params (`?age=young&gender=female`)
- List endpoint must include `headshot_url` from a join with `asset_outputs`
- Admin accounts can bypass workspace isolation
- Actors are created via 4 entry methods: FORM, REFERENCE, TEXT, RANDOMIZE

## Decision

### 1. Three-layer architecture: Repository → Service → Routes

- **Repository** (`asset-repo.ts`): Pure SQL functions for the `assets` and `asset_outputs` tables. Handles workspace isolation, soft-delete filtering, pagination, taxonomy JSONB queries, and the headshot_url `LEFT JOIN LATERAL`. No business logic.

- **Service** (`actor-service.ts`): Actor-specific business logic — entry method handling, prompt_recipe construction, seed generation, output grouping by layout_type, response shape formatting. Composes repository functions.

- **Routes** (`actors.ts`): HTTP concerns — Zod validation, session/auth middleware, query param parsing, error responses.

### 2. JSONB taxonomy filters as column-name-based query params

Any query param on `GET /api/actors` that isn't a known pagination/filter key (`page`, `pageSize`, `sortBy`, `sortOrder`, `creator_id`, `shared_with_me`) is treated as a taxonomy filter and translated to:

```sql
WHERE a.prompt_recipe -> 'identity' ->> $key = $value
```

This keeps the API flexible and avoids coupling route code to a fixed list of taxonomy keys.

### 3. Outputs grouped by layout_type

The `GET /api/actors/:id` response groups asset_outputs by layout_type with all 5 layout types represented (null if no output exists):

- `headshot`, `fullshot`, `expressions_3x4`, `character_sheet`, `editorial`

This gives the frontend a predictable shape to render without null-checking missing keys.

### 4. Seed generation at service layer

The `generateSeed()` utility lives in the service layer (not the repository) because it's business logic — different asset types may need different seed strategies. Currently uses `Math.random()`, designed to be swappable for deterministic seeding.

## Alternatives Considered

### Direct SQL in route handlers (workspaces.ts pattern)

- **Pros**: Simpler, fewer files, consistent with existing workspace routes
- **Cons**: Would duplicate workspace isolation and soft-delete logic across Actor, Look, and Fashion Item routes
- **Rejected**: The three asset types share identical isolation/filtering requirements; extracting to a repository avoids triplication

### Single generic asset route (`/api/assets`)

- **Pros**: Less code overall
- **Cons**: Violates API spec (separate `/api/actors`, `/api/looks`, `/api/fashion-items`); makes per-type validation complex
- **Rejected**: API clarity and per-type validation outweigh code reuse

### Class-based repository

- **Pros**: Encapsulation, dependency injection for testing
- **Cons**: Inconsistent with existing functional patterns in the codebase
- **Rejected**: The codebase uses exported functions and direct `query()` calls; a class would be inconsistent

## Consequences

- Actor CRUD is implemented with 30 passing tests covering all entry methods, pagination, taxonomy filtering, output grouping, soft delete, and admin bypass
- `asset-repo.ts` provides reusable functions for Look and Fashion Item (Tasks 8), reducing duplication
- Service layer isolates actor-specific logic from generic CRUD, making it easy to add generation endpoints (Tasks 9) without modifying repository code
- Taxonomy filter approach is schema-agnostic — new taxonomy categories don't require code changes
- `LEFT JOIN LATERAL` for headshot_url adds one subquery per row; acceptable for current scale (studio workspaces have dozens, not millions, of actors)
