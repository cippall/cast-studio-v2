# Fix Plan: Actor Image Generation Flow

## Overview

Fixes for the actor image generation flow. The core problem: the 3-stage
ActorDesigner wizard has multiple issues that prevent a complete form-based
generation from working end-to-end. This plan covers 20 issues grouped into
5 phases. Each task is sized for a single agent session (well under 2M tokens).

## Issues Summary

| #   | Severity  | Layer | Issue                                                                                     |
| --- | --------- | ----- | ----------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Critical  | FE    | Layout step key mismatch: frontend sends `expressions`, backend expects `expressions_3x4` |
| 2   | Critical  | FE    | Stage 1 FORM mode shows no form fields -- actor created with empty data                   |
| 3   | Critical  | FE    | Stage 1 TEXT mode: no prompt validation, backend returns 422                              |
| 4   | Critical  | FE    | Stage 1 REFERENCE mode: no image/prompt input, actor created empty                        |
| 5   | Critical  | FE    | `getOutputStatus` returns SUCCESS for null outputs -- missing outputs look green          |
| 6   | Critical  | FE    | Generate mutation errors swallowed -- spinners forever, no error message                  |
| 7   | Important | FE    | Stage 3 re-renders empty ActorFormFields, losing Stage 2 data                             |
| 8   | Important | FE    | `characterSheetLookId` stale closure in generateMutation                                  |
| 9   | Important | FE    | Editorial re-generation calls `onGenerate` instead of `onRegenerate`                      |
| 10  | Important | FE    | Stage 2 GenerationStatus doesn't show generate errors                                     |
| 11  | Important | FE    | No timeout/error for stale PENDING outputs on ActorDetail                                 |
| 12  | Important | BE    | Seed script missing `system_prompts` -- all tasks use generic fallback prompts            |
| 13  | Important | BE    | `resolveModel` ignores workspaceId parameter -- all workspaces use same model             |
| 14  | Important | BE    | Regenerate doesn't refund credits on fal.ai submission failure                            |
| 15  | Important | BE    | Credit reservation blocks new users with 0 balance                                        |
| 16  | Minor     | FE    | `Edit Fields` button on ActorPage is a no-op                                              |
| 17  | Minor     | FE    | Stage 1 CREATE button enabled when form is empty / prompt is blank                        |
| 18  | Minor     | FE    | `useActorPageRender` actions only regenerate headshot, not other layouts                  |
| 19  | Minor     | FE    | `GenerationState` type missing `'NONE'` state for absent outputs                          |
| 20  | Low       | fal   | Simulated mode produces 1x1 pixel placeholder images                                      | Placeholder images are invisible in the UI |

---

## Phase 1: Unblock Generation (Critical Path)

These 6 tasks must be done first. They are the minimum to make the form-based
generation flow work end-to-end. Tasks within this phase are independent and
can be done in any order.

### TASK-1: Fix layout step key mismatch

**Files:**

- `client/src/components/actor-designer/types.ts`
- `client/src/pages/actors/actor-page-types.ts`

**Problem:** Frontend `LayoutStep` type uses `'expressions'` but backend
`generateSchema` expects `'expressions_3x4'`. Every generate call for the
expressions step returns 400 VALIDATION_ERROR. The user sees spinners forever.

**Fix:**

1. In `types.ts`: change `LayoutStep` to `'headshot' | 'fullshot' | 'expressions_3x4'`
2. In `types.ts`: change `LAYOUT_STEPS[2].key` to `'expressions_3x4'`
3. In `actor-page-types.ts`: change `OutputSectionKey` to include `'expressions_3x4'`
4. In `actor-page-types.ts`: change `OUTPUT_SECTIONS[2].key` to `'expressions_3x4'`
5. In `actor-page-types.ts`: change `requiredOutputs` array to use `'expressions_3x4'`

**Acceptance:**

- [ ] `tsc --noEmit` passes
- [ ] Frontend sends `expressions_3x4` to backend generate endpoint
- [ ] ActorDetail page looks up `expressions_3x4` output correctly

---

### TASK-2: Add inline form to Stage 1 for FORM/REFERENCE/TEXT modes

**File:** `client/src/components/actor-designer/Stage1.tsx`

**Problem:** Stage 1 only shows the entry method picker. FORM mode shows no
fields, REFERENCE shows no upload, TEXT shows a textarea but no validation.
Users click Continue with empty data.

