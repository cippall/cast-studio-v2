# ADR-027: Commission UI Patterns

## Status

Accepted

## Context

Task 26 required building the full commission UI for Cast Studio v2. The commission workflow connects three roles (Client, Artist, Admin) through a multi-step process: request → assign → execute → review → approve → unlock. Each role needs a different view of the same data, with different actions available at each status.

The UI must handle:

- Role-based list views with status filtering
- Dynamic form rendering from admin-defined templates
- Status transitions with validation
- Premium unlock with wallet balance check
- Cache invalidation across role boundaries

## Decision

### 1. Role-Based List Views

Each role sees a different set of status tabs in the commission list:

- **Client**: All, In Review (SUBMITTED), Changes Requested, Approved
- **Artist**: All, Assigned, In Progress, Submitted
- **Admin**: All, Requested, Assigned, In Progress, Submitted, Approved, Cancelled

Implemented as a single `CommissionsList` component with role-conditional tab configuration. The component fetches from `GET /api/commissions` which already filters by role on the backend.

### 2. Component Decomposition

The `CommissionDetail` page was decomposed into smaller components to stay under the 200-line file limit:

- `BriefSection` — renders brief key-value pairs
- `ClientActions` — Approve & Unlock / Request Changes buttons
- `ArtistActions` — Start Working / Submit Work buttons
- `AdminActions` — Assign to Artist/Agent button
- `PremiumUnlockDialog` — confirmation dialog with cost + balance display

Each action component checks the commission status and user role to determine visibility.

### 3. Premium Unlock Flow

The premium unlock uses a two-step confirmation:

1. Client clicks "Approve & Unlock" → opens `PremiumUnlockDialog`
2. Dialog shows premium cost, current balance, and balance after
3. If balance is insufficient, shows warning and disables confirm button
4. On confirm → `PATCH /api/commissions/:id/status` with `{ status: "APPROVED" }`
5. Backend handles wallet deduction and asset ownership transfer (T15)

### 4. Dynamic Form for New Commission

The `NewCommission` form uses `react-hook-form` with a flat `brief` record structure. Dynamic fields from the admin template are rendered using `form.register('brief.${fieldKey}')`. Select fields use `form.setValue` with the full brief object since base-ui Select's `onValueChange` doesn't integrate directly with react-hook-form's nested path types.

Zod validation was not used for the dynamic form due to Zod 4 type incompatibilities with react-hook-form's resolver types. Manual validation (title required) is handled in the submit handler.

### 5. React Query Cache Invalidation

All commission mutations invalidate both the list query (`['commissions']`) and the detail query (`['commissions', id]`) on success. This ensures that:

- After creating a commission, the list refreshes
- After status change, both the list and detail views update
- After premium unlock, the detail view shows the new status

### 6. Status Badge Colors

Consistent color mapping across all commission views:

- REQUESTED: yellow
- ASSIGNED: blue
- IN_PROGRESS: purple
- SUBMITTED: cyan
- CHANGES_REQUESTED: orange
- APPROVED: green
- CANCELLED: gray

## Alternatives Considered

1. **Separate list components per role**: Rejected — too much shared logic (loading, error, empty states, card rendering). Role-conditional tabs in one component is simpler.

2. **Zod for dynamic form validation**: Rejected — Zod 4 type system is incompatible with react-hook-form's resolver types. Manual validation is sufficient for MVP.

3. **Inline action buttons in list cards**: Rejected — moved actions to the detail page to keep list cards clean. Only "View" and role-specific quick actions (Submit Work, Assign) appear in the list.

## Consequences

- Positive: Single commission list component reduces code duplication
- Positive: Decomposed detail components are independently testable
- Positive: Premium unlock dialog provides clear cost transparency
- Negative: Dynamic form lacks field-level validation (MVP trade-off)
- Negative: Admin assign dialog is a placeholder — needs artist selector in future work

## Files Created

- `client/src/hooks/useCommissions.ts` — commission API hooks
- `client/src/components/ui/form.tsx` — React Hook Form integration
- `client/src/pages/commissions/CommissionsList.tsx` — role-based list
- `client/src/pages/commissions/NewCommission.tsx` — dynamic form
- `client/src/pages/commissions/CommissionDetail.tsx` — detail page
- `client/src/pages/commissions/PremiumUnlockDialog.tsx` — unlock confirmation
- `client/src/pages/commissions/BriefSection.tsx` — brief display
- `client/src/pages/commissions/ClientActions.tsx` — client action buttons
- `client/src/pages/commissions/ArtistActions.tsx` — artist action buttons
- `client/src/pages/commissions/AdminActions.tsx` — admin action buttons
