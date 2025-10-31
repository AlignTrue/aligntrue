---
description: Test decision framework and quality guidelines.
alwaysApply: false
---

# Testing decision framework

> **Core principle**: Tests should catch bugs, not accumulate cruft.

Use the **5-question framework** before adding any test to decide if it is worth writing. Keep tests fast, focused, and deterministic.

---

## 5-question decision framework

Ask in order

### 1. Has this actually broken in CI or real usage

**YES** → write a regression test
**NO** → go to 2

**Examples**

- ✅ Bundle merge produced unstable key order on CI → `packages/schema/tests/bundle.contract.test.ts`
- ❌ Hypothetical negative value for an option no one uses → skip

### 2. Does this test a boundary or contract

**YES** → write a contract test that targets the public surface
**NO** → go to 3

**Examples**

- ✅ Lockfile must pin content hashes regardless of input order → `packages/schema/tests/lockfile.contract.test.ts`
- ❌ Internal string formatter behavior → skip

### 3. Does this duplicate existing coverage

**YES** → delete or consolidate
**NO** → go to 4

**Examples**

- ✅ Three config loader tests checking the same failure mode → consolidate to one parametrized test
- ❌ Two tests that hit `export cursor` with different bundles and assertions → keep

### 4. Is this testing implementation details

**YES** → refactor to test observable behavior or delete
**NO** → go to 5

**Examples**

- ✅ Verifying `canonicalize.ts` calls a specific helper → delete
- ❌ Verifying `exportBundle("cursor")` writes a footer with the content hash → keep

### 5. Is this just for coverage percentage

**YES** → delete
**NO** → probably keep

**Examples**

- ✅ `test("imports work", () => { require("../index") })` → delete
- ❌ Error handling on malformed `.aligntrue.yaml` → keep

---

## Golden rule

**If removing the test would not increase production bugs, delete it.**

Tests should

- Catch real regressions
- Document contracts
- Fail when behavior changes

Tests should not

- Exist to pad coverage
- Assert implementation details
- Duplicate other tests
- Re-test library behavior

---

## Test categories

### ✅ Keep these

**1. Contract tests** `packages/*/tests/contracts/`
Public APIs and boundaries, fast
Examples

- `packages/schema/tests/contracts/exporter.cursor.contract.test.ts`
- `packages/schema/tests/contracts/lockfile.contract.test.ts`

**2. Critical regression guards**
One test per critical bug
Examples

- `packages/cli/tests/guards/ci_regressions.test.ts`

**3. Integration tests**
End to end workflows
Examples

- `packages/cli/tests/integration/bundle_to_export.e2e.test.ts`

**4. Performance regression tests**
Protect UX and CI times, loose thresholds
Examples

- `packages/cli/tests/perf/cli_help.perf.test.ts` target `<300ms`

### ⚠️ Be careful with

**Parameterized tests**
Good for many inputs to one contract
Rule max 10 parameters per test

**Smoke tests**
Must assert something meaningful
Not just “does not crash”

**Edge cases**
Write only if seen in real usage or clearly likely

### ❌ Delete these

**Coverage shims**

```ts
test("module import smoke", () => {
  require("../../src/core/_io");
});
```

**Import only tests**

```ts
test("metrics module imports", () => {
  require("../../src/metrics");
});
```

**Implementation detail tests**

```ts
import { _format } from "../../src/internal/helpers";
test("internal format", () => expect(_format(1.23)).toBe("1.23"));
```

**Duplicate tests**

```
test("loads config from yaml", ...)   // duplicate of another config load test
```

---

## Test organization

File structure

```
tests/
├─ contracts/           # Public surfaces and boundaries
├─ integration/         # Multi component flows
├─ core/                # Canonicalization, hashing, bundle, lockfile
├─ exporters/           # Cursor, Codex
├─ perf/                # Performance guards
├─ unit/                # Small pure units
└─ setup.ts             # Shared setup if needed
```

When inside packages, mirror `src/` (e.g., `packages/schema/tests/canonicalize/…`).

Naming conventions

- `*.contract.test.ts` for contracts
- `*.e2e.test.ts` for end to end
- `*.perf.test.ts` for performance
- `*.guards.test.ts` for known regressions
- Test names describe behavior, not implementation

Good

```
test("export cursor writes content hash footer")
test("bundle merges set like arrays in stable order")
```

Bad

```
test("uses JSON stringify")
test("calls sortKeys")
```

---

## Temporary file management

Critical rule: all AI-generated test artifacts must use `temp-` prefix.

Required patterns

- `temp-audit.html`, `temp-config.yaml`, `temp-lockfile.json`
- `temp-test-output.md`, `temp-bundle.yaml`
- `temp-test-project/`, `temp-model.json`

Forbidden patterns not cleaned by scripts

- `test_*.html`, `test-*.yaml` in repo root
- `audit_*.html`, `audit_*.manifest.json`
- `*_config.yaml` in root
- `audit.html`, `report.html`, `model.pkl`

When non temp names are allowed

- Only in `examples/`, `artifacts/`, or `docs/`

Optional scratch area

```
.ai-scratch/
  temp-config-1.yaml
```

---

## Local workflow integration

### Pre-commit (automatic via Husky)

- Runs on staged files only (<3 seconds)
- Prettier auto-formatting
- Fails commit if errors found

### Pre-push (automatic via Husky)

- Full typecheck across all packages
- Full test suite (all packages)
- Full build to catch build errors
- Takes ~30-60 seconds
- Mirrors CI validation

### Bypassing hooks (emergency only)

```bash
git commit --no-verify   # Skip pre-commit
git push --no-verify     # Skip pre-push
```

Only use when hooks are genuinely broken, not to skip validation.

---

## Related rules

- `tdd.mdc` - TDD workflow for new features
- `debugging.mdc` - Debugging failed tests
- `typescript.mdc` - Type-safe testing patterns
- `implementation_specs.mdc` - Determinism requirements
