---
title: CI guide
description: Preventing CI failures, validation workflow, and troubleshooting
---

# CI guide

This guide explains AlignTrue's multi-layered validation approach to catch errors early and provides quick fixes for common CI failures.

## Overview

AlignTrue uses a multi-layered validation approach:

1. **Pre-refactor validation** - Run before large changes to ensure clean baseline
2. **Pre-commit hook** - Incremental checks on every commit (fast, focused)
3. **CI validation** - Full workspace validation on push (comprehensive)

## Pre-commit hook (automatic)

Runs automatically on every `git commit`. Optimized for speed with incremental checks.

**Flow:**

1. **Format** staged files with Prettier (~5s)
2. **Validate protected repo files** - Prevent direct edits to auto-generated files
3. **Quick typecheck** changed packages only (~5-15s) ← **Fails fast**
4. **Build** changed packages (~15-30s)
5. **Full typecheck** changed packages (~10-20s)

**Total time:** 30-60s for typical commits (vs 2+ min previously)

**Key improvements:**

- Catches type errors BEFORE build (saves time)
- Only checks/builds changed packages (faster)
- Shows clear error messages with fix suggestions
- **Prevents direct edits to auto-generated files** (new)

### Protected repository files

The following files are auto-generated from documentation source and cannot be directly edited:

- `README.md` (generated from `apps/docs/content/index.mdx`)
- `CONTRIBUTING.md` (generated from `apps/docs/content/05-contributing/creating-aligns.md`)
- `DEVELOPMENT.md` (generated from `apps/docs/content/07-development/*`)

**Why:** AlignTrue practices what it preaches - documentation is the IR (Intermediate Representation), and generated files are the exports. This enforces the docs-first architecture.

**Correct workflow:**

1. Edit the canonical source in `apps/docs/content/`
2. Run `pnpm generate:repo-files` to regenerate root files
3. Commit both the doc changes AND the regenerated files

**If you accidentally try to directly edit a protected file:**

```
❌ Protected files were directly edited

📝 These files are generated from docs content:
   README.md
   CONTRIBUTING.md
   DEVELOPMENT.md

🔄 Correct workflow:
   1. Edit source files in apps/docs/content/
   2. Run: pnpm generate:repo-files
   3. Commit both docs changes AND generated files
```

**To fix:** Follow the workflow above and retry your commit.

### Bypassing the hook

Only use `--no-verify` when absolutely necessary (e.g., emergency hotfix, known CI issue):

```bash
git commit --no-verify -m "fix: Emergency hotfix"
```

## CI validation (automatic)

Runs on every push to `main` or `develop`. Comprehensive validation of entire workspace.

**What CI checks:**

1. Lockfile sync validation
2. Full workspace build
3. Full workspace typecheck
4. All tests (unit + integration)
5. Conformance testkit
6. Golden repository validation

**Time:** 3-5 minutes per platform

### Platform coverage

CI runs on multiple platforms to catch platform-specific issues:

- **Ubuntu (Linux)** - Primary platform, full test suite
- **macOS** - Development platform, full test suite
- **Windows** - Limited test coverage (see below)

Additionally, CI tests multiple Node.js versions:

- **Node 20** - LTS minimum (all platforms)
- **Node 22** - Current LTS (all platforms)

### Windows test limitations

**Current status:** 13 integration test suites skip on Windows due to persistent EBUSY file locking issues.

**Affected tests:**

- `init-command.test.ts`
- `sync-command.test.ts`
- `check-command.test.ts`
- `overlays.test.ts`
- `scopes-monorepo.test.ts`
- `plugs-resolution.test.ts`
- `customization-combined.test.ts`
- `align-sources.test.ts`
- `override-add-command.test.ts`
- `override-remove-command.test.ts`
- `override-status-command.test.ts`
- Plus 1 unit test in `core/tests/overlays/patch-writer.test.ts`

**Root cause:** Windows file system locks files more aggressively than Unix-like systems, causing EBUSY errors when tests try to clean up temporary directories. The cleanup helper in `packages/cli/tests/helpers/fs-cleanup.ts` includes retry logic (6 retries on Windows vs 1 on Unix), but CI environment still experiences intermittent failures.

**Impact:**

- Core CLI commands (init, sync, check) are not integration tested on Windows in CI
- Unit tests and smoke tests still run on Windows
- Path normalization and cross-platform compatibility are validated via unit tests
- Windows support is "best effort" - basic functionality works but edge cases may slip through

**Workaround for local Windows testing:**

- Run tests locally with longer timeouts
- Use WSL2 for full test suite coverage
- Report Windows-specific issues as bugs with reproduction steps

**Future work:**

- Investigate more robust cleanup strategies (rimraf, graceful-fs)
- Add Windows-specific smoke tests that DO run in CI
- Consider marking Windows as "community supported" if issues persist

## Troubleshooting quick fixes

### Workspace protocol validation failed

**Symptom**

```
Workspace protocol validation failed: @aligntrue/core version is "^0.2.0".
```

**Fix**

