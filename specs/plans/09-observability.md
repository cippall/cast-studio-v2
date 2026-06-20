# Implementation Plan: Observability & Instrumentation

## Overview

Add structured logging, metrics, health checks, and error handling to Cast Studio v2. This plan covers all 20 findings from the observability audit (6 critical, 6 high, 4 medium, 4 low priority). The goal is to make production behavior visible and diagnosable without reading source code.

## Architecture Decisions

- **Logger:** Use `pino` for the server (JSON structured logging, fast, Express middleware ecosystem). Client-side: structured `console.log` wrapper that posts errors to a server endpoint.
- **Request ID:** Generate `X-Request-ID` at the Express edge, propagate through all log calls. Client generates its own for frontend-only errors.
- **Metrics:** Start with manual counters/histograms (no Prometheus dependency yet). Track RED for external calls (fal.ai, Stripe, DB) and business-critical paths (generation, wallet, marketplace).
- **Health:** Extend `/health` with a `/health/detailed` endpoint for worker status and queue depth.
- **No OpenTelemetry yet:** The skill recommends it, but for a single-service app, structured logs + manual metrics give 80% of the value at 10% of the cost. Add OTel when the service count grows.

## Task List

### Phase 1: Structured Logging Foundation

- [ ] Task 1: Install pino + pino-http, create logger module
- [ ] Task 2: Add request ID middleware
- [ ] Task 3: Replace console.error in auth routes
- [ ] Task 4: Replace console.error in generation routes + generate.ts + regenerate.ts
- [ ] Task 5: Replace console.error in wallet routes + wallet-service + wallet-repo
- [ ] Task 6: Replace console.error in marketplace routes + purchase.ts
- [ ] Task 7: Replace console.error in commission routes + commission-service
- [ ] Task 8: Replace console.error in collection routes + collection-service
- [ ] Task 9: Replace console.error in remaining routes (actors, looks, fashion-items, upload, admin, workflows, sharing, notifications, apiKeys, workspaces, accounts, activity, dashboard)
- [ ] Task 10: Replace console.error in both workers (generation-worker, workflow-worker)

### Checkpoint: Phase 1

- [ ] `grep -r "console\.error" server/src/` returns zero results
- [ ] Server starts and logs are valid JSON
- [ ] Every log line includes `requestId` where applicable

### Phase 2: Critical Bug Fixes (Observability-Related)

- [ ] Task 11: Add credit refund on fal.ai submission failure
- [ ] Task 12: Add credit refund in generation worker on FAILED status
- [ ] Task 13: Add row-level lock (`FOR UPDATE`) in wallet credit reservation
- [ ] Task 14: Add idempotency guard on marketplace purchase
- [ ] Task 15: Add structured error logging to Stripe webhook handler

### Checkpoint: Phase 2

- [ ] All wallet-related tests pass
- [ ] Generation failure scenario: credits are refunded (verified via test)
- [ ] Marketplace purchase: concurrent requests don't double-charge (verified via test)

### Phase 3: Metrics & Health

- [ ] Task 16: Add metrics module (counters + histograms)
- [ ] Task 17: Instrument fal.ai calls (submit/poll latency, error rate)
- [ ] Task 18: Instrument wallet operations (charge/refund counts, insufficient credits)
- [ ] Task 19: Instrument generation job lifecycle (pending→success/failed duration, failure rate)
- [ ] Task 20: Add `/health/detailed` endpoint (worker status, queue depth, last poll time)

### Checkpoint: Phase 3

- [ ] `/health/detailed` returns worker status
- [ ] Metrics are exposed and queryable
- [ ] fal.ai error rate is trackable

### Phase 4: Client-Side Error Handling

- [ ] Task 21: Add React Error Boundary at AppShell level
- [ ] Task 22: Add global `unhandledrejection` handler on client
- [ ] Task 23: Add React Query global error handler (401 → redirect, 5xx → toast)
- [ ] Task 24: Preserve HTTP status code in API client interceptor

### Checkpoint: Phase 4

- [ ] Component render errors show ErrorState instead of white screen
- [ ] 401 responses redirect to login automatically
- [ ] Network errors show user-friendly messages

### Phase 5: Resilience & Low-Priority Fixes

