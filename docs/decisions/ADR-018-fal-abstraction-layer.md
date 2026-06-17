# ADR-018: fal.ai Abstraction Layer for Image Generation

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio generates images using fal.ai as the primary provider. The system needs to:

1. **Async generation** — API returns 202 immediately; generation happens in background
2. **Multiple models** — Support flux-pro, sdxl-turbo, and future models without changing business logic
3. **Three generation modes** — text-to-image, image-to-image, and image-to-text (extraction)
4. **Job polling** — Background worker polls fal.ai for completion
5. **Error resilience** — Handle API failures gracefully in dev (no API key) and production
6. **Reproducibility** — Store complete `generation_params` JSON for exact replay

## Decision

### Layered Architecture

```
Routes → Generation Service → fal Service → fal.ai API
                           ↘
                    asset-repo (DB)
```

Four layers with clear responsibilities:

### 1. fal-service.ts (Provider Adapter)

- **Responsibility**: Raw fal.ai HTTP calls, no business logic
- **Exports**: `submitTextToImage`, `submitImageToImage`, `pollJob`, `cancelJob`, `imageToText`
- **Dev mode**: When `FAL_KEY` is not set, all functions return simulated results — PENDING immediately, SUCCESS on first poll. No actual API calls.
- **Error handling**: All fetch calls throw on HTTP errors. Callers wrap in try-catch.
- **Model routing**: Maps model names (`flux-pro`, `sdxl-turbo`) to fal.ai endpoint URLs.

### 2. generation-service.ts (Orchestrator)

- **Responsibility**: Validate asset state, create PENDING output rows, archive old versions, mark downstream obsolete
- **Exports**: `generateActorOutput`, `regenerateActorOutput`, `generateCharacterSheet`, `getGenerationStatus`
- **Pattern**: All three endpoints follow the same flow:
  1. Validate asset exists, is correct type, not marketplace-frozen
  2. Create PENDING `asset_output` row(s) in DB
  3. Submit to fal.ai via fal-service (non-blocking try-catch)
  4. Return 202 response with output IDs
- **Regeneration**: Archives current output to `asset_output_versions`, marks downstream outputs obsolete, creates new PENDING row with `version+1`
- **Character sheet**: Resolves actor headshot + look output IDs and stores as `source_asset_outputs` JSONB

### 3. generation-worker.ts (Background Processor)

- **Responsibility**: Poll DB for PENDING outputs, poll fal.ai for completion, update status
- **Debounce**: Single module-level `isRunning` flag prevents concurrent runs. Worker checks flag, sets it, processes batch, clears it.
- **Poll interval**: 5 seconds (configurable via `POLL_INTERVAL_MS`)
- **Batch size**: 10 outputs per cycle
- **Dev mode**: When `generation_params` has no `fal_job_id`, marks outputs SUCCESS immediately with a simulated URL
- **Error handling**: Per-output try-catch catches fal.ai failures and marks output as FAILED with error message

### 4. Repository Layer (asset-repo.ts additions)

- `archiveAssetOutput(outputId)` — Copies current row to `asset_output_versions` archive table
- `markDownstreamObsolete(assetId, assetType, layoutType, reason)` — Sets `is_obsolete` on downstream outputs
- `findPendingOutputs(limit)` — Returns PENDING outputs for worker processing
- `getAssetOutputById(outputId)` — Single output lookup for job status polling
- `getDownstreamLayouts(assetType, layoutType)` — Static dependency chain: `headshot → fullshot → expressions_3x4 → character_sheet → editorial`

### Dependency Chain for Actors

```
headshot → fullshot → expressions_3x4 → character_sheet
                                       → editorial
```

Regenerating any layout invalidates all layouts downstream. Looks and Fashion Items have no chain (single layout type).

### Generation Parameters Storage

`generation_params` JSONB stores the complete request body sent to fal.ai:

```json
{
  "seed": 12345,
  "prompt": "A female character, age 25...",
  "model": "flux-pro",
  "num_outputs": 1,
  "layout_type": "headshot",
  "image_size": "1024x1024"
}
```

For character sheets, additionally stores:

```json
{
  "source_assets": [
    { "asset_id": "...", "asset_output_id": "...", "layout_type": "headshot" },
    { "asset_id": "...", "asset_output_id": "...", "layout_type": "look" }
  ]
}
```

## Alternatives Considered

### Synchronous generation (no background worker)

- Pros: Simpler code, immediate result
- Cons: API timeouts (fal.ai takes 5-30s), blocks frontend UX
- **Rejected**: Spec requires async across all pages

### Webhook from fal.ai instead of polling

- Pros: Instant notification on completion
- Cons: Requires public endpoint, fal.ai webhook reliability unknown
- **Deferred**: Polling is simpler and more reliable at current scale. May add webhook later via ADR.

### Dedicated job queue (Bull, RabbitMQ)

- Pros: Retries, concurrency control, persistence
- Cons: Infrastructure complexity, another dependency
- **Deferred**: Single debounced worker is sufficient for current scale. Queue can be added later when more providers or rate limiting are needed.

### Calling fal-service directly from routes

- Pros: Simpler, fewer layers
- Cons: Routes would contain business logic (archive, obsolete marking), violation of separation
- **Rejected**: Generation service provides the business orchestration layer

## Consequences

- `generation-worker.ts` runs as `setInterval` in the server process with a debounce flag
- All PENDING outputs from Looks, Fashion Items, and Actors are processed by the same worker
- No `FAL_KEY` required for development — simulated responses allow offline testing
- Failed generations store `error_message` with `cost_credits` (pay-per-click model charges for failed generations too)
- 24 new tests cover generate, regenerate, character-sheet, and job polling endpoints