**Fix:**

1. When FORM is selected, render `<ActorFormFields>` inline below the radio
   buttons (same as StructuredFormPanel but without the generate button).
2. When REFERENCE is selected, render `<ReferenceImageUpload>` and a prompt
   `<Textarea>` inline.
3. When TEXT is selected, keep the existing textarea.
4. Add validation before calling `onCreate`:
   - FORM: allow empty (backend accepts it)
   - TEXT: require `prompt.trim().length > 0`
   - REFERENCE: require `prompt.trim().length > 0 || referenceImages.length > 0`
5. Disable the Continue button when validation fails. Show a validation
   message inline.

**Acceptance:**

- [ ] FORM mode shows form fields in Stage 1
- [ ] REFERENCE mode shows image upload + prompt in Stage 1
- [ ] TEXT mode disables Continue when prompt is empty
- [ ] Continue button disabled state is visually clear

---

### TASK-3: Add validation in handleCreateActor

**File:** `client/src/components/actor-designer/useActorDesignerState.ts`

**Problem:** `handleCreateActor` calls `createActorMutation.mutate()` without
any validation. Backend returns 422 for invalid data but the error message
is generic.

**Fix:**

1. In `handleCreateActor`, add per-method validation:
   - TEXT: if `!prompt.trim()`, set `createError` and return
   - REFERENCE: if `!prompt.trim() && referenceImages.length === 0`, set
     `createError` and return
   - FORM: always valid
   - RANDOMIZE: always valid
2. Clear `createError` on successful creation (already handled in `onSuccess`).

**Acceptance:**

- [ ] TEXT mode with empty prompt shows error, does not call API
- [ ] REFERENCE mode with no images and no prompt shows error
- [ ] FORM mode always proceeds
- [ ] Error message is clear and actionable

---

### TASK-4: Fix getOutputStatus for null outputs

**Files:**

- `client/src/pages/actors/actor-page-types.ts`
- `client/src/components/GenerationStatus.tsx`

**Problem:** `getOutputStatus` returns `'SUCCESS'` for null/undefined outputs.
Missing outputs show a green checkmark instead of "not generated".

**Fix:**

1. Add `'NONE'` to `GenerationState` type: `'NONE' | 'PENDING' | 'SUCCESS' | 'FAILED'`
2. Change `getOutputStatus` to return `'NONE'` when output is null or undefined.
3. Update `GenerationStatus` component to render `'NONE'` as a gray
   "Not generated" label (no spinner, no checkmark).

**Acceptance:**

- [ ] Missing outputs show gray "Not generated" label
- [ ] No spinner for absent outputs
- [ ] SUCCESS/FAILED/PENDING states unchanged
- [ ] ActorDetail page shows "No headshot generated yet" for actors without outputs

---

### TASK-5: Show generate errors in Stage 2

**Files:**

- `client/src/components/actor-designer/Stage2.tsx`
- `client/src/components/actor-designer/useActorDesignerState.ts`

**Problem:** When the generate mutation fails (400, 422, 500, 502), the error
is swallowed. The `generateMutation` has no `onError` handler. The user sees
4 PENDING spinners forever with no feedback.

**Fix:**

1. Add `onError` to `generateMutation` in `useActorDesignerState.ts`:
   - Set a `generateError` state with the error message.
2. Pass `generateError` to `Stage2` and display it as an error banner
   above the image grid (similar to how `createError` is shown in Stage 1).
3. Clear `generateError` on successful generate or when the user changes
   the step.

**Acceptance:**

- [ ] Failed generate calls show an error banner in Stage 2
- [ ] Error message is specific (e.g., "Invalid input: layout_type must be one of...")
- [ ] Error clears when user retries or changes step

---

### TASK-6: Fix editorial re-generation in OutputSectionContent

**File:** `client/src/pages/actors/OutputSectionContent.tsx`

**Problem:** Line 162: editorial section with existing output calls
`onGenerate('editorial')` instead of `onRegenerate('editorial')`. This hits
the `/generate` endpoint which may conflict with existing output (409).

**Fix:**

1. Change `onGenerate('editorial')` to `onRegenerate('editorial')` on line 162.

**Acceptance:**

- [ ] Editorial re-generation calls `/regenerate` endpoint
- [ ] No 409 conflict errors when regenerating editorial

---

## Phase 2: Complete the Form Flow

