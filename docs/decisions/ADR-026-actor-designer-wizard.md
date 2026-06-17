# ADR-026: Actor Designer Wizard Pattern

## Status

Accepted

## Date

2026-06-17

## Context

The Actor Designer is the most complex frontend flow in Cast Studio v2. It requires a 3-stage wizard: entry method selection, iterative image generation with selection, and name/properties save. The wizard must handle async generation (PENDING -> SUCCESS/FAILED), step locking, and navigation between stages.

## Decision

Implemented the Actor Designer as a single-page wizard with 3 stages managed by local `useState`:

1. **Stage 1 (Entry Method)**: Radio-group cards for 4 entry methods (Form, Reference, Text, Randomize). On submit, creates the actor via `POST /api/actors` and transitions to Stage 2.

2. **Stage 2 (Iterate & Select)**: Horizontal stepper (Headshot -> Fullshot -> Expressions). Each step shows a 2x2/4-column grid of generated options. User selects one, confirms, and advances. Only the selected output is saved as SUCCESS. Regenerate replaces the current grid. Steps lock after confirmation.

3. **Stage 3 (Name & Save)**: Form with actor name and taxonomy fields. On save, PATCHes the actor and redirects to the Actor Page.

### Sub-component extraction

The main `ActorDesigner` component was decomposed into:

- `Stage1`: Entry method selection
- `ImageGrid`: Reusable selectable image grid
- `Stage3`: Name/properties form

This keeps the main wizard orchestrator under 200 lines while sub-components handle their own concerns.

### Generation polling

The `usePollActorGeneration` hook polls `GET /api/actors/:id` every 2 seconds when any output has PENDING status. On each poll, it updates the actor cache via `queryClient.setQueryData`, which triggers re-renders across all components using the actor data.

## Alternatives Considered

### Multi-route wizard (separate pages per stage)

- Pros: Clean URL for each stage, browser back button works naturally
- Cons: Requires persisting intermediate state to server or localStorage; more complex navigation logic; loses in-memory selection state on navigation
- Rejected: Single-page approach is simpler for this flow. State is ephemeral until save.

### State machine (XState or similar)

- Pros: Formal state transitions, prevents invalid states
- Cons: Additional dependency, over-engineered for 3 stages
- Rejected: `useState` with clear stage transitions is sufficient. Can migrate to XState if the wizard grows.

### Server-side wizard state

- Pros: Survives page refresh, shareable links to specific stages
- Cons: Requires additional API endpoints, more backend complexity
- Rejected: MVP doesn't need refresh resilience. Can add later if needed.

## Consequences

- Actor Designer is a single large file (621 lines) but with clear sub-component boundaries
- Generation polling is optimistic: it updates the cache on each poll response, so the UI reflects the latest server state without full refetches
- The `GenerationStatus` component is reusable across all generation contexts (Actor Page, Look Designer, Fashion Item Creator)
- The `useActorGeneration` hook pattern (generate/regenerate/poll) is reusable for Looks and Fashion Items
