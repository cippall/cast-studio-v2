# ADR-019: Marketplace Submission + Admin Review Flow

## Status

Accepted

## Date

2026-06-17

## Context

Artists need a way to submit their generated assets (actors, looks, fashion items) for marketplace listing. Admins need to review submissions, approve them with a price, or reject them. The flow must enforce that only assets with all required outputs in SUCCESS state can be submitted, and approved assets become frozen (non-editable) per ADR-007.

## Decision

### Submission Flow (Artist)

1. Artist calls `POST /api/marketplace/submit` with `{ asset_id }`.
2. Service validates:
   - Asset exists in artist's workspace
   - Artist is the creator (or admin)
   - Asset is not already PENDING or APPROVED
   - All required outputs are SUCCESS (actor: headshot, fullshot, expressions_3x4, character_sheet, editorial; look: look_image; fashion_item: item_image)
3. Sets `assets.marketplace_status = 'MARKETPLACE_PENDING'`.
4. Returns 201 with submission details.

### Admin Review Flow

1. Admin calls `GET /api/admin/marketplace/submissions` to see all pending submissions with output previews.
2. Admin calls `POST /api/admin/marketplace/submissions/:assetId/approve` with `{ price_credits }`.
   - Sets `marketplace_status = 'MARKETPLACE_APPROVED'` and `is_marketplace_frozen = TRUE`
   - Creates a `marketplace_listings` row
   - Notifies the artist
3. Admin calls `POST /api/admin/marketplace/submissions/:assetId/reject`.
   - Sets `marketplace_status = 'MARKETPLACE_REJECTED'`
   - Notifies the artist

### Architecture

- **Service**: `marketplace-service.ts` — business logic for submit, list, approve, reject
- **Routes**: `routes/marketplace.ts` (Artist) + `routes/admin/marketplace.ts` (Admin)
- **Notifications**: Uses existing `dispatchNotification` from `notification-service.ts`
- **Workspace isolation**: All queries filter by workspace_id; admin bypass for review endpoints

### Validation Rules

- Actor assets require 5 outputs: headshot, fullshot, expressions_3x4, character_sheet, editorial
- Look assets require: look_image
- Fashion item assets require: item_image
- Missing outputs return 409 with specific list of what's missing

## Alternatives Considered

### Single endpoint for submit + approve

- Rejected: Separation of concerns. Artist and admin actions are distinct operations with different permissions.

### Auto-approve on submission

- Rejected: Admin must review quality and set pricing. Auto-approve would bypass quality control.

### Store submission history in separate table

- Rejected (for now): Using `marketplace_status` column on assets is sufficient. A separate history table can be added later if audit trail beyond current status is needed.

## Consequences

- Marketplace submission is a two-step process: artist submits, admin approves
- Approved assets are frozen (ADR-007 freeze mechanism applies)
- Rejected assets can be resubmitted after editing
- Notification service fires on approve/reject (non-blocking)
- All 5 required actor outputs must be SUCCESS — partial submissions are rejected with specific missing outputs listed
