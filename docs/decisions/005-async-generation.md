# ADR-005: Async Image Generation Pipeline

## Status
Accepted

## Date
2026-06-17

## Context
Image generation via fal.ai is slow (seconds to minutes). The API must remain responsive while generations are in progress. Users should be able to trigger generation and continue working. Results must be reproducible (store full generation parameters).

## Decision

### Flow
1. User calls `POST /api/actors/:id/generate` (or `/regenerate`, `/character-sheet`)
2. API validates, deducts credits, creates PENDING `asset_output` row(s), returns 202 immediately
3. Background worker (`generation-worker.ts`) polls fal.ai for PENDING jobs
4. On completion: updates `asset_output` to SUCCESS (with image_url) or FAILED (with error_message)
5. Notification fires (in-app + email) on completion
6. Frontend polls `GET /api/generation-jobs/:id` or waits for notification

### Regeneration
- Current output row is archived to `asset_output_versions` (all fields preserved)
- Downstream outputs (dependent on this one) are marked `is_obsolete = TRUE` with `obsolete_reason`
- New PENDING row created with `version = old_version + 1`
- Old image URLs remain accessible via version history

### Reproducibility
- `generation_params` JSONB stores the complete request body sent to fal.ai (model, seed, resolution, steps, guidance_scale, sampler, num_outputs, prompt, all API params)
- `reference_images` JSONB stores uploaded input image references
- `source_asset_outputs` JSONB links to existing assets used as input (e.g., character sheet uses headshot + look)

### Credit Deduction
- Credits are deducted when the PENDING row is created (before calling fal.ai)
- Failed generations still charge credits (pay-per-click model — spec says clients absorb cost of bad rolls)

## Alternatives Considered

### Synchronous generation (wait for fal.ai)
- Pros: Simpler, immediate result
- Cons: API timeout risk, poor UX, can't navigate away
- Rejected: Spec requires async across all pages

### Webhook from fal.ai instead of polling
- Pros: Instant notification, no polling overhead
- Cons: Requires public endpoint, fal.ai webhook reliability unknown
- Rejected: Polling is simpler and more reliable for now. May add webhook later.

### Queue system (Bull, RabbitMQ)
- Pros: Robust job management, retries, concurrency control
- Cons: Adds infrastructure complexity, another dependency
- Rejected: Single worker with debounced polling is sufficient for current scale. Can upgrade to queue later.

## Consequences
- `generation-worker.ts` runs as a separate process (or setInterval in server process)
- Worker must handle: fal.ai rate limits, timeouts, transient errors (retry 3x)
- `asset_output_versions` table grows unbounded — consider archival strategy for production
- Frontend must handle: PENDING spinner, SUCCESS display, FAILED with retry button
- Version history endpoint: `GET /api/assets/:id/outputs/:outputId/versions`