These tasks fix the remaining UX issues in the actor creation wizard.
Do Phase 1 first.

### TASK-7: Remove duplicate ActorFormFields from Stage 3

**File:** `client/src/components/actor-designer/Stage3.tsx`

**Problem:** Stage 3 renders `<ActorFormFields>` again, but `taxonomyValues`
is initialized as `{}` and is separate from Stage 2's `formValues`. The user
fills in the form in Stage 2, then sees empty fields in Stage 3.

**Fix:**

1. Remove `<ActorFormFields>` from Stage 3.
2. Show a read-only summary of taxonomy values instead:
   - Display each non-empty `taxonomyValues` entry as label + value.
   - If no taxonomy values are set, show "No properties set."
3. The PATCH endpoint already handles `taxonomy_values` correctly.

**Acceptance:**

- [ ] Stage 3 shows read-only taxonomy summary, not editable form
- [ ] Save button still works
- [ ] No duplicate form rendering

---

### TASK-8: Pass Stage 2 form values to Stage 3 taxonomy

**File:** `client/src/components/actor-designer/useActorDesignerState.ts`

**Problem:** `taxonomyValues` is initialized as `{}` and never populated from
Stage 2's `formValues`. When the user fills in the structured form in Stage 2
and advances to Stage 3, the taxonomy values are lost.

**Fix:**

1. In `handleConfirmStep` (which advances from Stage 2 to Stage 3), set
   `taxonomyValues` from `formValues` before calling `setStage(3)`.
2. For FORM mode: `setTaxonomyValues({ ...formValues })`.
3. For TEXT/REFERENCE mode: leave empty (no structured data to extract).

**Acceptance:**

- [ ] Stage 3 shows taxonomy values filled in from Stage 2 form
- [ ] Saving actor preserves taxonomy values in prompt_recipe.identity

---

### TASK-9: Fix characterSheetLookId stale closure

**File:** `client/src/pages/actors/useActorPage.ts`

**Problem:** `generateMutation` captures `characterSheetLookId` from closure
at hook creation time (line 38). State updates via `setCharacterSheetLookId`
are not reflected in the mutation. Character sheet generation sends stale
look_id.

**Fix:**

1. Add `const characterSheetLookIdRef = useRef(characterSheetLookId);`
2. Add `useEffect(() => { characterSheetLookIdRef.current = characterSheetLookId; }, [characterSheetLookId]);`
3. In `generateMutation.mutationFn`, use `characterSheetLookIdRef.current`
   instead of `characterSheetLookId`.

**Acceptance:**

- [ ] Character sheet generation sends the currently selected look_id
- [ ] Changing the look selection and generating works correctly

---

### TASK-10: Add error timeout for stale PENDING outputs

**File:** `client/src/pages/actors/ActorOutputs.tsx`

**Problem:** If an output is PENDING (e.g., fal.ai submission failed silently),
the Collapsible section shows a spinner forever. No timeout or error state.

**Fix:**

1. In `useActorPage`, add a `useEffect` that checks for PENDING outputs older
   than 5 minutes and marks them as FAILED with a timeout error message.
2. Alternatively, add a "Stale" indicator in `OutputSectionContent` for PENDING
   outputs older than a threshold, with a "Retry" button.

**Acceptance:**

- [ ] PENDING outputs older than 5 minutes show a timeout error
- [ ] User can retry stale outputs
- [ ] Fresh PENDING outputs still show spinner

---

## Phase 3: Backend Fixes

These tasks fix backend issues. Can be done in parallel with Phase 2.

### TASK-11: Add system_prompts seed data

**File:** `server/src/db/seed.ts`

**Problem:** The seed script does not insert rows into `system_prompts`. The
`resolvePrompt` function always falls through to `buildFallbackPrompt`, which
uses generic templates. Form field values (age, gender, etc.) are never
interpolated into prompts.

**Fix:**

