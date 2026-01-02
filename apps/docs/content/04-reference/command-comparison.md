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

- `.aligntrue/rules` matches the Align schema
- In team mode with lockfile enabled, `.aligntrue/lock.json` hashes match the current IR
- Overlay definitions (if configured)

**Best for:** Solo workflows, pre-commit hooks, CI validation prior to syncing.

**Notes:**

- Defaults to interactive spinner + logs; pass `--ci` (or set `CI=true`) for deterministic CI/script output
- Uses `.aligntrue/lock.json` at the repo root when team mode lockfile is enabled; solo mode does not require a lockfile
- Does **not** inspect agent files or upstream sources
- Exit codes: `0` success, `1` validation failed, `2` system/config error

## `aligntrue drift --gates`

**Purpose:** Detect external drift once team mode is enabled.

**Detects:**

- Agent files modified after last sync (mtime tracking)
- Upstream git sources that changed since lockfile creation
- Vendored align integrity issues
- Severity remap policy violations

**Best for:** Team CI checks, PR gating, scheduled drift monitors.

**Notes:**

- Works only in team mode (`aligntrue team enable`)
- `--gates` is required to make drift a blocking check (drift + `--gates` → exit code `2`; missing team mode → exit code `1`; load/system errors → exit code `2`)
- `--post-sync` ignores lockfile drift (useful immediately after automated syncs)
- Supports `--json` and `--sarif` outputs for CI tooling

## Side-by-side comparison

| Capability                   | `check`             | `drift --gates`         |
| ---------------------------- | ------------------- | ----------------------- |
| Works in solo mode           | ✅                  | ❌                      |
| Validates schema + lockfile  | ✅                  | ❌                      |
| Detects agent file edits     | ❌                  | ✅                      |
| Detects upstream git changes | ❌                  | ✅                      |
| Requires lockfile            | ✅                  | ✅ (team mode only)     |
| Provides JSON/SARIF output   | ✅ (`--json`)       | ✅ (`--json/--sarif`)   |
| Fails CI by default          | ✅ (on validation)  | ❌ (requires `--gates`) |
| Typical CI stage             | Pre-sync validation | Post-sync drift gate    |

Use both commands in team repositories: run `check` (with `--ci` in automation) before committing changes, and `drift --gates` in CI to ensure agent files and upstream sources stay aligned.

## CI-friendly examples

- Schema/lockfile validation (deterministic): `aligntrue check --ci --json > check.json`
- Drift gate with JSON output: `aligntrue drift --gates --json > drift.json`
- Drift gate with SARIF for code scanning: `aligntrue drift --gates --sarif > drift.sarif`
