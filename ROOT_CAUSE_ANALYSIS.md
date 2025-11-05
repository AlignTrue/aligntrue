# Root Cause Analysis: Unused Variable Pattern Breaking Tests

**Date:** 2025-11-05  
**Issue:** Test failures due to variable declaration/usage mismatches  
**Severity:** High (blocks git push via pre-push hook)

---

## Executive Summary

The recurring test failures are caused by a **race condition between automated linting fixes and manual code changes**, compounded by ESLint's underscore-prefix convention for intentionally unused variables. The tooling is working as designed, but the workflow creates opportunities for mismatches.

---

## Timeline of Events

### Commit 3cb05ff (2025-11-05 00:08:19)

**"fix: Remove unused variables from test files"**

ESLint's `unused-imports` plugin detected `_processExitSpy` was declared but never used in `sync.test.ts`:

```diff
- let _processExitSpy: unknown;
```

The variable was removed because it appeared unused (the assignment on line 125 used `processExitSpy` without the underscore).

### Commit f2b2053 (2025-11-05 00:25:11)

**"docs: Docs site fixes, remove dups"**

Someone (likely AI or manual edit) added the underscore prefix back to the declaration but **not** to the usage:

```diff
+ let _processExitSpy: unknown;
```

But line 125 still assigned to `processExitSpy` (without underscore), creating a mismatch.

### Result

- Declaration: `_processExitSpy`
- Usage: `processExitSpy`
- Test fails with `ReferenceError: processExitSpy is not defined`
- Pre-push hook blocks the push

---

## Root Causes

### 1. ESLint Convention Confusion

**The Pattern:**

```javascript
// ESLint config (eslint.config.js:80-82)
varsIgnorePattern: "^_",
argsIgnorePattern: "^_",
```

Variables prefixed with `_` are **intentionally ignored** by the unused-vars linter. This is a common convention for:

- Variables that must exist for interface compliance
- Variables reserved for future use
- Variables that are assigned but not read

**The Problem:**
When you prefix a variable with `_`, you're telling ESLint "I know this looks unused, don't warn me." But if you later **do** use it, you must reference it **with** the underscore.

### 2. Inconsistent Application

In `sync.test.ts`:

- **Declaration:** `let _processExitSpy: unknown;` (line 112)
- **Assignment:** `processExitSpy = vi.spyOn(...)` (line 125) ❌ **Missing underscore**
- **No usage elsewhere:** The spy is never referenced after assignment

This creates two problems:

1. The assignment fails at runtime (ReferenceError)
2. The linter doesn't catch it because `_processExitSpy` matches the ignore pattern

### 3. High Commit Velocity

**82 commits in the last 2 days** creates pressure to:

- Make quick fixes without full context
- Batch unrelated changes together
- Skip thorough testing before pushing

### 4. Lint-Staged Scope

The pre-commit hook runs `lint-staged`, which only lints **staged files**:

```json
"lint-staged": {
  "*.{ts,tsx,js,jsx}": [
    "prettier --write",
    "eslint --max-warnings 460"
  ]
}
```

**Issue:** If you stage `sync.test.ts` with the declaration change but the assignment line isn't modified, the linter sees:

- ✅ Declaration: `_processExitSpy` (staged, looks fine)
- ❌ Assignment: `processExitSpy` (not staged, not linted)

The mismatch isn't caught until the pre-push hook runs **all tests**.

### 5. Test Execution Timing

- **Pre-commit:** Lints staged files only
- **Pre-push:** Runs full test suite (catches runtime errors)

**Gap:** 17 minutes between commits (00:08 → 00:25) suggests changes were staged incrementally, allowing mismatches to slip through.

---

## Why This Keeps Happening

### Pattern Analysis

Looking at recent commits:

```
3cb05ff fix: Remove unused variables from test files
c855d10 fix: Remove unused error variables and fix any type warnings
e37a23b fix: Resolve all remaining TypeScript errors
f8b1619 fix: Resolve TypeScript errors in packages/exporters
a3d23d0 fix: Resolve TypeScript errors in core packages
```

**5 consecutive "fix" commits** suggests:

1. Initial change introduces warnings
2. Automated/manual fix for warnings
3. Fix introduces new issue
4. Another fix commit
5. Repeat

