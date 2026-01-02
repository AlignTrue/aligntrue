---
title: Test maintenance
description: How to maintain tests after core format and path changes
---

# Test maintenance: Core format and path changes

**When to apply**: After commits that change core file formats, paths, or schemas (e.g., YAML vs markdown, `.rules.yaml` vs `rules.md`).

## Problem

Core format changes break many tests at once. The pre-push hook catches this before push, but requires systematic updates.

## Real example

**Commit:** `3315bd09cd2335acdb4ee1dca3cdbf8557570a5e` (2025-11-06)  
**Change:** Switched from markdown-first to agent-format-first architecture

**Result:** 4 test failures

- `packages/cli/tests/commands/import.test.ts`
- `packages/cli/tests/integration/init-command.test.ts` (2 tests)
- `packages/cli/tests/integration/performance.test.ts`

**Root cause:** Tests expected outdated file paths or formats that have been replaced in the current implementation.

**Time to fix:** ~10 minutes with systematic search and replace.

## Solution: Search → update → verify

### Step 1: Identify affected tests

```bash
# Find references to old formats/paths across tests
rg "old-file-name|old-extension" packages/*/tests

# Example: locate deprecated rule file naming
rg "\.rules\.yaml" packages/*/tests

# Narrow to a package or file when the blast radius is known
rg "legacy-marker" packages/cli/tests/integration
```

### Step 2: Update each test file

For each file found, make these changes:

1. **Update file paths**: Use current expected paths
2. **Update expectations**: Match current format/schema
3. **Update config sources**: If config points to old path, update it
4. **Update content checks**: Match current output format

### Pattern example: File format migration

```typescript
// Before
const rulesPath = join(testDir, ".aligntrue", "old-format.md");
const content = readFileSync(rulesPath, "utf-8");
expect(content).toContain("legacy-marker");

// After: current `.aligntrue/rules/*.md`
const rulesPath = join(testDir, ".aligntrue", "rules", "demo-rule.md");
const content = readFileSync(rulesPath, "utf-8");
expect(content).toContain("---"); // frontmatter delimiter
expect(content).toContain("spec_version: 1");
expect(content).toContain("id: demo-rule");
```

### Step 3: Run tests to verify

```bash
# Target one file to iterate quickly
pnpm --filter @aligntrue/cli vitest run packages/cli/tests/commands/import.test.ts

# Target a single test when fixing assertions
pnpm --filter @aligntrue/cli vitest run packages/cli/tests/integration -- -t "init writes rule frontmatter"

# Update snapshots/fixtures if formats changed
pnpm --filter @aligntrue/core vitest -u

# Full sweep before push
pnpm test
```

## Prevention: Atomic commits

**When making core format changes**, include test updates in the same commit:

```bash
# Good commit message
feat: Switch from YAML-first to agent-format-first
  - Update init command to create .cursor/*.mdc first
  - Update core IR loader to accept only .yaml/.yml
  - Update 3 test files to expect new format

# Bad: leaving test updates for later
feat: Switch to agent-format-first
  (Note: tests failing, will fix separately)
```

Also include any regenerated snapshots or updated fixtures in the same commit to keep history consistent and avoid flaky reviews.

## Why this matters

The pre-push hook catches these failures before they hit `main`, but:

- Catching them early saves CI runs
- Fixing them immediately prevents context-switching
- Atomic commits make git history cleaner
- Reviewers see the full picture in one commit

## Related documentation

- [Development setup](/docs/06-development/setup)
