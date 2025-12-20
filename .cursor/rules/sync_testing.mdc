---
description: Sync CLI testing practices and safety constraints
globs:
  - packages/cli/**
  - packages/core/**
  - packages/schema/**
  - packages/exporters/**
  - packages/sources/**
  - packages/file-utils/**
---

# Sync testing guide

Use for CLI and sync-engine work. Pairs with `testing.md` for general guidance.

## Safety and setup

- **Never test in workspace root.** Create `/tmp/aligntrue-test-{ts}` and run commands there.
- Use absolute CLI path (`/path/to/workspace/packages/cli/dist/index.js`).
- Set `TZ=UTC`, `NODE_ENV=test`; capture stdout, stderr, exit codes, timings.
- Structured tests must assert cwd under `/tmp/` and set `TEST_WORKSPACE`, `ALIGNTRUE_CLI`, `LOG_FILE`.

## Strategy

- Integration: real filesystem via temp dirs, real `@aligntrue/*` imports.
- Smoke: `--help`, parsing, wiring; minimal mocks.
- Contract: public APIs, schema, exporters, sync invariants.

## Mocks

- Do **not** mock `@aligntrue/*`.
- Allowed: external services, `process.exit`, time/randomness, UI prompts.

## Temp artifacts

- Prefix with `temp-`; avoid `*_config.yaml` without the prefix.
- Cleanup scripts: `pnpm cleanup:temps` and `pnpm cleanup:temps:dry`.

## Local workflow

- Pre-commit: format, lint fast.
- Pre-push: typecheck, tests, build as needed.
- Keep tests near sources under `packages/*/tests/`.

## AI execution (CLI layers)

- Complete safety checks before running.
- Log commands, outputs, and findings with severity.
- Clean up `/tmp/aligntrue-*` and tarballs after runs.
