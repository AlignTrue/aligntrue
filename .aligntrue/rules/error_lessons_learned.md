---
description: Lessons learned from resolving errors and issues
content_hash: 4038c034f6eccd2e092bf58075c4d81f90f2f54a00e89b25093185c932a0715b
---

# Error resolution lessons learned

## Build race condition & PowerShell quoting (November 12, 2025)

**Symptoms:**

- `Cannot find module '@aligntrue/core'` (Linux/macOS)
- `No projects matched the filters` (Windows only)
- `Failed to resolve entry for package "@aligntrue/schema"`

**Root Causes:**

- Parallel build race: packages building simultaneously despite dependencies
- PowerShell treats single quotes literally (unlike bash)
- Dependency chain not fully sequenced

**Patterns to Recognize:**

1. **Module not found but package exists:** Check build ordering in `build:packages` and `typecheck` commands
2. **Works on Unix, fails on Windows:** Look for quoted package names in pnpm filters
3. **Build passes, typecheck fails:** Ensure identical dependency ordering in both commands

**Fix Applied:**

Now using Turbo with explicit filters to handle ordering:

```json
"build:packages": "turbo run build --filter='./packages/*'"
```

Turbo automatically respects `package.json` dependencies and parallelizes work correctly without race conditions.

**Key Insights:**

- Use `&&` for explicit sequential stages
- No quotes around package names in pnpm filters
- Test cross-platform locally with `node scripts/pre-ci.mjs`
- "No projects matched" = quoting issue on Windows

**Prevention:**

- Test `-r --filter` commands locally with real package names
- Avoid single quotes in pnpm filter names
- Mirror build stages exactly in typecheck command
- Monitor changes to `package.json` build scripts and package dependencies

## Windows path separators & glob output (November 13, 2025)

**Symptoms:**

- `AssertionError: expected [ Array(2) ] to deeply equal [ Array(2) ]` (Windows CI)
- Expected: `"rules/arch.md"` (forward slashes)
- Actual: `"rules\\arch.md"` (backslashes)

**Root Causes:**

- `glob` library returns OS-native path separators (backslashes on Windows)
- Code directly uses glob output without normalizing to forward slashes
- Local pre-CI does not catch platform-specific path issues

**Patterns to Recognize:**

1. **Test fails only on Windows CI, not locally (macOS/Linux):** Look for path comparisons or manipulations that assume forward slashes.
2. **Path string mismatch (`/` vs `\`):** Indicates a platform-specific path separator issue.
3. **Glob returns unexpected paths:** Confirm whether glob is configured to return normalized paths or OS-native paths.

**Fix Applied:**

```typescript
// Normalize to forward slashes for cross-platform consistency
matches = matches.map((p) => p.replace(/\\/g, "/"));
```

**Key Insights:**

- Always normalize paths from external libraries (like `glob`) to a consistent format (e.g., forward slashes) for cross-platform reliability.
- Platform-specific issues (like path separators) require testing on target platforms (e.g., Windows CI) as local pre-CI may not detect them.
- A small `setTimeout` delay can sometimes resolve race conditions with filesystem readiness in tests (e.g., before calling `glob`).

**Prevention:**

    - Implement a custom path normalization utility in `packages/file-utils` for all path-sensitive operations.
    - Add specific unit tests for path handling with both Windows and Unix path formats, potentially using test data with mixed separators.
    - Document path normalization conventions in `documentation.mdc` and `testing.mdc` for all developers.
    - Consider adding a Windows environment to local development or more robust CI setup that emulates Windows filesystem behavior.

## Confusing "dual setting" configuration bug (November 23, 2025)

**Symptoms:**

- Spinner stuck on "Resolving sources" during interactive prompts (non-verbose mode only)
- Configured multi-file rules (`edit_source: .cursor/rules/*.mdc`) not loaded into IR
- Sync works but generates default rules instead of loading existing ones

**Root Causes:**

- **Two separate settings:** `edit_source` (watching) and `source_files` (loading) were distinct but related concepts.
- **Documentation mismatch:** Docs claimed `source_files` was derived from `edit_source`, but no code implemented this logic.
- **Spinner bug:** `spinner.stop()` was wrapped in `if (verbose)` block, causing infinite spinner during prompts in default mode.

**Patterns to Recognize:**

1. **Configuration drift:** Two settings controlling related behavior will eventually diverge or conflict.
2. **Stuck spinner:** If a spinner persists during prompts, check if `stop()` is conditional on verbosity.
3. **Silent failure:** If valid files are ignored without error, check if the loading logic is actually triggered by the config.

**Fix Applied:**

- **Unified Concepts:** Removed `source_files` entirely. Made `edit_source` the single source of truth for BOTH watching and loading.
- **Logic Update:** `edit_source` with glob patterns now automatically triggers multi-file loading logic.
- **Spinner Fix:** Moved `spinner.stop()` outside conditional block to ensure UI always cleans up before prompts.

**Key Insights:**

- **Single Source of Truth:** Avoid splitting related configuration into multiple fields. One setting is harder to mess up.
- **Trust but Verify Docs:** Documentation claiming "automatic derivation" must be backed by code.
- **UX State Management:** Spinners must always stop before handing control to the user (prompts), regardless of logging level.
