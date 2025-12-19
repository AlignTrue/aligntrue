---
description: Repository structure and rule ownership map for AlignTrue
apply_to: alwaysOn
---

# Platform vs sync structure

Use this map to route work and rules to the right area.

| Area            | Location                                                                                                            | Purpose                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Sync CLI        | `packages/cli`, `packages/core`, `packages/schema`, `packages/exporters`, `packages/sources`, `packages/file-utils` | Rule sync engine (current product)    |
| Platform kernel | `platform/ops-core`                                                                                                 | AI ops/CRM primitives (new, isolated) |
| Shared          | `packages/ui`, `packages/testkit`, `packages/aligntrue`                                                             | Shared UI/tooling                     |
| Apps            | `apps/docs`, `apps/web`                                                                                             | Web properties                        |

Guidance:

- Sync rules stay scoped to the sync packages above.
- Platform work stays in `platform/ops-core` until it is ready to join the workspace.
- Add `platform/*` to `pnpm-workspace.yaml` only when you intend to build or test it.
