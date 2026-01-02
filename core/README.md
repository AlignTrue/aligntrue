# @aligntrue/core

Purpose: seed the platform kernel for AI ops/CRM primitives.

Boundaries:

- No imports from `apps/**`.
- No imports from sync packages (`packages/cli`, `packages/core`, `packages/schema`, `packages/exporters`, `packages/sources`, `packages/file-utils`).
- Pure types/functions only; avoid side effects, global state, and I/O.

Build:

- TypeScript builds to `dist/`: `pnpm exec tsc` (run from `core/`).
- Consumers import from `core/dist/index.js` (CLI work commands use this).

Status:

- Included in pnpm workspace at `core/`.
- Built via `turbo run build` or `pnpm --filter @aligntrue/core build`.
