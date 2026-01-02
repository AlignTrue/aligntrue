---
title: Add a new exporter
description: Step-by-step recipe for adding a new agent exporter with tests and docs.
---

# Add a new exporter

Follow this recipe to add an agent exporter without guesswork.

## Steps

1. **Create the module**
   - Copy the smallest existing exporter as a starting point (e.g., `packages/exporters/src/cline`).
   - Add `manifest.json` and `index.ts` under `packages/exporters/src/<agent>/`.
   - Register it in `packages/exporters/src/registry.ts`.
2. **Wire outputs**
   - Decide output paths and filenames; keep them deterministic.
   - Include fidelity notes if the format is lossy compared to IR.
3. **Add tests**
   - Golden determinism: IR fixture → expected files in `packages/exporters/tests/__fixtures__/<agent>/`.
   - Contract coverage: validate manifest and hash stability if applicable.
   - Run: `pnpm --filter @aligntrue/exporters test`.
4. **Docs**
   - Add the agent to `apps/docs/content/04-reference/agent-support.md` with any fidelity notes.
   - Update `CHANGELOG.md` under “Added”.
5. **init detection (optional)**
   - If the exporter should auto-detect on `aligntrue init`, hook it into the detection logic in `packages/cli/src/commands/init.ts`.

## Checks before opening a PR

- Golden fixtures pass for the new exporter.
- Manifest fields and outputs are documented.
- `pnpm check` and `pnpm --filter @aligntrue/exporters test` are green.
- Docs updated for user-facing behavior.
