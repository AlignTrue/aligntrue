---
title: Command comparison
description: Decide when to run check vs drift and how they differ.
---

# Command comparison

AlignTrue exposes multiple validation commands. Use this page to pick the right one for your workflow.

## Quick decision tree

1. Are you operating in **team mode**?
   - No → Use `aligntrue check`
   - Yes → Continue
2. What do you need to validate?
   - **Lockfile matches IR?** → `aligntrue check`
   - **Agent files or sources changed?** → `aligntrue drift --gates`

## `aligntrue check`

**Purpose:** Validate internal consistency before commits or CI merges.

**Validates:**

- `.aligntrue/.rules.yaml` matches the Align schema
- `.aligntrue.lock.json` hashes match the current IR
- Overlay definitions (if configured)

**Best for:** Solo workflows, pre-commit hooks, CI validation prior to syncing.

**Notes:**

- Defaults to interactive spinner + logs; pass `--ci` (or set `CI=true`) for deterministic CI/script output
- Does **not** inspect agent files or upstream sources
- Exit codes: `0` success, `1` validation failed, `2` system/config error

## `aligntrue drift --gates`

**Purpose:** Detect external drift once team mode is enabled.

**Detects:**

- Agent files modified after last sync (mtime tracking)
- Upstream git sources that changed since lockfile creation
- Vendored pack integrity issues
- Severity remap policy violations

**Best for:** Team CI checks, PR gating, scheduled drift monitors.

**Notes:**

- Works only in team mode (`aligntrue team enable`)
- Add `--gates` to make drift a blocking check (exit code `2`)
- Supports `--json` and `--sarif` outputs for CI tooling

## Side-by-side comparison

| Capability                   | `check`             | `drift --gates`       |
| ---------------------------- | ------------------- | --------------------- |
| Works in solo mode           | ✅                  | ❌                    |
| Validates schema + lockfile  | ✅                  | ❌                    |
| Detects agent file edits     | ❌                  | ✅                    |
| Detects upstream git changes | ❌                  | ✅                    |
| Requires lockfile            | ✅                  | ✅ (team mode only)   |
| Provides JSON/SARIF output   | ✅ (`--json`)       | ✅ (`--json/--sarif`) |
| Typical CI stage             | Pre-sync validation | Post-sync drift gate  |

Use both commands in team repositories: run `check` (with `--ci` in automation) before committing changes, and `drift --gates` in CI to ensure agent files and upstream sources stay aligned.
