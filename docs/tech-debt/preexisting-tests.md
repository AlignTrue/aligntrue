# Pre-existing test failures to fix

These failures existed before the Phase 3.5 notes extraction work and are unrelated to the new pack-notes architecture.

## Failing tests

- `platform/ops-core/tests/suggestions.test.ts` — "approves suggestion with idempotency and rejects stale hash"
  - Expected: re-approval with a new command_id returns `already_processed`
  - Current: returns `accepted`
  - Likely cause: `tryStart` idempotency check runs before `getStatus`; re-approval uses a new command_id so status check should short-circuit

- `platform/ops-core/tests/work-ledger.test.ts` (3 failures):
  - "handles create and complete idempotently"
  - "blocks readiness until dependency is completed"
  - "removes blocked items from ready queue and restores on unblock"
  - Likely cause: ready-queue/projection logic allows items that should be blocked; review state machine and projection for dependencies and completion paths

## Next actions

- Add targeted fixes for suggestion idempotency flow (status check vs. tryStart)
- Fix work-ledger ready-queue/projection dependency handling
- Re-run `pnpm turbo run test --filter @aligntrue/ops-core`