1. After the taxonomy insert section (before the COMMIT), add cleanup and
   insert for `system_prompts`:
   ```sql
   DELETE FROM system_prompts;
   INSERT INTO system_prompts (id, task, template, variables) VALUES
     (gen_random_uuid(), 'actor_headshot', 'Professional headshot of {{identity_description}}. Clean background, studio lighting, sharp focus on face.', '{}'),
     (gen_random_uuid(), 'actor_fullshot', 'Full body shot of {{identity_description}}. Standing pose, clean background, studio lighting.', '{}'),
     (gen_random_uuid(), 'actor_expressions', 'Expression sheet of {{identity_description}}. Multiple expressions: happy, sad, angry, surprised, neutral. Grid layout.', '{}'),
     (gen_random_uuid(), 'actor_editorial', 'Editorial fashion photograph of {{identity_description}}. Dramatic lighting, magazine quality.', '{}'),
     (gen_random_uuid(), 'actor_character_sheet', 'Character reference sheet of {{identity_description}}. Multiple angles: front, side, back. Character design sheet layout.', '{}'),
     (gen_random_uuid(), 'look_generation', 'Fashion photograph of a model wearing {{identity_description}}. Clean white background, studio lighting.', '{}'),
     (gen_random_uuid(), 'fashion_item', 'Product photograph of {{identity_description}}. Clean white background, studio lighting, centered composition.', '{}'),
     (gen_random_uuid(), 'reference_extraction', 'Analyze this image and identify all clothing items, accessories, and fashion elements. For each item, provide: type, color, material, style, and position. Return as structured JSON.', '{}'),
     (gen_random_uuid(), 'character_sheet_composition', 'Character sheet combining {{identity_description}}. Multiple angles, clean reference sheet layout.', '{}');
   ```
2. Each prompt uses `{{identity_description}}` which is auto-built by
   `prompt-service.ts` from `prompt_recipe.identity` fields.

**Acceptance:**

- [ ] Seed script inserts 9 system_prompts rows
- [ ] `resolvePrompt` finds templates for all task types
- [ ] Form-based generation produces prompts with interpolated values

---

### TASK-12: Fix resolveModel to use workspaceId

**File:** `server/src/services/generation/resolve-model.ts`

**Problem:** `resolveModel` accepts `workspaceId` but never uses it.
`listActiveModels()` and `findModelByTask()` query all active models
globally. All workspaces get the same model regardless of configuration.

**Fix:**

1. The `models` table has no `workspace_id` column -- models are global.
   This is actually correct behavior for a shared model catalog.
2. However, the `ConfiguredModels` page allows assigning models to tasks
   per-workspace. The `findModelByTask` function should check for
   workspace-specific task assignments first.
3. For now, document that model resolution is global. If workspace-specific
   model assignment is needed, add a `workspace_models` junction table.
4. Remove the unused `workspaceId` parameter to avoid confusion, or use it
   to filter by workspace if the schema supports it.

**Recommendation:** Keep global model catalog for now. The seed data assigns
models to tasks, and `findModelByTask` correctly resolves them. This is
acceptable for a single-workspace setup.

**Acceptance:**

- [ ] `resolveModel` parameter usage is clear (either used or removed)
- [ ] No runtime behavior change

---

### TASK-13: Refund credits on regenerate fal.ai failure

**File:** `server/src/services/generation/regenerate.ts`

**Problem:** In `regenerateActorOutput`, if fal.ai submission fails (lines
197-199), the error is caught and logged but credits are NOT refunded.
The output row stays PENDING forever. Compare with `generateActorOutput`
which calls `refundCredits` on failure.

**Fix:**

1. In the catch block (line 197-199), add:
   ```typescript
   await refundCredits(account.workspace_id, account.id, DEFAULT_COST);
   ```
2. Also update the output row to FAILED status:
   ```typescript
   await updateAssetOutputError(output.id, errorMessage);
   ```
3. Re-throw the error so the route handler returns 502.

**Acceptance:**

- [ ] Failed regenerate calls refund credits
- [ ] Output row marked FAILED on fal.ai submission error
- [ ] Route returns 502 on failure

---

### TASK-14: Handle insufficient credits gracefully

**File:** `server/src/services/generation/generate.ts`
**File:** `server/src/services/generation/regenerate.ts`

**Problem:** `reserveCreditsForGeneration` throws `InsufficientCreditsError`
when balance < amount. New users with 0 balance can't generate. The error
is caught by the route handler and returned as 422, which is correct. But
the frontend doesn't handle 422 specifically -- it shows a generic error.

**Fix (backend):**

1. The backend behavior is correct -- return 422 with a clear message.
2. No backend changes needed.

**Fix (frontend -- in TASK-5):**

1. The `generateError` state set in TASK-5 will display the 422 message.
2. Add specific handling for 422 to show a "Top up wallet" link.

**Acceptance:**

