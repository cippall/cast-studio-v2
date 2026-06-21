# Fix Plan: Actor Studio — Real fal.ai Generation Workflow

## Overview

The Actor Studio wizard is broken end-to-end. Users cannot generate a single
real image using fal.ai models. This plan fixes every issue that blocks the
generation pipeline, from model selection to actual image delivery.

The root problems are:

1. **Model browser never loads** — `fetchFalModels` uses wrong API endpoint
2. **No model selector in Stage 2** — user can't pick which model to use
3. **Generation worker ignores workspace keys** — falls back to env var only
4. **Frontend never sends `model` in generate request** — backend uses hardcoded default
5. **`num_outputs` mismatch** — frontend hardcodes 4, backend loop ignores it
6. **Custom params sent to fal.ai** — `form_data`/`reference_images` are not valid fal.ai inputs
7. **No taxonomy seed** — structured form shows empty fields by default
8. **Regenerate doesn't support `num_outputs`** — schema strips it

---

## Architecture Decisions

- **Model selection lives in Stage 2**, not Stage 1. Stage 1 collects identity
  (form/text/reference). Stage 2 lets the user pick a model and generate each
  layout. This matches the iteration workflow — the user may want to try
  different models for different layouts.
- **Workspace API key is the primary key source**. The generation worker must
  look up the workspace key, not rely on `FAL_KEY` env var. The env var is
  only a last-resort fallback.
- **fal.ai queue endpoint**: `https://queue.fal.run/{model_id}` is the correct
  queue-based endpoint for all models. The status endpoint is
  `https://queue.fal.run/{model_id}/requests/{job_id}/status`.
- **Model listing endpoint**: Use fal.ai's REST API at
  `https://rest.alpha.fal.ai/v1/models?category=...` — NOT `api.fal.ai`.
  The `api.fal.ai` domain does not serve model listings.

---

## Issue Inventory

| #   | Severity  | Layer | Issue                                                                            |
| --- | --------- | ----- | -------------------------------------------------------------------------------- |
| 1   | Critical  | BE    | `fetchFalModels` uses wrong endpoint — model browser always empty                |
| 2   | Critical  | FE    | No model selector in Stage 2 — user can't choose a model                         |
| 3   | Critical  | FE    | Generate mutation never sends `model` — backend uses hardcoded default           |
| 4   | Critical  | BE    | Generation worker ignores workspace-scoped API keys                              |
| 5   | Critical  | BE    | `submitTextToImage` sends `form_data`/`reference_images` as top-level fal params |
| 6   | Important | FE    | `num_options` hardcoded to `NUM_OPTIONS` constant, no UI control                 |
| 7   | Important | BE    | `regenerateSchema` strips `num_outputs` — regeneration always creates 1 output   |
| 8   | Important | FE    | Structured form empty — no `ACTOR_PROPERTY` taxonomy seeded                      |
| 9   | Important | BE    | `pollJob` falls back to `FAL_KEY` env even when workspace key exists             |
| 10  | Nit       | FE    | `Stage2` doesn't reset `generateError` on model change                           |

---

## Phase 1: Fix Model Browser + API (Backend)

These tasks unblock model selection. Without working model browsing, the user
can't know what models are available, and the model selector in Stage 2 has
nothing to show.

### Task 1: Fix `fetchFalModels` endpoint

**Files:**

- `server/src/services/fal/models.ts`

**Problem:** Uses `https://api.fal.ai/v1/models` which returns 404. The correct
endpoint is `https://rest.alpha.fal.ai/v1/models`.

**Fix:**

1. Change `FAL_API_BASE` from `https://api.fal.ai/v1` to `https://rest.alpha.fal.ai/v1`
2. Verify the response shape matches (it returns `{ models: [...] }` with
   `endpoint_id` and `metadata.display_name`)
3. If the response shape differs, adapt the mapping code

**Acceptance:**

- [ ] `GET /api/admin/fal-models` returns a non-empty list when API key is valid
- [ ] Models have `id`, `name`, `description`, `category` fields
- [ ] No 404/403 errors from fal.ai

**Verification:**

- [ ] Start server, call `curl http://localhost:3001/api/admin/fal-models` with valid session
- [ ] Response contains at least 1 model

**Dependencies:** None
**Estimated scope:** XS (1 file)

---

### Task 2: Pass workspace API key to generation worker

**Files:**

- `server/src/workers/generation-worker.ts`
- `server/src/services/fal-service.ts`

