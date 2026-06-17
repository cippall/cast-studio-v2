# ADR-011: Query Helper Pattern for Workspace Isolation

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 is a multi-tenant system. Every entity in the database belongs to a workspace, and all queries MUST filter by `workspace_id` to prevent data leakage across tenants. Additionally, the schema uses soft-delete (`deleted_at` timestamp) for all assets.

Without a centralized query mechanism, every repository would need to duplicate workspace filtering logic, soft-delete handling, and pagination — leading to inconsistent behavior and increased surface area for bugs.

We needed a reusable `queryTable` helper that:

- Automatically adds `workspace_id` filtering (with admin bypass)
- Automatically adds `deleted_at IS NULL` (with opt-out for admin operations)
- Supports pagination with parameterized SQL
- Sanitizes identifiers and uses parameterized bindings for all user values
- Returns a consistent `{ data, pagination }` shape

## Decision

Create a `queryTable` function in `server/src/db/query-helper.ts` that builds parameterized SQL queries with consistent isolation rules.

### Design

Single exported async function with two internal helpers:

- `queryTable(table, options)` — Main query function. Builds WHERE clause via `buildConditions`, runs COUNT and SELECT queries, returns paginated results.
- `buildConditions(input, params)` — Private helper that constructs the WHERE clause string and populates the params array. Handles workspace filter, soft-delete, and additional column filters.
- `sanitizeIdentifier(id)` — Strips non-alphanumeric characters from identifiers to prevent SQL injection.
- `toSnakeCase(str)` — Converts camelCase API parameters to snake_case column names.

### Key behaviors

1. **Workspace isolation**: `workspace_id = $N` is added unless `adminBypass: true`
2. **Soft-delete**: `deleted_at IS NULL` is added unless `includeDeleted: true`
3. **Pagination**: LIMIT/OFFSET with configurable `page` and `pageSize` (defaults 1 and 20)
4. **Sorting**: configurable `sortBy` and `sortOrder` (defaults `created_at` DESC)
5. **Security**: All identifiers sanitized, all values parameterized

## Alternatives Considered

### Inline SQL in each repository

- Pros: Maximum flexibility per query
- Cons: Duplication of workspace/soft-delete logic across all repositories; high risk of missing a filter in one place
- Rejected: Too error-prone for a security-critical pattern

### ORM (Prisma, TypeORM, Knex)

- Pros: Built-in query building, migrations, type safety
- Cons: Heavier dependency, requires separate migration tooling, abstraction overhead for a focused need. Our schema is PostgreSQL-specific (JSONB, partial indexes, GENERATED columns) which ORMs handle inconsistently.
- Rejected: Overkill for our needs; pg driver + query helper gives us full control

### Repository pattern per entity

- Pros: Each repository owns its query logic
- Cons: The workspace isolation pattern would still need to be applied consistently; would still benefit from a shared helper
- Not rejected but layered: Individual repositories (asset-repo, look-repo, etc.) can use `queryTable` as a building block

## Consequences

- All repositories will use `queryTable` for LIST queries, ensuring consistent isolation
- JOINs and complex queries that can't use `queryTable` must manually apply workspace isolation
- The `queryTable` function is unit-testable via mocked pool queries
- Cross-workspace isolation is verifiable via integration tests (see `scripts/isolation-test/isolation.test.ts`)
- Moving away from this pattern later would require changes to all consuming repositories
