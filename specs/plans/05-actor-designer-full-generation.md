# Plan: Actor Designer Full Generation Pipeline

## Objective

Make the Actor Designer work end-to-end with real models from the database and real prompts — no mockups, no placeholders. User creates an actor, generates headshot/fullshot/expressions, and gets real fal.ai images back.

## Current State

- UI is fully built (3-stage wizard)
- Backend routes exist for create, generate, regenerate
- Models and prompts are seeded in DB
- fal.ai integration works (submit + poll)
- Generation worker polls every 5s

## Gaps to Close

### Gap 1: Models table `task` column uses wrong values

**Problem:** `task` values are `text_to_image`, `image_to_image` etc. (model types), not Cast Studio tasks like `actor_headshot`.
**Fix:** Update seed data to use proper task values. Each model should map to a specific Cast Studio task.

### Gap 2: `DEFAULT_MODEL` mismatch

**Problem:** `DEFAULT_MODEL = 'flux-pro'` but DB has `fal-ai/flux-pro`.
**Fix:** Change `DEFAULT_MODEL` to `'fal-ai/flux-pro'` to match DB.

### Gap 3: `resolvePrompt` doesn't build `identity_description`

**Problem:** Prompt templates use `{{identity_description}}` but no code builds this from form data or text prompt.
**Fix:** Build a human-readable `identity_description` string from form fields or use the raw text prompt.

### Gap 4: Client doesn't poll for generation results

**Problem:** After triggering generation, client shows PENDING forever. No polling.
**Fix:** Add polling in `useActorDesignerState` to refetch actor outputs every 3s until all are SUCCESS/FAILED.

### Gap 5: `regenerate.ts` missing `form_data` in fal.ai call

**Problem:** `form_data` not passed to `submitTextToImage` in regenerate.
**Fix:** Add `form_data: options.form_data` to the submit call.

### Gap 6: `regenerateSchema` missing layouts

**Problem:** Only allows `headshot`, `fullshot`, `expressions_3x4`.
**Fix:** Add `character_sheet` and `editorial`.

### Gap 7: `onConnected` callback not working (Models page)

**Problem:** After saving fal.ai key, page doesn't transition to model browser.
**Fix:** Already fixed with `localConnected` state.

## Implementation Order

### Task 1: Fix model seed data

- Update `models` table seed to use proper `task` values
- Each model maps to a Cast Studio task

### Task 2: Fix `DEFAULT_MODEL` constant

- Change from `'flux-pro'` to `'fal-ai/flux-pro'`

### Task 3: Fix `resolvePrompt` to build `identity_description`

- Build human-readable description from form data
- Use raw text prompt for TEXT mode

### Task 4: Fix `regenerate.ts` missing `form_data`

- Add `form_data` to `submitTextToImage` call

### Task 5: Fix `regenerateSchema` missing layouts

- Add `character_sheet` and `editorial`

### Task 6: Add client-side generation polling

- Poll actor outputs every 3s
- Update UI when status changes

### Task 7: End-to-end test

- Create actor → generate headshot → verify real image appears

## Success Criteria

- [ ] Creating an actor with FORM entry works
- [ ] Generating headshot produces a real fal.ai image (not placeholder)
- [ ] Generating fullshot produces a real fal.ai image
- [ ] Generating expressions produces a real fal.ai image
- [ ] Regenerate works and produces new images
- [ ] All layouts show live status (PENDING → SUCCESS)
- [ ] Models page shows fal.ai models after connecting