**Problem:** `processSingleOutput` calls `fal.pollJob(falJobId, output.model, undefined, outputSeed)`.
The `apiKey` is `undefined`, so `pollJob` falls back to `process.env.FAL_KEY`.
Workspace-scoped keys stored in `fal_ai_keys` are never used by the worker.

**Fix:**

1. Add `getWorkspaceApiKey` import to `generation-worker.ts`
2. In `processSingleOutput`, look up the workspace ID from the asset:
   ```typescript
   const assetResult = await query('SELECT workspace_id FROM assets WHERE id = $1', [
     output.asset_id,
   ]);
   const workspaceId = assetResult.rows[0]?.workspace_id;
   const workspaceKey = workspaceId ? await getWorkspaceApiKey(workspaceId) : undefined;
   ```
3. Pass `workspaceKey` to `fal.pollJob()` instead of `undefined`

**Acceptance:**

- [ ] Worker polls fal.ai using the workspace's stored API key
- [ ] No reliance on `FAL_KEY` env var when workspace key exists
- [ ] Falls back to env var if no workspace key (backward compatible)

**Verification:**

- [ ] Start server with no `FAL_KEY` env, store key via admin UI, generate — worker completes
- [ ] Check server logs for successful fal.ai poll responses

**Dependencies:** None
**Estimated scope:** S (2 files)

---

## Phase 2: Fix Generation Request Pipeline (Frontend → Backend)

These tasks wire model selection through the entire pipeline.

### Task 3: Add model selector to Stage 2

**Files:**

- `client/src/components/actor-designer/Stage2.tsx`
- `client/src/components/actor-designer/StructuredFormPanel.tsx`
- `client/src/components/actor-designer/useActorDesignerState.ts`
- `client/src/hooks/useAdminModels.ts`

**Problem:** Stage 2 has no model dropdown. The user can't choose which fal.ai
model to use. The generate mutation never sends `model`.

**Fix:**

1. In `Stage2.tsx`, accept `models: ModelConfig[]` and `selectedModel: string`,
   `onModelChange: (modelId: string) => void` as new props
2. Add a model selector dropdown at the top of Stage 2 (above the stepper):
   - Show active models from `useAdminModels()` (already fetches `/admin/models`)
   - Default to the first active model
   - When no models are configured, show a warning: "No models configured.
     Go to Settings → Models to add one."
3. In `StructuredFormPanel`, also show the selected model name so the user
   knows what they're generating with
4. In `useActorDesignerState`:
   - Add `selectedModel` state (initialize from first active model)
   - Pass `model: selectedModel` in the generate/regenerate mutation bodies
5. In `ActorDesigner.tsx`, pass models and model selection props to Stage 2

**Acceptance:**

- [ ] Stage 2 shows a dropdown of active models
- [ ] Selected model is included in generate/regenerate API requests
- [ ] Warning shown when no models are configured
- [ ] Model selection persists across step navigation

**Verification:**

- [ ] Start client, navigate to Actor Designer Stage 2, see model dropdown
- [ ] Select a different model, click Generate, check network request includes `model` field

**Dependencies:** Task 1 (models must be browseable to select them)
**Estimated scope:** M (4 files)

---

### Task 4: Fix `num_outputs` — use constant, add UI control

**Files:**

- `client/src/components/actor-designer/useActorDesignerState.ts`
- `client/src/components/actor-designer/StructuredFormPanel.tsx`
- `client/src/components/actor-designer/types.ts`

**Problem:** `NUM_OPTIONS = 4` is hardcoded in `types.ts`. The user has no way
to control how many variations are generated. The backend respects `num_outputs`
but the frontend never exposes it.

**Fix:**

1. Add `numOutputs: number` state to `useActorDesignerState` (default: 4)
2. Add a number input (1-8) in `StructuredFormPanel` labeled "Variations"
3. Pass `num_outputs: numOutputs` in the generate mutation body
4. In `types.ts`, keep `NUM_OPTIONS = 4` as default but allow override

**Acceptance:**

- [ ] User can select 1-8 variations before generating
- [ ] Default is 4
- [ ] Generate request sends correct `num_outputs`
- [ ] Backend creates the correct number of PENDING output rows

**Verification:**

- [ ] Set variations to 2, generate — exactly 2 image slots appear
- [ ] Set variations to 6, regenerate — exactly 6 image slots appear

**Dependencies:** None
**Estimated scope:** S (3 files)

---

### Task 5: Fix `regenerateSchema` to include `num_outputs`

**Files:**

- `server/src/routes/actors.ts`