1. Run `pnpm validate:workspace` locally.
2. Update the dependency to `workspace:*` in the referenced `package.json`.
3. Re-run `pnpm install && pnpm build:packages`.

### Workspace link verification failed

**Symptom**

```
Workspace link verification failed: @aligntrue/cli → /node_modules/.pnpm/...
```

**Fix**

1. Ensure you ran `pnpm install` after switching branches.
2. If links still resolve to `.pnpm`, run `pnpm clean && pnpm install`.
3. Re-run `pnpm verify:workspace-links`.

### Version mismatch during prepublish

**Symptom**

```
Versions must match across all workspace packages.
```

**Fix**

1. Run `pnpm prepublish:check` locally; it prints every mismatched package.
2. Bump all packages to the same version (for example, 0.2.0) before releasing.

### Type mismatch after renaming formats

**Symptom**

```
TS2322: Type '"agents-md"' is not assignable to type '"agents"'.
```

**Fix**

1. Ensure packages were rebuilt: `pnpm build:packages`.
2. Run `pnpm validate:workspace` and `pnpm verify:workspace-links`.
3. If CI still fails, run `pnpm clean && pnpm install` to refresh workspace links.

## Common type error patterns

### 1. Import path errors

**Problem:** Wrong import path or missing type export

```typescript
// ❌ Wrong
import { DriftDetectionResult } from "@aligntrue/core/team/drift.js";

// ✅ Correct
import { DriftResult } from "@aligntrue/core/team/drift.js";
```

**Fix:** Check the actual exports in the source file

### 2. Duplicate imports

**Problem:** Same type imported from multiple locations

```typescript
// ❌ Wrong
import { AlignRule } from "@aligntrue/core";
import { AlignRule } from "@aligntrue/schema";

// ✅ Correct
import { AlignRule } from "@aligntrue/schema";
```

**Fix:** Import types from their canonical source (usually `@aligntrue/schema`)

### 3. Type narrowing issues

**Problem:** TypeScript can't infer type after conditional

```typescript
// ❌ Wrong
if (!acc[item.category]) acc[item.category] = [];
acc[item.category].push(item); // Error: possibly undefined

// ✅ Correct
if (!acc[item.category]) acc[item.category] = [];
acc[item.category]!.push(item); // Non-null assertion
```

**Fix:** Use non-null assertion (`!`) or type guards

### 4. exactOptionalPropertyTypes issues

**Problem:** Optional property can't be explicitly set to `undefined`

```typescript
// ❌ Wrong
type Result = {
  summary?: string;
};

// ✅ Correct
type Result = {
  summary?: string | undefined;
};
```

**Fix:** Explicitly allow `undefined` in optional properties

## Import path reference

Common type locations:

- **Schema types:** `@aligntrue/schema`
  - `AlignRule`, `Align`, `validateAlignSchema`, `validateRuleId`
- **Core types:** `@aligntrue/core`
  - `AlignTrueConfig`, `SyncEngine`, `BackupManager`
- **Team types:** `@aligntrue/core/team/drift.js`
  - `DriftResult`, `DriftFinding`, `DriftCategory`
- **Exporter types:** `@aligntrue/exporters`
  - `ExporterRegistry`, `ExportResult`
- **Source types:** `@aligntrue/sources`
  - `GitSourceConfig`, `CatalogSourceConfig`

## Common issues and fixes

### Next.js dev server fails with "Cannot find module" errors

**Symptom:** Dev server crashes with errors like:

```
Error: Cannot find module './vendor-chunks/nextra@4.6.0...'
Cannot find module '@aligntrue/ui'
```

**Cause:** Next.js doesn't transpile workspace packages by default. The `@aligntrue/ui` package exports TypeScript source directly (no build step), so Next.js needs to be configured to transpile it.

**Fix:**

See [Setup - Next.js dev server fails](/docs/06-development/setup#nextjs-dev-server-fails-with-cannot-find-module-errors) for detailed troubleshooting steps.

### Pre-commit hook is slow

**Cause:** Checking too many packages or full workspace

**Fix:** The optimized hook only checks changed packages. If still slow:

1. Check if you have uncommitted changes in many packages
2. Commit packages separately if working on multiple

### Type errors only appear in CI

**Cause:** Local build is stale or using cached types

**Fix:**

```bash
# Clean and rebuild
pnpm clean
pnpm build

# Then run typecheck
pnpm typecheck
```

### Pre-commit hook fails but types seem fine

**Cause:** Hook uses stricter checks than your IDE

**Fix:**

1. Run `pnpm typecheck` locally to see all errors
2. Check that your IDE is using workspace TypeScript version
3. Ensure `tsconfig.json` has `strict: true`

## Best practices

1. **Commit frequently** - Smaller commits = faster pre-commit checks
2. **Fix type errors immediately** - Don't let them accumulate
3. **Use the right import paths** - Check source files for canonical exports
4. **Test locally before pushing** - Run `pnpm typecheck && pnpm test`

## Next steps

- Review [setup guide](/docs/06-development/setup)
- Learn [test maintenance](/docs/06-development/test-maintenance) for handling test failures
