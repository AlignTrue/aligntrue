# Phase 4: Extract convert/suggestions into packs

## Goal

Move remaining domain behavior (`convert/`, `suggestions/`) out of `ops-core` into governed packs, enforcing runtime dispatch and capability/idempotency rules.

## Scope

- Extract conversion behavior into a `pack-convert` (or fold into pack-tasks if tightly coupled) with command handlers and projections.
- Extract suggestions behavior into a `pack-suggestions` (or fold suggestions per domain pack, e.g., tasks/notes) with command handlers and feedback events.
- Wire `ops-host` to load the new packs via manifest; ensure `app.manifest.json` pins versions.
- Update `ops-cli` to dispatch through `ops-host` runtime instead of calling core directly.

## Steps

1. Contracts & envelopes
   - Define command/event type constants for convert/suggestions in `ops-core/contracts` (append-only strings).
   - Ensure envelopes include `idempotency_key`, `dedupe_scope`, `correlation_id`, `causation_id`, `occurred_at/ingested_at`.

2. Runtime enforcement
   - Enforce capability gating and idempotency in `ops-host` before pack handlers run.
   - Ensure `handled_by` is set by runtime for all outcomes.

3. Pack extraction
   - Create pack(s) for convert and suggestions; move handlers, state machines, projections.
   - Register projections in the pack manifest; expose manifest with commands/events/projections.
   - Update imports in `apps/app`, `ops-cli`, `ops-shared` tests to use packs + runtime dispatch.

4. Governance
   - Emit pack load receipts (`core.packs.loaded` / `load_failed`) with resolved version/integrity.
   - Compute integrity deterministically over `dist/`; require build before load.

5. Tests
   - Add pack-level unit tests for convert/suggestions.
   - Add guardrail tests to ensure `ops-core` no longer imports convert/suggestions code.
   - Re-enable/repair failing `ops-core` tests (suggestions, work-ledger).

## Acceptance criteria

- `ops-core` contains only contracts and shared primitives; no convert/suggestions domain code.
- `apps/app` and `ops-cli` dispatch convert/suggestions commands via `ops-host` runtime.
- Pack load receipts record requested/resolved version + integrity.
- All tests pass: `pnpm turbo run test --filter @aligntrue/ops-core` and pack tests.
