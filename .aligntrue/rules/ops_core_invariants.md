---
description: Ring A invariants for the ops-core platform kernel
globs:
  - platform/ops-core/**
---

# Ops-core Ring A invariants

Applies to `platform/ops-core/**`. These are one-way doors; do not violate them.

- **A1 Event envelope with explicit time + causality**  
  Include occurred_at, ingested_at, optional effective_at, correlation_id, causation_id, source_ref, actor identity/type, capability scope, schema/event version.

- **A2 Command envelope with concurrency semantics**  
  Commands carry command_id (idempotency key), dedupe scope, target ref, preconditions, explicit outcomes (accepted/rejected + reason), correlation/causation linkage.

- **A3 At-least-once correctness**  
  Outbox pattern for dispatch. Handlers must be idempotent. Stable idempotency keys required.

- **A4 Actor model + capabilities**  
  Every action records actor (human/service/agent) and uses scoped capabilities enforced at boundaries and in audit.

- **A5 Action safety classes**  
  Classify actions as READ, WRITE_INTERNAL, or WRITE_EXTERNAL_SIDE_EFFECT. External side effects require approvals/quotas/kill switches/compensation hooks.

- **A6 Projection invariant**  
  Write truth = event log. Read truth = projections. Projections are versioned, rebuildable, and carry freshness/lag semantics.

- **A7 Deterministic identity**  
  Canonical form + content hash as stable IDs for governed artifacts (schema versions, packs, policies, query/derived artifacts, tool manifests).

- **A8 Baseline connector expectations**  
  Idempotent ingestion, cursor/incremental sync semantics, backfill expectations, schema drift detection hooks, rate-limit and retry models.
