# ADR-029: Integration Testing Strategy and Project Completion

## Status

Accepted

## Date

2026-06-18

## Context

Cast Studio v2 implementation is complete through Task 28 (Integration + End-to-End Testing). The project has 21 existing unit test files with 419 tests covering individual endpoints and services. Integration testing was needed to verify cross-service workflows and data contracts between modules.

## Decision

Write service-level integration tests that verify the key workflows:

1. Commission lifecycle (create → assign → submit → changes → approve → unlock)
2. Marketplace lifecycle (submit → approve → purchase)
3. Actor generation + versioning (generate → regenerate → version history)
4. Notification dispatch (commission events → in-app + email)
5. Wallet operations (balance, transactions)

Tests use mocked database (same pattern as existing unit tests) but exercise multiple services in sequence to verify data contracts.

Fire-and-forget notification side effects consume extra DB mocks, requiring careful mock orchestration with `vi.spyOn` on the notification repo and extra `mockResolvedValueOnce` calls for each notification dispatch.

## Alternatives Considered

### Route-level integration tests (HTTP)

- Pros: Tests the full HTTP stack including middleware
- Cons: Extremely fragile — every DB call in the correct sequence must be mocked; essentially duplicates the implementation
- Rejected: Unit tests already cover HTTP layer; integration tests should focus on service contracts

### End-to-end tests with real database

- Pros: Most realistic; catches integration issues mocking misses
- Cons: Requires running PostgreSQL; slow; complex test setup
- Rejected: Defer to post-MVP; current approach provides sufficient coverage

### No integration tests

- Pros: Faster delivery
- Cons: No verification of cross-service workflows; regression risk
- Rejected: Critical for verifying the commission and marketplace flows

## Consequences

- 18 integration tests added in `tests/integration.test.ts`
- All 437 tests pass (419 existing + 18 new)
- Seed script created for development database
- Build verification: client builds cleanly; server has pre-existing TS errors unrelated to T28

## Seed Script

Created `server/src/db/seed.ts` which creates:

- 1 Studio workspace with 1 Admin, 2 Artists (1 API-enabled)
- 1 Client workspace with 1 Client
- Sample assets (Actor with outputs, Look, Fashion Item)
- Client wallet with 100 credits
- API key for the API-enabled Artist

Usage: `npx tsx src/db/seed.ts`