This is a **fix cascade** pattern common when:

- Making large refactors
- Enabling stricter linting rules
- Working across many files simultaneously

---

## Specific Issues in sync.test.ts

### The Actual Bug

```typescript
// Line 112: Declaration with underscore
let _processExitSpy: unknown;

// Line 125: Assignment without underscore
processExitSpy = vi.spyOn(process, "exit").mockImplementation(...);
//           ^ Missing underscore prefix
```

### Why It Wasn't Caught Earlier

1. **TypeScript doesn't error:** `unknown` type allows implicit declaration
2. **ESLint ignores it:** `_processExitSpy` matches `varsIgnorePattern: "^_"`
3. **Pre-commit passes:** Only staged lines are linted
4. **Runtime fails:** Variable doesn't exist when assignment executes

### The Correct Fix

**Option A: Variable is actually unused (current state)**

```typescript
let _processExitSpy: unknown;

beforeEach(() => {
  _processExitSpy = vi.spyOn(process, "exit").mockImplementation(...);
  //^ Add underscore to match declaration
});
```

**Option B: Variable is used elsewhere**

```typescript
let processExitSpy: unknown;
//  ^ Remove underscore from declaration

beforeEach(() => {
  processExitSpy = vi.spyOn(process, "exit").mockImplementation(...);
});

afterEach(() => {
  processExitSpy.mockRestore(); // Example usage
});
```

**Option C: Variable truly unused**

```typescript
// Remove declaration entirely
beforeEach(() => {
  vi.spyOn(process, "exit").mockImplementation(...);
  // Don't store reference if never used
});
```

---

## Comparison with Other Test Files

### Files with Similar Patterns

**packages/cli/tests/commands/pull.test.ts:**

```typescript
let consoleLogSpy: unknown;
let consoleErrorSpy: unknown;
let processExitSpy: unknown; // ✅ No underscore, likely used
```

**packages/cli/tests/commands/drift.test.ts:**

```typescript
let exitSpy: unknown;
let consoleLogSpy: unknown;
let consoleErrorSpy: unknown; // ✅ No underscores
```

**packages/cli/tests/commands/sync.test.ts:**

```typescript
let consoleLogSpy: unknown;
let _processExitSpy: unknown; // ❌ Only one with underscore
let _mockIsSourceAllowed: unknown; // ❌ Another underscore
```

**Pattern:** `sync.test.ts` is an outlier. Other test files don't use underscore prefixes, suggesting these variables **are** used in normal test patterns.

---

## Systemic Issues

### 1. Tooling Configuration

**Current ESLint config is correct** but creates a footgun:

- `varsIgnorePattern: "^_"` is standard practice
- But it **silently allows** declaration/usage mismatches
- No warning when `_var` is declared but `var` is used

### 2. Pre-commit vs Pre-push Gap

**Pre-commit (lint-staged):**

- Fast (only staged files)
- Catches formatting and obvious issues
- **Misses:** Cross-file issues, runtime errors, test failures

**Pre-push (full suite):**

- Slow (all tests, all packages)
- Catches everything
- **Problem:** Fails after you've already committed

**Gap:** You can commit broken code that fails on push.

### 3. High Warning Threshold

```json
"lint": "eslint . --max-warnings 460"
```

**460 warnings allowed** means:

- New warnings can slip in unnoticed
- Hard to distinguish signal from noise
- Encourages "fix later" mentality

### 4. No TypeScript Strict Mode in Tests

ESLint config disables strict rules for tests:

```javascript
{
  files: ["**/*.test.ts", "**/*.test.tsx"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
  },
}
```

This is pragmatic but allows looser typing in tests where these issues occur.

---

## Recommended Solutions

### Immediate Fixes (Do Now)

#### 1. Add ESLint Rule for Declaration/Usage Mismatch

Create custom rule to catch this pattern:

```javascript
// eslint.config.js
const noUnderscoreMismatch = {
  create(context) {
    const declared = new Map();
    return {
      VariableDeclarator(node) {
        if (node.id.name.startsWith("_")) {
          declared.set(node.id.name.slice(1), node.id.name);
        }
      },
      Identifier(node) {
        const withUnderscore = `_${node.name}`;
        if (declared.has(node.name)) {
          context.report({
            node,
            message: `Variable declared as '${withUnderscore}' but used as '${node.name}'`,
          });
        }
      },
    };
  },
};
```