- [ ] Users with insufficient credits see a clear error message
- [ ] Error includes a link to the wallet page

---

## Phase 4: Polish

These are minor fixes. Can be done anytime after Phase 1.

### TASK-15: Remove Edit Fields no-op button

**File:** `client/src/pages/actors/useActorPageRender.tsx`

**Problem:** Line 127: `onClick={() => {}}` -- the Edit Fields button does
nothing.

**Fix:**

1. Remove the Edit Fields button from the actions list.
2. Users can edit actor properties via the output sections on the detail page.

**Acceptance:**

- [ ] No-op button removed from ActorPage

---

### TASK-16: Fix useActorPageRender actions to regenerate any layout

**File:** `client/src/pages/actors/useActorPageRender.tsx`

**Problem:** The actions bar only has a "Regenerate Headshot" button. Users
can't regenerate fullshot, expressions, etc. from the detail page.

**Fix:**

1. Remove the single "Regenerate Headshot" button.
2. Each output section already has its own Generate/Regenerate button
   inside `OutputSectionContent`. The actions bar should only have:
   - Duplicate
   - Submit to Marketplace
3. This avoids duplication and confusion.

**Acceptance:**

- [ ] Actions bar has only Duplicate and Submit to Marketplace
- [ ] Each output section has its own generate/regenerate controls

---

### TASK-17: Fix simulated mode placeholder images

**File:** `server/src/services/fal/api.ts`

**Problem:** When `FAL_KEY` is not set, `pollJob` returns a 1x1 pixel base64
placeholder image. This is invisible in the UI. The simulated mode should
produce a visible placeholder that clearly indicates "simulated".

**Fix:**

1. Replace the 1x1 pixel base64 in `pollJob` (line 156) with a visible
   placeholder image URL, e.g., a Picsum image:
   ```
   https://picsum.photos/seed/{seed}/400/500
   ```
2. Use the `seed` parameter from the request to make the image deterministic.
3. Add a small "SIMULATED" watermark text overlay in the frontend
   `ImageGrid` component when the image URL contains `picsum.photos`.

**Acceptance:**

- [ ] Simulated mode produces visible 400x500 placeholder images
- [ ] Images are deterministic (same seed = same image)
- [ ] Frontend shows "SIMULATED" indicator on placeholder images

---

## Execution Order

```
Phase 1 (Critical -- do first, all independent):
  TASK-1   Fix layout step key mismatch
  TASK-2   Add inline form to Stage 1
  TASK-3   Add validation in handleCreateActor
  TASK-4   Fix getOutputStatus for null outputs
  TASK-5   Show generate errors in Stage 2
  TASK-6   Fix editorial re-generation

Phase 2 (Complete the flow -- after Phase 1):
  TASK-7   Remove duplicate ActorFormFields from Stage 3
  TASK-8   Pass Stage 2 form values to Stage 3
  TASK-9   Fix characterSheetLookId stale closure
  TASK-10  Add error timeout for stale PENDING outputs

Phase 3 (Backend -- can parallel with Phase 2):
  TASK-11  Add system_prompts seed data
  TASK-12  Fix resolveModel workspaceId usage
  TASK-13  Refund credits on regenerate failure
  TASK-14  Handle insufficient credits (frontend part of TASK-5)

Phase 4 (Polish -- anytime after Phase 1):
  TASK-15  Remove Edit Fields no-op button
  TASK-16  Fix useActorPageRender actions
  TASK-17  Fix simulated mode placeholder images
```

## Verification

After all tasks:

- [ ] `cd client && npx tsc --noEmit` -- no type errors
- [ ] `cd client && npx vitest run` -- all tests pass
- [ ] `cd server && npx vitest run` -- all tests pass
- [ ] Manual flow test:
  1. Log in as admin
  2. Go to Actors > New Actor
  3. Select FORM mode, fill in age/gender/ethnicity
  4. Click Continue -- actor created, Stage 2 shows form + image grid
  5. Click Generate -- images appear (or PENDING then SUCCESS via worker)
  6. Select an image, click Confirm Selection
  7. Repeat for fullshot and expressions_3x4
  8. Stage 3 shows name field + read-only taxonomy summary
  9. Enter name, click Save Actor
  10. Actor detail page shows all outputs
  11. Regenerate headshot -- old output archived, new one generated
  12. Insufficient credits shows clear error with wallet link
