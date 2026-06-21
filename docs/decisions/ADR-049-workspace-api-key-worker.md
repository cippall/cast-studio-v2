# ADR-049: Workspace API Key Propagation to Generation Worker

## Status

Accepted

## Date

2026-06-21

## Context

The generation worker (`server/src/workers/generation-worker.ts`) polls fal.ai for job completion. Each call to `fal.pollJob()` was passing `undefined` as the API key parameter, causing it to always fall back to `process.env.FAL_KEY`. Workspace-scoped API keys stored in the `fal_ai_keys` table (encrypted at rest) were never used by the worker, meaning:

1. Workspaces that configured their own fal.ai key via the admin UI still used the global `FAL_KEY` env var
2. Running without `FAL_KEY` (relying on workspace keys only) would cause all polling to fail
3. The multi-tenant key isolation feature was broken at the worker level

## Decision

In `processSingleOutput()`, look up the `workspace_id` from the `assets` table using `output.asset_id`, then call `getWorkspaceApiKey(workspaceId)` to resolve the workspace-scoped key. Pass this key to `fal.pollJob()` instead of `undefined`.

The fallback chain is:

1. Workspace key from `fal_ai_keys` table (if configured and active)
2. `process.env.FAL_KEY` (handled by `pollJob` when key is `undefined`)
3. Simulated mode (when neither key is available)

## Alternatives Considered

### Pass workspace_id through the output record

Store `workspace_id` directly on `asset_outputs` to avoid the extra JOIN query.

- Pros: Slightly faster, no extra query
- Cons: Denormalizes data, risks inconsistency if asset moves workspaces (which shouldn't happen but adds coupling)
- Rejected: The extra query is negligible (indexed lookup by primary key), and keeping the source of truth on `assets` is cleaner

### Resolve the key once at worker startup

Resolve the workspace key when the worker starts and reuse it.

- Pros: Fewer DB lookups
- Cons: Worker processes all workspaces' outputs in a batch; a single key wouldn't work for multi-tenant polling
- Rejected: The worker is shared across workspaces, so per-output key resolution is necessary

## Consequences

- Workspace-scoped fal.ai keys now work end-to-end: admin UI → `fal_ai_keys` table → worker → fal.ai API
- Backward compatible: if no workspace key exists, `getWorkspaceApiKey` returns `undefined`, and `pollJob` falls back to `FAL_KEY` env var
- One additional indexed DB query per pending output poll (negligible overhead)
- Test coverage added in `tests/generation-worker.test.ts` with 3 test cases: workspace key present, no workspace key, and missing asset
