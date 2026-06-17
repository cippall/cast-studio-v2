# ADR-023: Workflow Pre-Flight Escrow Design

## Status

Accepted

## Date

2026-06-17

## Context

Cast Studio v2 needs to support autonomous AI agents that execute multi-step generation workflows via API. Agents must be able to start a workflow, monitor its progress, and cancel it. Since generation costs money (fal.ai credits), we need a mechanism to ensure agents have sufficient funds before starting a workflow, and to refund unused funds when a workflow is cancelled or fails.

Key requirements:

- Agents initiate workflows via API key auth only (no session auth)
- Each workflow has multiple steps, each with a generation cost
- Max escrow is calculated upfront from step definitions
- Unconsumed escrow must be auto-refunded on cancellation
- Workflow status must be queryable

## Decision

Implement a pre-flight escrow system with three phases:

### 1. Escrow Hold (on start)

When an agent starts a workflow via `POST /api/workflows/start`:

- Calculate max escrow from steps using a task cost map (e.g., actor_headshot = 0.10 credits)
- Deduct the full escrow amount from the agent's wallet balance
- Create an `ESCROW_HOLD` ledger entry (negative amount)
- Create a workflow record with status `RUNNING` and all steps as `PENDING`

### 2. Step Execution (background worker)

A background worker (`workflow-worker.ts`) polls for `RUNNING` workflows:

- Processes the first `PENDING` step in each workflow
- Marks step as `SUCCESS` and records outputs
- Creates a `CHARGE` ledger entry for the step cost
- Updates `consumed_credits` on the workflow
- When all steps complete, marks workflow `COMPLETED` or `FAILED`

### 3. Escrow Refund (on cancel)

When an agent cancels via `POST /api/workflows/:id/cancel`:

- Calculate refund as `total_escrow - consumed_credits`
- Credit the refund back to the wallet
- Create an `ESCROW_REFUND` ledger entry (positive amount, linked to workflow)
- Mark workflow as `FAILED` with error_code `CANCELLED`

### Data Model

Steps are stored as JSONB on the `workflows` table (new `steps` column). This avoids a separate join table while supporting step-level status tracking. The `steps` column stores an array of `{ task, model, status, outputs, prompt_recipe?, options? }`.

### Cost Model

Fixed cost per task type, multiplied by `num_outputs` from step options:

- actor_headshot: 0.10
- actor_fullshot: 0.10
- actor_expressions: 0.05
- actor_character_sheet: 0.05
- actor_editorial: 0.10
- look_generation: 0.05
- fashion_item_generation: 0.05
- reference_extraction: 0.02
- default: 0.05

## Alternatives Considered

### Per-step charging (no escrow)

Charge each step's cost as it executes, without upfront escrow.

- **Pros**: Simpler, no hold/refund logic
- **Cons**: Agent could run out of credits mid-workflow, leaving it in a partial state
- **Rejected**: Violates the pre-flight escrow requirement from the spec

### Separate workflow_steps table

Normalize steps into a separate `workflow_steps` table with FK to workflows.

- **Pros**: Cleaner relational model, easier querying
- **Cons**: Requires a new table + migration; steps are always accessed with their workflow (no independent queries)
- **Rejected**: JSONB column is simpler for this access pattern; can normalize later if query needs change

### Store steps in a separate JSON file or external storage

- **Pros**: Smaller DB rows
- **Cons**: Adds operational complexity, harder to query/update atomically
- **Rejected**: JSONB in PostgreSQL is the right balance of flexibility and simplicity

## Consequences

- Wallet balance is reduced immediately on workflow start (escrow hold), not on step execution
- The `workflows` table gains a `steps` JSONB column (migration 003)
- Ledger entries provide full audit trail: `ESCROW_HOLD` → `CHARGE` (per step) → `ESCROW_REFUND` (on cancel)
- Cancel is only allowed for `RUNNING` workflows (409 for COMPLETED/FAILED)
- Only the agent who owns the workflow can view or cancel it (403 for other agents)
- The workflow worker is separate from the generation worker (which handles fal.ai polling)
