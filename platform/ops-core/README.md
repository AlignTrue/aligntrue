# @aligntrue/ops-core

Purpose: seed the platform kernel for AI ops/CRM primitives.

Boundaries:

- No imports from `apps/**`.
- No imports from sync packages (`packages/cli`, `packages/core`, `packages/schema`, `packages/exporters`, `packages/sources`, `packages/file-utils`).
- Pure types/functions only; avoid side effects, global state, and I/O.

Build:

- TypeScript builds to `dist/`: `pnpm exec tsc` (run from `platform/ops-core/`).
- Consumers import from `platform/ops-core/dist/index.js` (CLI work commands use this).

Status:

- Not part of the pnpm workspace yet (kept inert by directory placement).
- Add `platform/*` to `pnpm-workspace.yaml` only when ready to build.
