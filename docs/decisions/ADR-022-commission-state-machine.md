# ADR-016: Commission Workflow State Machine

## Status

Accepted

## Date

2026-06-17

## Context

We need a structured commission workflow that connects Client workspace requests to Studio workspace execution. The commission lifecycle has multiple states and transitions that must be validated:

- States: REQUESTED → ASSIGNED → IN_PROGRESS → SUBMITTED → CHANGES_REQUESTED → APPROVED → CANCELLED
- Each transition has role-based permissions (who can perform it)
- Some transitions require specific fields (premium_cost, asset_ids for SUBMITTED)
- Some transitions must be performed by the commission owner (client) or assignee (artist)

The key challenge is enforcing valid state transitions while keeping the permission logic clear and testable.

## Decision

Implement a **declarative state machine** as a separate module (`commission-state-machine.ts`) with explicit transition rules, isolated from the business logic service layer.

### Architecture

1. **`commission-state-machine.ts`** — Pure logic module containing:
   - Status constants (COMMISSION_STATUSES enum)
   - TransitionRule interface defining from/to status, allowed roles, and constraints
   - TRANSITIONS array (the complete transition matrix)
   - Error classes (InvalidTransitionError, PermissionDeniedError)
   - Validation functions (findTransition, validateTransition)

2. **`commission-service.ts`** — Service orchestration:
   - Imports state machine for validation
   - Handles DB operations via repositories
   - Builds update fields (submitted_at, approved_at timestamps)
   - Links commission_assets on SUBMITTED status

3. **`commission-repo.ts`** + **`commission-asset-repo.ts`** — Data access:
   - CRUD operations for commissions and commission_assets
   - Workspace-isolated queries
   - Role-based list filters

4. **`commissions.ts` routes** — Express handlers:
   - Zod schema validation at boundary
   - Error type mapping (409 for invalid transitions, 403 for permissions)
   - Prepares data for T15 (premium unlock on APPROVED)

### Transition Matrix

| From              | To                | Roles                 | Constraints                                           |
| ----------------- | ----------------- | --------------------- | ----------------------------------------------------- |
| REQUESTED         | ASSIGNED          | ADMIN                 | —                                                     |
| REQUESTED         | CANCELLED         | ARTIST, CLIENT, ADMIN | —                                                     |
| ASSIGNED          | IN_PROGRESS       | ARTIST, ADMIN         | mustBeAssignee                                        |
| ASSIGNED          | CANCELLED         | ARTIST, CLIENT, ADMIN | —                                                     |
| IN_PROGRESS       | SUBMITTED         | ARTIST, ADMIN         | mustBeAssignee, requiresPremiumCost, requiresAssetIds |
| IN_PROGRESS       | CANCELLED         | ARTIST, CLIENT, ADMIN | —                                                     |
| SUBMITTED         | CHANGES_REQUESTED | CLIENT, ADMIN         | mustBeOwner                                           |
| SUBMITTED         | APPROVED          | CLIENT, ADMIN         | mustBeOwner                                           |
| SUBMITTED         | CANCELLED         | ARTIST, CLIENT, ADMIN | —                                                     |
| CHANGES_REQUESTED | IN_PROGRESS       | ARTIST, ADMIN         | mustBeAssignee                                        |
| CHANGES_REQUESTED | CANCELLED         | ARTIST, CLIENT, ADMIN | —                                                     |
| CANCELLED         | REQUESTED         | ADMIN                 | —                                                     |

### Test Strategy

- 40 tests covering all endpoints, permission scenarios, and state transitions
- Full lifecycle test: submit → assign → in_progress → submit → changes → in_progress → submit → approve
- Each transition rule is tested individually (valid and invalid paths)
- DB layer is mocked; state machine logic is exercised through the route handlers

## Alternatives Considered

### Inline if/else validation in service

- **Pros**: No separate module, fewer files
- **Rejected**: Would create a large, complex function with nested conditionals. Hard to verify the transition matrix is complete and correct.

### External state machine library (e.g., XState)

- **Pros**: Formal state machine with visual tooling
- **Rejected**: Adds dependency for ~12 transitions. Our state machine is simple enough for a declarative rules array.

### Enum type with transition map

- **Pros**: Type-safe, compiler-enforces transitions
- **Rejected**: TypeScript type-level state machines are verbose and harder to debug than runtime arrays.

## Consequences

- **Positive**: Transition rules are declarative and easy to audit. Adding a new transition is a single array entry.
- **Positive**: 40 passing tests provide good coverage of the state machine.
- **Positive**: The APPROVED transition has a placeholder for premium unlock (T15) — the wallet deduction and client_id setting will be wired in a follow-up task.
- **Negative**: Route error handling has some duplication (error type checks in multiple handlers). Acceptable for now as the number of handlers is small.
- **Technical debt**: The `studio_workspace_id` is currently set to the client's workspace_id. Multi-workspace routing (finding the right studio) is future work.
