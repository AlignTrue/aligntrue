# Invariants (Ring A)

These are one-way doors for the platform kernel. Do not violate them.

- **A1 Event envelope with explicit time + causality**: occurred_at, ingested_at, optional effective_at, correlation_id, causation_id, source_ref, actor, capability scope, envelope + payload schema versions.
- **A2 Command envelope with concurrency semantics**: command_id (idempotency key), dedupe_scope, target_ref, preconditions, explicit outcomes (accepted/rejected + reason), correlation/causation linkage.
- **A3 At-least-once correctness**: outbox dispatch; idempotent handlers; stable idempotency keys.
- **A4 Actor model + capabilities**: every action records actor and scoped capability; enforced at boundaries and audited.
- **A5 Action safety classes**: READ, WRITE_INTERNAL, WRITE_EXTERNAL_SIDE_EFFECT; external writes require approvals/quotas/kill switches/compensation hooks.
- **A6 Projection invariant**: write truth = event log; read truth = projections; projections are versioned, rebuildable, freshness/lag declared.
- **A7 Deterministic identity**: canonical form + content hash as stable IDs for governed artifacts (schema versions, packs, policies, artifacts, tool manifests).
- **A8 Baseline connector expectations**: idempotent ingestion, cursor/incremental semantics, backfill, schema drift hooks, rate-limit and retry models.
- **A9 Atomicity + multi-step consistency**: batch append from one command is atomic; external side effects are not. Use outbox + explicit pending/approved/dispatched/executed/failed states; crash recovery relies on durable events and idempotent outbox.

See `core/docs/CONSTITUTION.md` for the full contract and enforcement details.
