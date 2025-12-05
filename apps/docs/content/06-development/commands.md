---
title: Commands
description: Development commands, testing, and build workflows for AlignTrue.
---

# Development commands

Common commands and workflows for AlignTrue development.

## Core commands

### Run docs locally

```bash
pnpm dev
```

Starts the docs site at `http://localhost:3000` from `apps/docs`.

### Build

```bash
pnpm build          # Turbo build across workspace
pnpm build:packages # Build only workspace packages
pnpm --filter @aligntrue/core build # Build one package
```

### Tests and type checks

```bash
pnpm test        # All tests
pnpm test:fast   # Fast reporter for quick feedback
pnpm typecheck   # TypeScript across all packages
```

### Linting and formatting

```bash
pnpm lint          # ESLint (zero warnings)
pnpm lint:fix      # Fix then re-run lint
pnpm format        # Prettier write
pnpm format:check  # Prettier check only
```

### Validation helpers

```bash
pnpm validate:all            # Full validation suite
pnpm validate:docs           # Docs accuracy checks
pnpm validate:workspace      # Ensure workspace:* protocol
pnpm verify:workspace-links  # Verify node_modules links resolve locally
pnpm check                   # Aggregated CI-like check runner
pnpm ci:errors               # Summarize recent CI failures
```

### Docs + repo files

```bash
pnpm start:docs          # Start docs with preflight
pnpm generate:repo-files # Regenerate README/CONTRIBUTING/etc. from docs
```

### Cleaning

```bash
pnpm clean        # Remove node_modules and dist outputs
pnpm clean-temp   # Delete temp-* debug files
pnpm cleanup:temps # Remove cached test temp artifacts (supports --delete/--verbose)
```

### Bootstrapping

```bash
pnpm bootstrap  # Install deps then build once
```

## Working on packages

### Package build workflow

When editing workspace packages that other packages depend on (core, schema, exporters), you have two options:

**Option 1: Watch mode (recommended for active development)**

Run packages in watch mode for automatic rebuilds on save:

```bash
pnpm dev:packages
```

This runs all packages in parallel watch mode. Keep this running in a separate terminal while developing.

**Option 2: Manual builds**

Build packages explicitly when needed:

```bash
# Build all packages
pnpm build:packages

# Build specific package
pnpm --filter @aligntrue/core build
```

### Why builds matter

Packages import from `dist/` directories of their dependencies (e.g., CLI imports from `packages/core/dist/`). If you edit source in `packages/core/src/` but don't rebuild, other packages will see stale types and code.

**The pre-commit hook automatically rebuilds packages when source files change**, so you won't commit stale builds. But during development, use watch mode for instant feedback.

### Working with type changes

When you change exported types in core packages (schema, core, exporters, plugin-contracts):

1. Build the package: `pnpm --filter @aligntrue/schema build`
2. Turbo automatically rebuilds dependent packages

Or just run `pnpm build:packages` to rebuild everything. Turbo's dependency graph ensures packages build in the correct order.

### Workspace protocol and release checks

- All `@aligntrue/*` dependencies must use `workspace:*` so local builds always take priority. Run `pnpm validate:workspace` if you edit `package.json`.
- After `pnpm install`, run `pnpm verify:workspace-links` when diagnosing type mismatches. It ensures node_modules links resolve to local workspace packages.
- Before publishing, run `pnpm prepublish:check`. It verifies versions match across packages, the git tree is clean, and build/typecheck/test succeed.
- CI runs the same checks in `.github/workflows/ci.yml`, so keeping them green locally prevents “works on my machine” releases.

## Running tests locally

### All tests

Run the full test suite across all packages:

```bash
pnpm test
```

### Specific package

Test a single package:

```bash
pnpm --filter @aligntrue/cli test
pnpm --filter @aligntrue/schema test
pnpm --filter @aligntrue/core test
```

### Specific test file

Run a specific test file:

```bash
pnpm --filter @aligntrue/cli vitest run tests/commands/sync.test.ts
```

### Watch mode

Run tests in watch mode for rapid feedback during development:

```bash
# Watch all tests in a package
pnpm --filter @aligntrue/cli vitest

# Watch specific test file
pnpm --filter @aligntrue/cli vitest tests/commands/sync.test.ts

# Watch with UI
pnpm --filter @aligntrue/cli vitest --ui
```

### With coverage

Generate coverage reports:

```bash
pnpm --filter @aligntrue/cli vitest --coverage
```

### Deterministic test environment

Match CI environment exactly (useful for debugging CI failures):

```bash
TZ=UTC pnpm test
```

### Fast feedback mode

Use the fast reporter for quicker output:

```bash
pnpm test:fast
```

## Code quality

### TypeScript

- All packages use strict TypeScript
- Extends `tsconfig.base.json` from repo root
- No `any` types allowed
- Use `unknown` and narrow types

### Formatting

EditorConfig is configured at the root. Use:

- 2 spaces for indentation
- LF line endings
- UTF-8 encoding

### Testing

- Unit tests go in `packages/*/tests/`
- Keep tests fast (<1s per test)
- Make tests deterministic (no real time, network, or randomness)

## Common tasks

### Add a new package

1. Create directory under `packages/`
2. Add `package.json` with workspace dependencies
3. Create `tsconfig.json` extending base
4. Add to workspace commands in root `package.json`

### Update dependencies

```bash
pnpm update --latest --recursive
```

### Check for security issues

```bash
pnpm audit
```

## Releasing (manual flow)

Releases use `scripts/manual-release.mjs`—no Changesets.

```bash
pnpm release [--dry-run] [--type=patch|minor|major|current]
```

What it does:

- prompts (or uses `--type`) for bump level across publishable packages
- bumps versions in each package.json
- runs `pnpm build:packages`
- publishes each package with `pnpm publish` (rewrites workspace:\*)
- runs `node scripts/validate-published-deps.mjs` to catch workspace leaks
- commits + tags (`chore: Release <version> (<type>)`) and pushes

Tips:

- Use `--dry-run` to preview without changing files or publishing.
- Start from a clean main branch with CI green and npm auth configured.
- After release, update `CHANGELOG.md` and verify `npx aligntrue --version`.

## CI/CD

CI runs on every PR and reuses the same scripts as local helpers:

- lockfile sync and docs accuracy validation
- `pnpm build`, `pnpm typecheck`, `pnpm test` (unit + integration + golden repo)
- bundle-size and workspace protocol checks

If `pnpm pre-ci` succeeds from a clean tree, CI should match.

## Troubleshooting

### Pre-commit hook fails with formatting errors

The hook auto-regenerates repo files when docs change, validates workspace protocol, runs `pnpm lint-staged`, and builds affected packages when TypeScript files are staged. Fix the first reported failure (format, lint, or build) and rerun.

### Pre-push hook is too slow

Pre-push runs `pnpm pre-ci` (frozen install, build, typecheck, tests, bundle-size validation). Use watch mode and `pnpm test:fast` for tight loops, then rely on pre-push before CI.

### Commit message rejected

Ensure your commit message follows Conventional Commits format:

```bash
<type>: <description>
```

Example: `feat: add new command` or `fix: resolve memory leak`

## Next steps

- Review [workspace structure](/docs/06-development/workspace)
- Understand [architecture concepts](/docs/06-development/architecture)
- Learn [CI validation](/docs/06-development/ci) to prevent failures