**Problem:** The `regenerateSchema` (line 55-66) doesn't include `options.num_outputs`.
The frontend sends it on regenerate, but the backend Zod schema strips it.
Regeneration always creates exactly 1 output.

**Fix:**

1. Add `num_outputs` to the regenerate schema's `options` object:
   ```typescript
   options: z.object({
     num_outputs: z.number().int().min(1).max(8).optional(),
     prompt: z.string().optional(),
   }).optional(),
   ```
2. Pass `num_outputs` to `regenerateActorOutput` call in the route handler

**Acceptance:**

- [ ] Regenerate endpoint accepts `options.num_outputs`
- [ ] Correct number of output rows created on regenerate
- [ ] Default is 1 if not provided (backward compatible)

**Verification:**

- [ ] Call `POST /api/actors/:id/regenerate` with `options: { num_outputs: 3 }`
- [ ] Response contains 3 output IDs

**Dependencies:** None
**Estimated scope:** XS (1 file)

---

## Phase 3: Fix fal.ai API Call Construction

These tasks ensure the actual fal.ai API calls are correct.

### Task 6: Strip invalid params from fal.ai requests

**Files:**

- `server/src/services/fal/api.ts`

**Problem:** `submitTextToImage` sends `form_data` and `reference_images` as
top-level keys in the request body to fal.ai. fal.ai's queue API doesn't
understand these keys and may return 400 errors or ignore them silently.

**Fix:**

1. Remove `form_data` and `reference_images` from the fal request body
2. These are Cast Studio's internal concepts — they're already stored in
   `asset_outputs.generation_params` for audit purposes
3. If `form_data` should influence the prompt, it must be resolved BEFORE
   calling `submitTextToImage` (which already happens — `resolvePrompt` builds
   the full prompt string from form data)
4. `reference_images` is handled separately via `submitImageToImage` —
   it shouldn't be mixed into text-to-image calls

**Acceptance:**

- [ ] `submitTextToImage` body only contains valid fal.ai params
      (prompt, seed, num_images, image_size, guidance_scale, num_inference_steps)
- [ ] `submitImageToImage` body only contains valid params
      (image_url, prompt, seed, num_images, strength)
- [ ] No 400 errors from fal.ai due to unknown parameters

**Verification:**

- [ ] Generate with FORM mode — no fal.ai error
- [ ] Generate with TEXT mode — no fal.ai error
- [ ] Check server logs for fal.ai response status

**Dependencies:** None
**Estimated scope:** XS (1 file)

---

### Task 7: Fix `pollJob` to use workspace key for status polling

**Files:**

- `server/src/services/fal/api.ts`

**Problem:** Even after Task 2 passes the workspace key to the worker, the
`pollJob` function still falls back to `getEnvKey()` when `apiKey` is provided
but falsy. The current logic `const key = apiKey ?? getEnvKey()` is correct
when `apiKey` is a string. But we should also handle the case where the
workspace key is an empty string (no key configured) — in that case, don't
poll, just return PENDING forever.

**Fix:**

1. The current `pollJob` logic is actually correct — if `apiKey` is passed
   and truthy, it uses that key. Task 2 ensures the key is passed.
2. Add a guard: if no key at all, log a warning and return a FAILED status
   instead of returning PENDING forever:
   ```typescript
   if (!key) {
     console.warn(`[fal] No API key available for polling job ${jobId}`);
     return {
       id: jobId,
       status: 'FAILED',
       image_url: null,
       error_message: 'No API key configured',
       cost_credits: 0,
     };
   }
   ```

**Acceptance:**

- [ ] `pollJob` with a valid key polls fal.ai correctly
- [ ] `pollJob` with no key returns FAILED with a clear error (not infinite PENDING)

**Verification:**

- [ ] Disconnect fal.ai key, try to generate — should see "No API key configured" error
- [ ] Connect key, generate — polling succeeds

**Dependencies:** Task 2
**Estimated scope:** XS (1 file)

---

## Phase 4: Seed Data + Taxonomy

### Task 8: Seed default actor taxonomy (ACTOR_PROPERTY)

**Files:**

- `server/src/db/seed.ts` (or new migration `012_actor_taxonomy_seed.up.sql`)

**Problem:** The structured form shows "No form fields configured" because no
`ACTOR_PROPERTY` taxonomy entries exist. The user said "the actor structured
form has no values, just empty values."

**Fix:**

1. Create a migration or seed script that inserts default ACTOR_PROPERTY
   taxonomy entries:
   - `age` (NUMBER, required)
   - `gender` (DROPDOWN, options: male/female/non-binary/other)
   - `ethnicity` (DROPDOWN, options: caucasian/african/asian/hispanic/middle-eastern/mixed/other)
   - `vibe` (TEXT, free-form style description)
   - `hair_color` (DROPDOWN)
   - `eye_color` (DROPDOWN)
   - `body_type` (DROPDOWN)
