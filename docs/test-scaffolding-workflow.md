# Test Scaffolding Workflow

**Purpose:** How to add test scaffolds for future features without blocking CI.

---

## Problem

Pre-push hooks run the full test suite. If you add tests for unimplemented features, they fail and block pushes.

## Solution

Use `.skip` markers on test suites for future implementations:

```typescript
describe.skip("feature name (Phase X Session Y - Not Yet Implemented)", () => {
  // Tests here won't run but document expected behavior
});
```

## When to Use

**Do use .skip for:**

- Tests for features deferred to a specific future session
- Test scaffolds that document expected API/behavior
- Tests that would otherwise block development

**Don't use .skip for:**

- Flaky tests (fix them instead)
- Tests you're working on actively (use .only temporarily)
- Tests with unclear implementation plans

## Example: Drift Command (Phase 3 Session 5 → Session 6)

**Session 5:** Created command scaffolds and comprehensive test suite
**Session 6:** Will implement the actual drift detection logic

In Session 5, we added:

```typescript
// packages/cli/tests/commands/drift.test.ts
describe.skip("drift command (Phase 3 Session 6 - Not Yet Implemented)", () => {
  // 50+ tests documenting expected behavior
});
```

This allows us to:

1. Document expected behavior early (helps implementation)
2. Review test coverage before writing code
3. Avoid blocking pushes for 2-3 weeks until Session 6
4. Keep CI green while preserving scaffolds

## Workflow

### Adding Future Feature Tests

1. **Write comprehensive tests** documenting expected behavior
2. **Mark suite as skipped** with session reference:
   ```typescript
   describe.skip("feature (Phase X Session Y - Not Yet Implemented)", () => {
   ```
3. **Commit and push** - tests won't run but are tracked
4. **Remove .skip** when implementing the feature

### Converting Scaffolds to Implementation

When implementing:

1. Remove `.skip` marker
2. Run tests: `pnpm test path/to/test.test.ts`
3. Implement until tests pass
4. Commit with tests passing

## Prevention Strategy

**Don't ignore test files in .gitignore!**

Bad (Session 5 initial approach):

```gitignore
# .gitignore
**/drift.test.ts  # ❌ Hides scaffolds from git
```

Good (Session 5 fix):

```typescript
// drift.test.ts
describe.skip("...", () => {  // ✅ Tracked but not blocking
```

**Why:** `.skip` is better than `.gitignore` because:

- Tests are versioned and visible
- Team can review expected behavior
- Implementation session knows exactly what to build
- No accidental loss of test scaffolds

## Pre-Push Hook Behavior

The pre-push hook (`.husky/pre-push`) runs:

1. `pnpm -r build` - Ensures TypeScript compiles
2. `pnpm -r test` - Runs all tests (skipped tests don't fail)

**If tests fail:**

- Fix the failing tests
- OR mark as `.skip` with clear session reference
- OR use `git push --no-verify` (last resort for urgent fixes)

**Never:**

- Commit failing tests without `.skip`
- Ignore test files in .gitignore
- Use `--no-verify` as standard practice

---

## References

- **Phase 3 Session 5:** Drift command scaffolds created
- **Phase 3 Session 6:** Drift detection implementation planned
- **Example commit:** 990f721 "test: Track drift command scaffolds with .skip markers"
