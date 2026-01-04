# Conventions

- Core truths: events + commands + receipts; projections are rebuildable and versioned.
- Time + causality are explicit everywhere (occurred_at, ingested_at, effective_at?, correlation_id, causation_id).
- At-least-once is normal: idempotency keys, outbox, dedupe scopes.
- Action safety classes: READ, WRITE_INTERNAL, WRITE_EXTERNAL_SIDE_EFFECT; external writes require approvals/quotas/kill switch + receipts.
- Actor + capability required on every action.
- Deterministic identity: canonicalization + content hash for governed artifacts.
- Storage defaults (local): JSONL logs + SQLite sidecars; `OPS_DATA_DIR` controls base path.
- Trajectory capture: opt-in `TrajectoryContext`; hash chain on steps; volume controls; redact and summarize tool args/results.
- Projections: determinism via canonical ordering; freshness declared; rebuild must match incremental.
- Packs: live in `packs/<id>/`; expose PackModule with manifest, commandHandlers, projections.
- Host: dispatches commands with capability enforcement; no direct pack imports from apps/cli.
- UI: use `ui/renderer`, `ui/blocks`; composition in renderer, not blocks.
