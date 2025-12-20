---
description: Definition of Done for Phase 0 ops-core substrate work
globs:
  - platform/ops-core/**
---

# Phase 0 Definition of Done (ops-core)

Applies to Phase 0 substrate work in `platform/ops-core/**`.

- Every write path has a clear idempotency story with tests proving duplicates do not corrupt state.
- Replay rebuild is deterministic: tests replay the same event set twice and hash projections.
- Concurrency yields explicit conflicts, never silent last-write-wins.
- External effects are blocked or routed through fencing stubs (approvals/quotas/kill switches/compensation not bypassed).
- Every artifact type includes canonicalization + content hash rules.
- Any invariant touched has a DR written and reviewed using `.internal_docs/DR/DR-000-template.md`.
