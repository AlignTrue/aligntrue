# Core Package Tests

Test suite for `@aligntrue/core` sync engine, configuration, scope resolution, and file operations.

## Test Structure

```
tests/
  mocks/                    # Mock exporters for testing
    mock-exporter.ts        # Configurable mock implementing ExporterPlugin
    failing-exporter.ts     # Always-fail mock for error paths
  sync/                     # Sync engine tests
    engine.test.ts          # Sync orchestration (30+ tests)
    conflict-detector.test.ts  # Conflict detection (15+ tests)
    file-operations.test.ts # Atomic writes (22+ tests)
    ir-loader.test.ts       # IR loading (11+ tests)
  config.test.ts            # Configuration (43 tests)
  scope.test.ts             # Scope resolution (40 tests)
  fixtures/                 # Shared test fixtures
    valid-pack.yaml         # Valid IR example
```

## Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Specific test file
pnpm test tests/config.test.ts

# With coverage
pnpm test --coverage
```

## Test Status (Step 9 Complete)

**Total:** 148 tests  
**Passing:** 129 (87%)  
**Failing:** 19 (13%)

### Passing Test Suites ✅

- `tests/config.test.ts` - 43/43 passing (100%)
- `tests/scope.test.ts` - 40/40 passing (100%)
- `tests/sync/file-operations.test.ts` - 22/22 passing (100%)

### Failing Tests (Fixture Issues) 🔧

- `tests/sync/ir-loader.test.ts` - 6/11 passing (5 fixture issues)
- `tests/sync/engine.test.ts` - 8/19 passing (11 fixture issues)
- `tests/sync/conflict-detector.test.ts` - 10/13 passing (3 schema assumptions)

### Why Tests Fail

Most failing tests use incorrect test fixtures that don't match the actual IR schema v1:

**Common issues:**

1. Missing required fields (`id`, `version`, `spec_version`, `rules`)
2. Rules missing `applies_to` field (required, min 1 item)
3. Rule IDs using dots instead of kebab-case (`test.rule` → `test-rule`)
4. Empty rules arrays (schema requires min 1 rule)

**Example of invalid fixture:**

```yaml
# ❌ INVALID
id: test.pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule # Invalid: should be kebab-case
    severity: warn
    guidance: Test # Missing: applies_to field
```

**Correct fixture:**

```yaml
# ✅ VALID
id: test-pack
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: warn
    applies_to:
      - "**/*.ts"
    guidance: Test rule
```

### Fixing Test Fixtures

**For Step 10+:** Update test fixtures to use valid IR schema v1:

1. Update `tests/sync/ir-loader.test.ts`:
   - Fix markdown and YAML fixtures with valid schema
   - Ensure all rules have `applies_to` field
   - Use kebab-case for rule IDs

2. Update `tests/sync/engine.test.ts`:
   - Fix inline YAML/markdown strings
   - Add `applies_to` to all test rules

3. Update `tests/sync/conflict-detector.test.ts`:
   - Remove `tags` field from core field comparisons (not in AlignRule type)
   - Fix volatile field handling test expectations

**Reference fixture:**
See `tests/fixtures/valid-pack.yaml` for a complete valid example.

## Mock Exporters

### MockExporter

Configurable mock that tracks calls and returns configured results.

```typescript
import { MockExporter } from "../mocks/mock-exporter";

const exporter = new MockExporter("test-exporter")
  .setFilesToWrite(["output.txt"])
  .setFidelityNotes(["Feature X not supported"])
  .setContentHash("abc123");

engine.registerExporter(exporter);

// After sync
expect(exporter.getCallCount()).toBe(1);
expect(exporter.lastRequest?.rules).toHaveLength(1);
expect(exporter.wasCalledWithScope("apps/web")).toBe(true);
```

### FailingExporter

Always-fail exporter for error path testing.

```typescript
import { FailingExporter } from '../mocks/failing-exporter'

const exporter = new FailingExporter('failing-exporter', true)
  .setErrorMessage('Custom error message')

engine.registerExporter(exporter)

const result = await engine.syncToAgents(...)
expect(result.success).toBe(false)
```

## Test Patterns

### Config Loading Tests

```typescript
it("loads config from default path", async () => {
  const config = `version: "1"\nmode: solo\n`;
  writeFileSync(configPath, config, "utf8");

  const loaded = await loadConfig(configPath);
  expect(loaded.mode).toBe("solo");
});
```

### Sync Engine Tests

```typescript
it("syncs IR to agents successfully", async () => {
  const mockExporter = new MockExporter("test-exporter");
  engine.registerExporter(mockExporter);

  const result = await engine.syncToAgents(irPath, { dryRun: true });

  expect(result.success).toBe(true);
  expect(mockExporter.getCallCount()).toBe(1);
});
```

### Conflict Detection Tests

```typescript
it("detects severity conflicts", () => {
  const irRules = [{ id: "test-rule", severity: "warn", applies_to: ["**/*"] }];
  const agentRules = [
    { id: "test-rule", severity: "error", applies_to: ["**/*"] },
  ];

  const result = detector.detectConflicts("cursor", irRules, agentRules);

  expect(result.hasConflicts).toBe(true);
  expect(result.conflicts[0].field).toBe("severity");
});
```

## Coverage Goals

**Target:** >80% coverage for all modules

**Current (Step 9):**

- Config: ~95%
- Scope: ~90%
- File operations: ~85%
- Sync engine: ~70% (will improve when fixtures fixed)
- Conflict detector: ~75% (will improve when fixtures fixed)
- IR loader: ~65% (will improve when fixtures fixed)

## Known Issues

1. **Deprecation warning:** `fs.rmdirSync` with recursive option
   - **Fix:** Replace with `fs.rmSync` in cleanup code
   - **Impact:** Low (just warnings, tests pass)

2. **Test fixtures:** 19 tests fail due to invalid IR schema
   - **Fix:** Update fixtures to match IR v1 schema
   - **Priority:** Medium (will fix in Step 10+)

3. **Conflict detector:** Assumes `tags` field exists on AlignRule
   - **Fix:** Remove `tags` from core field comparisons
   - **Status:** Partial fix applied (removed from code, test needs update)

## Future Tests (Steps 10+)

- **Step 10:** Adapter registry tests
- **Steps 11-13:** Real exporter integration tests
- **Step 14:** Full two-way sync tests with conflict resolution
- **Step 17:** Agent→IR import tests

## Contributing to Tests

When adding new functionality:

1. **Add tests first** (TDD workflow)
2. **Use valid fixtures** (match IR v1 schema)
3. **Test both success and error paths**
4. **Add integration tests** for cross-module features
5. **Update this README** with new test patterns

---

**Test Philosophy:** Tests should validate contracts, not implementation details. Use mocks for external dependencies. Keep tests fast (<100ms per test).