#### 2. Audit All Test Files

```bash
# Find all underscore-prefixed variables in tests
grep -r "let _\|const _" packages/*/tests/ --include="*.ts"

# Check if they're used without underscore
grep -r "processExitSpy\|mockIsSourceAllowed" packages/cli/tests/
```

#### 3. Fix sync.test.ts Properly

**Decision tree:**

- Is `_processExitSpy` used anywhere? → Remove underscore from declaration
- Is it truly unused? → Remove declaration entirely
- Must exist but unused? → Keep underscore in **both** places

### Short-term Improvements (This Week)

#### 4. Add Pre-commit Test Smoke Check

```javascript
// scripts/git-hooks/pre-commit.mjs
s.start("Running smoke tests...");
try {
  // Run fast subset of tests on staged files
  execSync("pnpm test:fast --changed", { stdio: "inherit" });
  s.stop("✅ Smoke tests passed.");
} catch (error) {
  s.stop("❌ Smoke tests failed.", 1);
  // Suggest running full test suite
  process.exit(1);
}
```

#### 5. Reduce Warning Threshold Gradually

```json
// package.json
"lint": "eslint . --max-warnings 400",  // Down from 460
```

Set a goal to reduce by 60 warnings per week until reaching 0.

#### 6. Add TypeScript Strict Checks to Test Setup

```javascript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.test.json",
    },
  },
});
```

### Long-term Improvements (Next Month)

#### 7. Implement Conventional Commits Enforcement

```javascript
// commitlint.config.js
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "docs", "refactor", "test", "chore"],
    ],
    "subject-case": [2, "always", "sentence-case"],
  },
};
```

**Benefit:** Clearer commit history, easier to track fix cascades.

#### 8. Add Commit Size Limits

```javascript
// scripts/git-hooks/pre-commit.mjs
if (stagedFiles.length > 20) {
  clack.log.error("❌ Commit too large (>20 files)");
  clack.log.message("Split into smaller, focused commits");
  process.exit(1);
}
```

**Benefit:** Forces smaller, testable changes.

#### 9. Enable TypeScript Strict Mode for Tests

Remove the test exception:

```javascript
// eslint.config.js
- {
-   files: ["**/*.test.ts", "**/*.test.tsx"],
-   rules: {
-     "@typescript-eslint/no-explicit-any": "off",
-   },
- },
```

**Benefit:** Catch type issues earlier.

#### 10. Implement Test Coverage Gates

```json
// vitest.config.ts
export default {
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
};
```

---

## Prevention Checklist

Before committing:

- [ ] Run `pnpm lint` (not just `lint-staged`)
- [ ] Run `pnpm test` (not just on changed files)
- [ ] Check for underscore-prefixed variables in your changes
- [ ] Verify variable names match between declaration and usage
- [ ] Review git diff for unintended changes

Before pushing:

- [ ] Ensure all commits have passed pre-commit hooks
- [ ] Run `pnpm typecheck` across all packages
- [ ] Verify no new warnings introduced
- [ ] Check that commit messages are descriptive

---

## Metrics to Track

### Current State

- **Warning count:** 460 (at threshold)
- **Commits/day:** 41 (82 in 2 days)
- **Fix commits:** 5 consecutive in recent history
- **Test files with underscores:** 1 (sync.test.ts)

### Target State (30 days)

- **Warning count:** <100
- **Commits/day:** <20 (more focused commits)
- **Fix commits:** <2 consecutive (better first-time quality)
- **Test files with underscores:** 0 (consistent naming)

---

## Conclusion

This isn't a single bug—it's a **workflow issue** amplified by:

1. High commit velocity (82 commits/2 days)
2. Lenient linting (460 warnings allowed)
3. Gap between pre-commit and pre-push checks
4. Underscore convention creating silent failures

**The fix is simple** (add underscore to line 125), but **preventing recurrence** requires:

- Slower, more deliberate commits
- Stricter linting enforcement
- Better tooling to catch mismatches
- Consistent variable naming conventions

**Priority:** Implement immediate fixes today, short-term improvements this week, long-term improvements over the next sprint.
