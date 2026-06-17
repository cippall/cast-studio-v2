# ADR-022: Notification System + Resend Email Integration

## Status

Accepted

## Context

Cast Studio v2 needs in-app notifications and email alerts for key events:

- Commission lifecycle: assigned, submitted, approved, changes requested
- Asset sharing: when an asset is shared with a client
- Generation pipeline: workflow completed, workflow failed

The system must:

1. Never break the triggering request if email fails (non-blocking)
2. Support both in-app (persisted in DB) and email channels
3. Use Resend for transactional email (3,000/month free tier)
4. Be testable without actual email sending

## Decision

### Architecture

Three-layer design following existing repo/service/routes pattern:

1. **`notification-repo.ts`** — DB access layer for `notifications` table
   - `createNotification()` — insert a notification row
   - `listNotifications()` — paginated, filterable by `is_read`
   - `markNotificationRead()` — single notification, scoped to recipient
   - `markAllNotificationsRead()` — bulk mark, scoped to recipient
   - `countUnreadNotifications()` — for badge count

2. **`notification-service.ts`** — Business logic + event dispatch
   - `dispatchNotification()` — creates in-app notification, then fires email (fire-and-forget)
   - Typed convenience helpers: `notifyCommissionAssigned()`, `notifyCommissionSubmitted()`, etc.
   - Email dispatch is fully async: `.catch()` prevents unhandled rejections
   - Recipient email resolved from DB if not provided

3. **`email-service.ts`** — Resend integration
   - Lazy-initializes Resend client from `RESEND_API_KEY` env var
   - Gracefully degrades when API key not configured (logs + skips)
   - Single HTML template with type badge, title, message
   - Subject lines built per notification type

### Integration Points

- **Commission service**: After assign/submit/approve/changes-requested transitions
  - Fire-and-forget: `.catch((err) => console.error(...))`
  - Recipient resolved from commission record (assignee_id or client_id)
- **Generation worker**: After SUCCESS/FAILED status updates
  - Looks up asset creator via `assets.creator_id`
  - Fire-and-forget pattern

### Non-blocking Guarantee

Email dispatch is always fire-and-forget:

```typescript
sendNotificationEmail({...}).catch((err) => {
  console.error('[notification-service] Email dispatch error:', err);
});
```

Even in-app notification failures are caught and logged — the calling request always succeeds.

### Notification Types

Seven types matching the spec:

- `COMMISSION_ASSIGNED` — Artist receives when Admin assigns
- `COMMISSION_SUBMITTED` — Client receives when Artist submits work
- `COMMISSION_APPROVED` — Artist receives when Client approves
- `COMMISSION_CHANGES_REQUESTED` — Artist receives when Client requests changes
- `ASSET_SHARED` — Grantee receives when asset is shared
- `WORKFLOW_COMPLETED` — Creator receives on generation success
- `WORKFLOW_FAILED` — Creator receives on generation failure

## Alternatives Considered

### Queue-based email (Bull/BullMQ)

Rejected: Overkill for current scale. Fire-and-forget with error logging is sufficient. Can be upgraded to a queue later if deliverability becomes critical.

### WebSocket push for real-time notifications

Rejected: Out of scope for T16. Polling the unread-count endpoint is sufficient for MVP. WebSocket can be added later.

### Separate notification preferences table

Rejected: No user-facing preference UI in current scope. All notifications fire for all users. Preferences can be added later.

## Consequences

- **Positive**: Non-blocking email never breaks requests; testable without Resend key
- **Positive**: Consistent with existing repo/service/routes pattern
- **Positive**: 7 typed convenience helpers make integration sites readable
- **Negative**: Fire-and-forget means no retry on email failure (acceptable for MVP)
- **Negative**: Worker DB lookup for creator_id adds a query per completed output (minimal overhead)

## Files Created

- `server/src/db/repositories/notification-repo.ts`
- `server/src/services/notification-service.ts`
- `server/src/services/email-service.ts`
- `server/src/routes/notifications.ts`
- `server/tests/notifications.test.ts`

## Files Modified

- `server/src/services/commission-service.ts` — notification dispatch on transitions
- `server/src/workers/generation-worker.ts` — notification on SUCCESS/FAILED
- `server/src/server.ts` — wire `/api/notifications` route
