# Preventing CI failures

This guide explains the validation workflow and tools designed to catch errors early and prevent CI failures.

## Overview

AlignTrue uses a multi-layered validation approach:

1. **Pre-refactor validation** - Run before large changes to ensure clean baseline
2. **Pre-commit hook** - Incremental checks on every commit (fast, focused)
3. **CI validation** - Full workspace validation on push (comprehensive)

## Pre-refactor validation

Use before large refactors, type changes, or cross-package edits.

```bash
pnpm pre-refactor
```

**What it does:**

- Type checks entire workspace (~30-60s)
- Lints entire workspace
- Ensures clean baseline before starting work

**When to use:**

- Before refactoring 3+ files
- Before changing shared types or interfaces
- Before cross-package changes
- When you see repeated CI failures

## Pre-commit hook (automatic)

Runs automatically on every `git commit`. Optimized for speed with incremental checks.

**Flow:**

1. **Format** staged files with Prettier (~5s)
2. **Quick typecheck** changed packages only (~5-15s) ← **Fails fast**
3. **Build** changed packages (~15-30s)
4. **Full typecheck** changed packages (~10-20s)

**Total time:** 30-60s for typical commits (vs 2+ min previously)

**Key improvements:**

- Catches type errors BEFORE build (saves time)
- Only checks/builds changed packages (faster)
- Shows clear error messages with fix suggestions
- Suggests `pnpm pre-refactor` for large changes

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

**Time:** 3-5 minutes

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
  - `AlignRule`, `AlignPack`, `validateAlignSchema`, `validateRuleId`
- **Core types:** `@aligntrue/core`
  - `AlignTrueConfig`, `SyncEngine`, `BackupManager`
- **Team types:** `@aligntrue/core/team/drift.js`
  - `DriftResult`, `DriftFinding`, `DriftCategory`
- **Exporter types:** `@aligntrue/exporters`
  - `ExporterRegistry`, `ExportResult`

- **Source types:** `@aligntrue/sources`
  - `GitSourceConfig`, `CatalogSourceConfig`

## Troubleshooting

### Pre-commit hook is slow

**Cause:** Checking too many packages or full workspace

**Fix:** The optimized hook only checks changed packages. If still slow:

1. Check if you have uncommitted changes in many packages
2. Run `pnpm pre-refactor` first to catch issues early
3. Commit packages separately if working on multiple

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

1. **Run `pnpm pre-refactor` before large changes** - Catches issues before you start
2. **Commit frequently** - Smaller commits = faster pre-commit checks
3. **Fix type errors immediately** - Don't let them accumulate
4. **Use the right import paths** - Check source files for canonical exports
5. **Test locally before pushing** - Run `pnpm typecheck && pnpm test`

## Related documentation

- [TypeScript guidelines](../../.cursor/rules/typescript.mdc)
- [Testing guidelines](../../.cursor/rules/testing.mdc)
- [Pull request standards](../../.cursor/rules/pull_request_standards.mdc)