- [ ] Task 25: Add graceful shutdown (SIGTERM/SIGINT handlers)
- [ ] Task 26: Fix DB pool error handler (log + attempt reconnect, don't kill process)
- [ ] Task 27: Add JSON body size limit
- [ ] Task 28: Make session secret required in production (fail to start if missing)
- [ ] Task 29: Add worker circuit breaker (backoff on repeated failures)

### Checkpoint: Phase 5

- [ ] Server shuts down gracefully (workers finish current batch, connections drain)
- [ ] DB pool error doesn't kill the process
- [ ] Server refuses to start in production without SESSION_SECRET

## Risks and Mitigations

| Risk                                           | Impact | Mitigation                                                                             |
| ---------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| Adding row lock to wallet causes deadlocks     | High   | Always lock in consistent order (wallet first, then listing). Keep transactions short. |
| Credit refund on failure creates double-refund | High   | Check ledger for existing REFUND entry before issuing new one.                         |
| pino dependency adds bundle size               | Low    | Server-only dependency, no client impact.                                              |
| Graceful shutdown delays container restart     | Medium | Set shutdown timeout to 10s, then force exit.                                          |

## Open Questions

- Should client-side errors be posted to a server endpoint for centralized tracking? (Recommendation: yes, add `POST /api/client-errors` in Phase 4)
- Should metrics be exposed via an endpoint or pushed to a collector? (Recommendation: endpoint for now, add collector later)

---

## Detailed Task Specifications

### Task 1: Install pino + pino-http, create logger module

**Description:** Install pino and pino-http as server dependencies. Create `server/src/logger.ts` that exports a configured pino instance with JSON output, log level from `LOG_LEVEL` env var (default `info`), and pretty-printing in development.

**Acceptance criteria:**

- [ ] `pino` and `pino-http` are in server/package.json dependencies
- [ ] `server/src/logger.ts` exports a `logger` instance
- [ ] Log level defaults to `info`, overridable via `LOG_LEVEL`
- [ ] In `NODE_ENV=development`, logs are pretty-printed
- [ ] In production, logs are JSON lines

**Verification:**

- [ ] `cd server && npm install` succeeds
- [ ] Server starts and first log line is valid JSON

**Dependencies:** None

**Files likely touched:**

- `server/package.json`
- `server/src/logger.ts` (new)

**Estimated scope:** Small (1-2 files)

---

### Task 2: Add request ID middleware

**Description:** Add Express middleware that generates a `X-Request-ID` UUID if not present in the incoming header. Attach the ID to `req.requestId` and include it in every log line via pino child logger.

**Acceptance criteria:**

- [ ] Middleware reads `X-Request-ID` header or generates UUID v4
- [ ] `req.requestId` is available in all route handlers
- [ ] Response includes `X-Request-ID` header
- [ ] All log lines via `req.log` include `requestId` field

**Verification:**

- [ ] `curl -i http://localhost:3001/health` returns `X-Request-ID` header
- [ ] Log lines contain `requestId` field

**Dependencies:** Task 1

**Files likely touched:**

- `server/src/server.ts`
- `server/src/logger.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 3: Replace console.error in auth routes

**Description:** Replace all `console.error()` calls in `server/src/routes/auth.ts` with structured logger calls using `req.log` (pino child logger with requestId).

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in auth.ts
- [ ] Each log call includes: event name (e.g., `auth_login_failed`), requestId, relevant IDs (userId, email)
- [ ] Error objects log `err.message` and `err.stack` (not `[object Object]`)

**Verification:**

- [ ] `grep -r "console\.error" server/src/routes/auth.ts` returns nothing
- [ ] Login with wrong password produces structured log line

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/auth.ts`

**Estimated scope:** Small (1 file)

---

### Task 4: Replace console.error in generation routes + generate.ts + regenerate.ts

**Description:** Replace all `console.error()` in the generation pipeline: routes, generate.ts, regenerate.ts, generation-service.ts, status.ts, resolve-model.ts, generation-constants.ts.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in generation files
- [ ] Log events include: `event`, `requestId`, `actorId`, `outputId`, `model`, `errorCode`
- [ ] fal.ai submission errors log with `event: "fal_submit_error"` including model and prompt length

**Verification:**

- [ ] `grep -r "console\.error" server/src/services/generation/` returns nothing
- [ ] Triggering a generation error produces structured log with actorId

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/actors.ts` (generate/regenerate handlers)
- `server/src/services/generation/generate.ts`
- `server/src/services/generation/regenerate.ts`
- `server/src/services/generation-service.ts`
- `server/src/services/generation/status.ts`
- `server/src/services/generation/resolve-model.ts`

**Estimated scope:** Medium (3-5 files)

---

### Task 5: Replace console.error in wallet routes + wallet-service + wallet-repo

**Description:** Replace all `console.error()` in wallet-related files. Add structured logging for balance checks, charges, and refunds.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in wallet files
- [ ] Wallet operations log with: `event`, `requestId`, `walletId`, `accountId`, `amount`, `balance_before`, `balance_after`
- [ ] Insufficient credits logs with `event: "insufficient_credits"` including balance and required

**Verification:**

- [ ] `grep -r "console\.error" server/src/routes/wallet.ts` returns nothing
- [ ] `grep -r "console\.error" server/src/services/wallet-service.ts` returns nothing
- [ ] Attempting to generate with insufficient credits produces structured log

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/wallet.ts`
- `server/src/services/wallet-service.ts`
- `server/src/db/repositories/wallet-repo.ts`

**Estimated scope:** Medium (3-5 files)

---

### Task 6: Replace console.error in marketplace routes + purchase.ts

**Description:** Replace all `console.error()` in marketplace files. Add structured logging for purchase flow.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in marketplace files
- [ ] Purchase events log with: `event`, `requestId`, `listingId`, `buyerId`, `sellerId`, `priceCredits`
- [ ] Failed purchases log reason (already purchased, insufficient credits, self-purchase)

**Verification:**

- [ ] `grep -r "console\.error" server/src/routes/marketplace.ts` returns nothing
- [ ] `grep -r "console\.error" server/src/services/marketplace/purchase.ts` returns nothing

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/marketplace.ts`
- `server/src/services/marketplace/purchase.ts`
- `server/src/services/marketplace/index.ts`

**Estimated scope:** Medium (3-5 files)

---

### Task 7: Replace console.error in commission routes + commission-service

**Description:** Replace all `console.error()` in commission files. Add structured logging for state transitions.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in commission files
- [ ] State transitions log with: `event`, `requestId`, `commissionId`, `fromStatus`, `toStatus`, `actorId`
- [ ] Permission denied logs with `event: "commission_permission_denied"`

**Verification:**

- [ ] `grep -r "console\.error" server/src/routes/commissions.ts` returns nothing
- [ ] `grep -r "console\.error" server/src/services/commission-service.ts` returns nothing

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/commissions.ts`
- `server/src/services/commission-service.ts`
- `server/src/services/commission-state-machine.ts`

**Estimated scope:** Medium (3-5 files)

---

### Task 8: Replace console.error in collection routes + collection-service

**Description:** Replace all `console.error()` in collection files.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in collection files
- [ ] Log events include: `event`, `requestId`, `collectionId`, `accountId`, `action` (create/update/delete/addItem/removeItem)

**Verification:**

- [ ] `grep -r "console\.error" server/src/routes/collections.ts` returns nothing
- [ ] `grep -r "console\.error" server/src/services/collection-service.ts` returns nothing

**Dependencies:** Task 2

**Files likely touched:**

- `server/src/routes/collections.ts`
- `server/src/services/collection-service.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 9: Replace console.error in remaining routes

**Description:** Replace all `console.error()` in the remaining route files: actors.ts (non-generation parts), looks.ts, fashion-items.ts, upload.ts, admin/admin.ts, admin/\*.ts, workflows.ts, sharing.ts, notifications.ts, apiKeys.ts, workspaces.ts, accounts.ts, activity.ts, dashboard.ts, health.ts.

**Acceptance criteria:**

- [ ] `grep -r "console\.error" server/src/routes/` returns zero results
- [ ] Each route file uses `req.log` for error logging
- [ ] Consistent event naming: `{domain}_{action}_{outcome}` (e.g., `actor_create_failed`, `look_list_error`)

**Verification:**

- [ ] Full grep across routes directory returns zero

**Dependencies:** Task 2

**Files likely touched:**

- All files in `server/src/routes/` and `server/src/routes/admin/`

**Estimated scope:** Large (5+ files, but mechanical changes)

---

### Task 10: Replace console.error in both workers

**Description:** Replace all `console.error()` in generation-worker.ts and workflow-worker.ts. Workers don't have `req`, so use the base logger with worker-specific context.

**Acceptance criteria:**

- [ ] Zero `console.error` calls remain in worker files
- [ ] Log lines include: `worker: "generation" | "workflow"`, `event`, `outputId`/`workflowId`
- [ ] Worker start/stop events logged at `info` level

**Verification:**

- [ ] `grep -r "console\.error" server/src/workers/` returns nothing
- [ ] Worker start produces structured log line

**Dependencies:** Task 1

**Files likely touched:**

- `server/src/workers/generation-worker.ts`
- `server/src/workers/workflow-worker.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 11: Add credit refund on fal.ai submission failure

**Description:** In `generate.ts` and `regenerate.ts`, when `fal.submitTextToImage()` fails, call `refundCredits()` to return the deducted credits to the user's wallet. Log the refund with structured event.

**Acceptance criteria:**

- [ ] When fal.ai submission throws, credits are refunded via `refundCredits()`
- [ ] Refund creates a `REFUND` ledger entry
- [ ] Log line includes: `event: "generation_credit_refund"`, `outputId`, `amount`, `reason: "fal_submit_failure"`
- [ ] Test: mock fal.ai failure, verify wallet balance is unchanged after the operation

**Verification:**

- [ ] New test in `server/tests/generation.test.ts` passes
- [ ] Manual: set FAL_KEY to invalid value, trigger generation, verify balance unchanged

**Dependencies:** Task 4 (structured logging in generate.ts)

**Files likely touched:**

- `server/src/services/generation/generate.ts`
- `server/src/services/generation/regenerate.ts`
- `server/tests/generation.test.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 12: Add credit refund in generation worker on FAILED status

**Description:** In `generation-worker.ts`, when `pollJob()` returns `FAILED`, call `refundCredits()` before updating the output status. The notification message currently lies about refunds — make it truthful by actually refunding.

**Acceptance criteria:**

- [ ] When fal.ai job status is FAILED, credits are refunded
- [ ] Refund creates a `REFUND` ledger entry
- [ ] Notification message is updated to only say "credits have been refunded" when a refund actually happened
- [ ] Log line includes: `event: "generation_credit_refund"`, `outputId`, `amount`, `reason: "fal_job_failed"`

**Verification:**

- [ ] New test in generation tests passes
- [ ] Worker log shows refund event on failed job

**Dependencies:** Task 10 (structured logging in worker)

**Files likely touched:**

- `server/src/workers/generation-worker.ts`
- `server/src/db/repositories/wallet-repo.ts` (if refundCredits needs workspaceId fix)

**Estimated scope:** Small (1-2 files)

---

### Task 13: Add row-level lock in wallet credit reservation

**Description:** In `wallet-repo.ts`, modify `reserveCreditsForGeneration()` to pass `forUpdate: true` to `findWallet()` so the wallet row is locked during the read-then-write. This prevents concurrent requests from double-spending.

**Acceptance criteria:**

- [ ] `reserveCreditsForGeneration()` uses `FOR UPDATE` when reading wallet
- [ ] Concurrent requests serialize on the wallet row (no double-charge)
- [ ] Log line includes: `event: "wallet_credits_reserved"`, `walletId`, `amount`, `balance_before`, `balance_after`

**Verification:**

- [ ] New test: two concurrent generation requests on same wallet, verify only one succeeds if balance is insufficient for both
- [ ] Existing wallet tests still pass

**Dependencies:** Task 5 (structured logging in wallet-repo)

**Files likely touched:**

- `server/src/db/repositories/wallet-repo.ts`
- `server/tests/wallet.test.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 14: Add idempotency guard on marketplace purchase

**Description:** In `purchase.ts`, add a unique constraint check on the ledger entry for the purchase. If a ledger entry already exists for the same `(listingId, buyerId)` pair within the transaction, skip the deduction.

**Acceptance criteria:**

- [ ] Before deducting credits, check if a `CHARGE` ledger entry already exists for this listing+buyer combo
- [ ] If duplicate detected, return existing result instead of re-deducting
- [ ] Log line includes: `event: "marketplace_purchase_duplicate_skipped"` or `event: "marketplace_purchase_completed"`

**Verification:**

- [ ] New test: same purchase request sent twice, verify only one charge
- [ ] Existing marketplace tests still pass

**Dependencies:** Task 6 (structured logging in purchase.ts)

**Files likely touched:**

- `server/src/services/marketplace/purchase.ts`
- `server/tests/marketplace.test.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 15: Add structured error logging to Stripe webhook handler

**Description:** In `wallet.ts` webhook handler, replace the generic catch with structured logging that includes the error type, Stripe event ID, and processing stage.

**Acceptance criteria:**

- [ ] Webhook errors log with: `event: "stripe_webhook_error"`, `stripeEventId`, `errorType`, `stage`
- [ ] Successful webhook processing logs with: `event: "stripe_webhook_processed"`, `stripeEventId`, `amount`, `workspaceId`
- [ ] Idempotent re-processing logs with: `event: "stripe_webhook_duplicate_skipped"`

**Verification:**

- [ ] Trigger webhook with invalid signature, verify structured error log
- [ ] Trigger webhook twice for same event, verify second is skipped with log

**Dependencies:** Task 5 (structured logging in wallet routes)

**Files likely touched:**

- `server/src/routes/wallet.ts`
- `server/src/services/wallet-service.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 16: Add metrics module

**Description:** Create `server/src/metrics.ts` with simple in-memory counters and histograms. No external dependency — plain TypeScript. Expose via a `/metrics` endpoint.

**Acceptance criteria:**

- [ ] `metrics.ts` exports: `counter(name, labels?)`, `histogram(name, labels?, value)`, `getMetrics()`
- [ ] `/metrics` endpoint returns JSON with all counters and histogram percentiles (p50, p95, p99)
- [ ] Metrics are scoped by: `method`, `route`, `status_class` (for HTTP), `model` (for fal.ai), `type` (for wallet)

**Verification:**

- [ ] `curl http://localhost:3001/metrics` returns valid JSON
- [ ] Making a request increments the counter

**Dependencies:** None

**Files likely touched:**

- `server/src/metrics.ts` (new)
- `server/src/server.ts` (add /metrics route)

**Estimated scope:** Small (1-2 files)

---

### Task 17: Instrument fal.ai calls

**Description:** Wrap `submitTextToImage`, `submitImageToImage`, and `pollJob` in `fal/api.ts` with metrics: latency histogram + error counter.

**Acceptance criteria:**

- [ ] `fal_submit_duration_seconds` histogram tracks submit latency
- [ ] `fal_poll_duration_seconds` histogram tracks poll latency
- [ ] `fal_errors_total` counter tracks failures, labeled by `operation` (submit/poll) and `model`
- [ ] Metrics are recorded even when the call fails

**Verification:**

- [ ] After triggering a generation, `/metrics` shows fal.ai metrics
- [ ] After a failed fal.ai call, error counter increments

**Dependencies:** Task 16

**Files likely touched:**

- `server/src/services/fal/api.ts`
- `server/src/metrics.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 18: Instrument wallet operations

**Description:** Add metrics to wallet operations: charge count, refund count, insufficient credits count.

**Acceptance criteria:**

- [ ] `wallet_charges_total` counter, labeled by `type` (CHARGE, REFUND, ESCROW_HOLD, ESCROW_REFUND)
- [ ] `wallet_insufficient_credits_total` counter
- [ ] `wallet_balance_histogram` (track balance distribution — useful for detecting drain bugs)

**Verification:**

- [ ] After a generation charge, `/metrics` shows incremented charge counter
- [ ] After insufficient credits error, counter increments

**Dependencies:** Task 16

**Files likely touched:**

- `server/src/db/repositories/wallet-repo.ts`
- `server/src/metrics.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 19: Instrument generation job lifecycle

**Description:** Track how long jobs spend in PENDING before moving to SUCCESS or FAILED, and the failure rate.

**Acceptance criteria:**

- [ ] `generation_job_duration_seconds` histogram, labeled by `model` and `status` (success/failed)
- [ ] `generation_jobs_total` counter, labeled by `status` and `model`
- [ ] `generation_jobs_pending_gauge` — current number of PENDING jobs (updated on each worker poll)

**Verification:**

- [ ] After a job completes, `/metrics` shows duration and count
- [ ] Gauge reflects actual PENDING count in DB

**Dependencies:** Task 16

**Files likely touched:**

- `server/src/workers/generation-worker.ts`
- `server/src/metrics.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 20: Add `/health/detailed` endpoint

**Description:** Extend the health check to report worker status, queue depth, and last poll time.

**Acceptance criteria:**

- [ ] `GET /health/detailed` returns: `{ status, db, workers: { generation: { running, lastPollAt, pendingCount }, workflow: { running, lastPollAt, runningCount } } }`
- [ ] Workers update a shared status object on each poll cycle
- [ ] Endpoint returns 503 if DB is down or if a worker hasn't polled in > 2x its interval

**Verification:**

- [ ] `curl http://localhost:3001/health/detailed` returns worker status
- [ ] Stopping the worker causes health check to report unhealthy after threshold

**Dependencies:** Task 10 (worker logging)

**Files likely touched:**

- `server/src/routes/health.ts`
- `server/src/workers/generation-worker.ts`
- `server/src/workers/workflow-worker.ts`

**Estimated scope:** Small (1-2 files)

---

### Task 21: Add React Error Boundary at AppShell level

**Description:** Create an `ErrorBoundary` component that catches render errors and displays the existing `ErrorState` component. Wrap the AppShell's Outlet with it.

**Acceptance criteria:**

- [ ] `client/src/components/ErrorBoundary.tsx` (new) — class component with `componentDidCatch` and `getDerivedStateFromError`
- [ ] Renders `ErrorState` with the error message on catch
- [ ] Logs the error to console with component stack trace
- [ ] AppShell wraps `<Outlet />` with `<ErrorBoundary>`

**Verification:**

- [ ] Add a deliberate throw in a child component, verify ErrorState appears instead of white screen
- [ ] Error is logged to console with component stack

**Dependencies:** None

**Files likely touched:**

- `client/src/components/ErrorBoundary.tsx` (new)
- `client/src/components/AppShell.tsx`

**Estimated scope:** Small (1-2 files)

---

### Task 22: Add global `unhandledrejection` handler on client

**Description:** In `client/src/main.tsx`, register `window.onerror` and `window.onunhandledrejection` handlers that log errors to the server via a new `POST /api/client-errors` endpoint.

**Acceptance criteria:**

- [ ] `window.onerror` captures message, source, line, col, stack
- [ ] `window.onunhandledrejection` captures reason and stack
- [ ] Errors are POSTed to `/api/client-errors` with: `message`, `stack`, `url`, `userAgent`, `timestamp`
- [ ] Server endpoint stores client errors in a `client_errors` table or logs them

**Verification:**

- [ ] Add `Promise.reject("test")` in a component, verify it appears in server logs
- [ ] Network tab shows POST to `/api/client-errors`

**Dependencies:** None (but pairs with Task 23)

**Files likely touched:**

- `client/src/main.tsx`
- `server/src/routes/client-errors.ts` (new, or add to existing route file)
- `server/src/server.ts` (mount route)

**Estimated scope:** Small (1-2 files)

---

### Task 23: Add React Query global error handler

**Description:** Configure the QueryClient with global `onError` handler that: redirects to `/login` on 401, shows a toast/notification on 5xx errors.

**Acceptance criteria:**

- [ ] 401 responses trigger redirect to `/login`
- [ ] 5xx responses show a user-visible error notification (use existing notification system or a simple toast)
- [ ] Network errors show "Connection lost" message
- [ ] Does not interfere with per-query error handling (ErrorState components still work)

**Verification:**

- [ ] Expired session triggers redirect
- [ ] Server returning 500 shows error notification

**Dependencies:** None

**Files likely touched:**

- `client/src/lib/query-client.ts`

**Estimated scope:** Small (1 file)

---

### Task 24: Preserve HTTP status code in API client interceptor

**Description:** Modify the axios response interceptor in `api-client.ts` to preserve the HTTP status code in the rejected error object.

**Acceptance criteria:**

- [ ] Rejected error includes `{ code, message, status }` where `status` is the HTTP status code
- [ ] Consumers can check `error.status === 401` to trigger logout
- [ ] Existing error handling (ErrorState) still works without changes

**Verification:**

- [ ] 401 response includes `status: 401` in the rejected error
- [ ] 500 response includes `status: 500`

**Dependencies:** None

**Files likely touched:**

- `client/src/lib/api-client.ts`

**Estimated scope:** Small (1 file)

---

### Task 25: Add graceful shutdown

**Description:** Register SIGTERM/SIGINT handlers in `server.ts` that stop workers, drain the DB pool, and close the HTTP server before exiting.

**Acceptance criteria:**

- [ ] On SIGTERM: stop generation worker, stop workflow worker, drain DB pool, close HTTP server
- [ ] Shutdown completes within 10 seconds, then force exit
- [ ] In-flight requests are allowed to complete (no abrupt connection close)
- [ ] Log line: `event: "server_shutdown"` with `signal` and `duration_ms`

**Verification:**

- [ ] Send SIGTERM to running server, verify clean shutdown log
- [ ] In-flight request completes before server exits

**Dependencies:** Task 10 (worker stop functions exist)

**Files likely touched:**

- `server/src/server.ts`

**Estimated scope:** Small (1 file)

---

### Task 26: Fix DB pool error handler

**Description:** Replace the `process.exit(-1)` in `pool.ts` with a logged warning and let the pool's built-in reconnection handle transient errors.

**Acceptance criteria:**

- [ ] Idle client error logs with `event: "db_pool_error"` and `err.message`
- [ ] Process does NOT exit on idle client error
- [ ] Pool continues to serve requests after transient errors
- [ ] Only fatal errors (e.g., invalid config) should crash the process

**Verification:**

- [ ] Simulate a DB connection drop, verify pool recovers
- [ ] Log shows the error but server stays up

**Dependencies:** Task 1 (logger)

**Files likely touched:**

- `server/src/db/pool.ts`

**Estimated scope:** Small (1 file)

---

### Task 27: Add JSON body size limit

**Description:** Add `limit: '1mb'` to the `express.json()` middleware in `server.ts`.

**Acceptance criteria:**

- [ ] Requests with body > 1MB are rejected with 413
- [ ] Error response includes `{ code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 1MB limit' }`

**Verification:**

- [ ] Send a 2MB JSON body, verify 413 response
- [ ] Normal requests still work

**Dependencies:** None

**Files likely touched:**

- `server/src/server.ts`

**Estimated scope:** XS (1 line)

---

### Task 28: Make session secret required in production

**Description:** In `server.ts`, check if `SESSION_SECRET` is set when `NODE_ENV=production`. If not, throw an error and refuse to start.

**Acceptance criteria:**

- [ ] In production without SESSION_SECRET: server logs fatal error and exits with code 1
- [ ] In development: fallback to dev secret with a warning log
- [ ] Log line: `event: "config_error"` with `variable: "SESSION_SECRET"` in production

**Verification:**

- [ ] `NODE_ENV=production node server.js` without SESSION_SECRET exits with error
- [ ] `node server.js` in dev starts with warning

**Dependencies:** Task 1 (logger)

**Files likely touched:**

- `server/src/server.ts`

**Estimated scope:** XS (1 file)

---

### Task 29: Add worker circuit breaker

**Description:** Add exponential backoff to both workers when they encounter repeated errors. If 5 consecutive polls fail, double the interval (up to 60s max). Reset on success.

**Acceptance criteria:**

- [ ] After 5 consecutive errors, poll interval doubles (5s → 10s → 20s → 40s → 60s max)
- [ ] On successful poll, interval resets to default
- [ ] Log line: `event: "worker_backoff"` with `worker`, `consecutiveErrors`, `newIntervalMs`
- [ ] Log line: `event: "worker_backoff_reset"` with `worker`

**Verification:**

- [ ] Mock DB failure, verify backoff behavior
- [ ] Restore DB, verify interval resets

**Dependencies:** Task 10 (worker logging)

**Files likely touched:**

- `server/src/workers/generation-worker.ts`
- `server/src/workers/workflow-worker.ts`

**Estimated scope:** Small (1-2 files)

---

## Verification (Full Plan)

After all tasks:

- [ ] `grep -r "console\.error" server/src/` returns zero results
- [ ] `grep -r "console\.log" server/src/` returns zero results (except intentional startup messages)
- [ ] All server tests pass: `cd server && npx vitest run`
- [ ] Server starts and produces JSON log lines
- [ ] `/health/detailed` returns worker status
- [ ] `/metrics` returns counters and histograms
- [ ] Generation failure refunds credits (test)
- [ ] Concurrent wallet access doesn't double-charge (test)
- [ ] Client ErrorBoundary catches render errors
- [ ] Client 401 redirects to login
- [ ] Graceful shutdown works (SIGTERM test)
- [ ] DB pool error doesn't kill process