2. These are global (no workspace_id) — they're admin-defined defaults
3. Mark all as `is_active = true`

**Acceptance:**

- [ ] Structured form shows 7 fields by default
- [ ] All fields have labels, input types, and options where applicable
- [ ] Form values are included in the actor's `prompt_recipe.identity`

**Verification:**

- [ ] Run seed/migration
- [ ] Open Actor Designer → FORM mode → see populated form fields
- [ ] Fill in values, create actor — `prompt_recipe.identity` contains the data

**Dependencies:** None
**Estimated scope:** S (1 migration file)

---

## Phase 5: End-to-End Verification

### Task 9: Integration test — full actor generation flow

**Files:**

- `server/tests/integration-actor-generation.test.ts` (new)

**Problem:** No test covers the full path: create actor → generate → worker
poll → SUCCESS. Each fix above is unit-level; we need to verify the pieces
work together.

**Fix:**

1. Write an integration test that:
   - Creates an actor via `POST /api/actors` (FORM mode with taxonomy data)
   - Calls `POST /api/actors/:id/generate` with a model and `num_outputs: 2`
   - Verifies 2 PENDING outputs returned
   - Simulates worker polling by calling `processNow()`
   - (Optionally) mock fal.ai response and verify outputs marked SUCCESS

**Acceptance:**

- [ ] Test passes without errors
- [ ] 2 outputs created with PENDING status
- [ ] Worker processes outputs (mocked or real)

**Verification:**

- [ ] `npm test -- --grep "actor-generation"` passes

**Dependencies:** Tasks 1-8
**Estimated scope:** M (1 new test file)

---

## Execution Order

```
Phase 1 (Critical path -- do first):
  Task 1: Fix fetchFalModels endpoint
  Task 2: Pass workspace key to generation worker

Phase 2 (Core pipeline):
  Task 3: Add model selector to Stage 2
  Task 4: Fix num_outputs + add UI control
  Task 5: Fix regenerateSchema

Phase 3 (fal.ai API correctness):
  Task 6: Strip invalid params from fal requests
  Task 7: Fix pollJob no-key guard

Phase 4 (Seed data):
  Task 8: Seed default actor taxonomy

Phase 5 (Verification):
  Task 9: Integration test
```

---

## Checkpoints

### Checkpoint: After Phase 1

- [ ] `GET /api/admin/fal-models` returns models from fal.ai
- [ ] Generation worker uses workspace API key (not just env var)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes

### Checkpoint: After Phase 2

- [ ] Stage 2 shows model dropdown populated from `/admin/models`
- [ ] Generate request includes `model` and `num_outputs`
- [ ] Regenerate accepts `num_outputs`
- [ ] `npm run typecheck` passes

### Checkpoint: After Phase 3

- [ ] fal.ai API calls only contain valid parameters
- [ ] No 400 errors from fal.ai on any generation path
- [ ] Missing API key produces clear error (not infinite spinner)

### Checkpoint: After Phase 4

- [ ] Structured form shows 7 default fields
- [ ] Form values are saved to actor's `prompt_recipe.identity`

### Checkpoint: After Phase 5

- [ ] Integration test passes
- [ ] Manual end-to-end: create actor → generate → see real images
- [ ] Build succeeds: `npm run build`

---

## Risks and Mitigations

| Risk                                            | Impact | Mitigation                                                  |
| ----------------------------------------------- | ------ | ----------------------------------------------------------- |
| fal.ai REST API endpoint may have changed       | High   | Test with curl first; adapt response mapping                |
| Workspace key decryption fails on existing data | Medium | Add try/catch; log error, fall back to env var              |
| Model selector UI breaks mobile layout          | Low    | Use native `<select>` for mobile, shadcn Select for desktop |
| Taxonomy seed conflicts with existing data      | Low    | Use `ON CONFLICT DO NOTHING` for idempotent seed            |

---

## Open Questions

1. **fal.ai REST API endpoint**: Is `https://rest.alpha.fal.ai/v1/models` correct,
   or should we use a different endpoint? Need to verify with curl.
2. **Model categories**: Should we only show `text_to_image` models for actor
   generation, or also `image_to_image`? (Image-to-image is for reference mode.)
3. **Client role**: Should clients see the model selector, or should it be
   read-only (use whatever the workspace default is)?
