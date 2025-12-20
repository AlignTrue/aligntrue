---
description: Discipline for ops-core platform kernel work
globs:
  - platform/ops-core/**
---

# Ops-core discipline

Applies only to `platform/ops-core/**`.

- Pure functions and data; no side effects or global state.
- No imports from `apps/**`.
- No imports from sync packages (`packages/cli`, `packages/core`, `packages/schema`, `packages/exporters`, `packages/sources`, `packages/file-utils`).
- Deterministic, serializable data structures.
- Prefer type-first design with tests alongside code when added.
- Keep modules small and explicit; avoid helper sprawl and barrels.
