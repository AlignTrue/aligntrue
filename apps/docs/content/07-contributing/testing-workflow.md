---
title: Testing workflow
description: Testing standards and practices for AlignTrue contributions including test types, patterns, and coverage requirements.
---

# Testing workflow

AlignTrue uses Vitest for unit and integration tests. All contributions must include tests. This guide covers testing patterns, standards, and how to validate your work.

## Running tests

### Run all tests

```bash
pnpm test
```

### Run tests for a specific package

```bash
pnpm --filter @aligntrue/core test
pnpm --filter @aligntrue/cli test
```

### Watch mode (recommended during development)

```bash
pnpm test --watch
```

Reruns tests when files change.

### Run a single test file

```bash
pnpm --filter @aligntrue/core test packages/core/tests/bundle.test.ts
```

### Run tests matching a pattern

```bash
pnpm test --grep "determinism"
```

## Test structure

Tests mirror source structure. For a source file, create a test file at:

```
packages/core/
├── src/
│   └── bundle.ts
└── tests/
    └── bundle.test.ts
```

### Test file naming

- **Unit tests**: `<name>.test.ts` or `<name>.spec.ts`
- **Integration tests**: `<name>.integration.test.ts`
- **Fixtures**: `fixtures/<name>/` directory

## Writing tests

### TDD workflow

Follow Test-Driven Development:

1. Write a failing test
2. Implement the feature
3. Verify the test passes
4. Refactor if needed

This ensures:

- Tests validate the requirement, not the implementation
- Code is testable by design
- Coverage stays high

### Basic test structure

```typescript
import { describe, it, expect } from "vitest";
import { parseBundle } from "../src/bundle";

describe("parseBundle", () => {
  it("parses valid bundle", () => {
    const bundle = { rules: [] };
    const result = parseBundle(bundle);
    expect(result.rules).toEqual([]);
  });

  it("throws on invalid bundle", () => {
    expect(() => parseBundle({ invalid: true })).toThrow();
  });
});
```

### Test types

#### Unit tests

Test individual functions in isolation:

```typescript
it("computes hash deterministically", () => {
  const input = { key: "value" };
  const hash1 = computeHash(input);
  const hash2 = computeHash(input);
  expect(hash1).toBe(hash2);
});
```

#### Integration tests

Test how components work together:

```typescript
it("syncs config to agent files", async () => {
  const config = loadConfig(".aligntrue.yaml");
  const rules = compileRules(config);
  const result = exportToAgent(rules);
  expect(result.filesWritten).toContain(".cursor/rules/main.mdc");
});
```

#### Determinism tests

Test that operations produce identical outputs:

```typescript
it("generates identical lockfile hashes", () => {
  const bundle = compileBunde(config);
  const hash1 = computeLockfileHash(bundle);
  const hash2 = computeLockfileHash(bundle);
  expect(hash1).toBe(hash2);
});
```

Determinism is critical for:

- Exporters (same rules = same files)
- Lockfiles (versioning and drift detection)
- Validation (reproducible errors)

#### Snapshot tests

Validate output format hasn't changed:

```typescript
it("exports correct YAML format", async () => {
  const result = await exporter.export(request);
  const content = await fs.readFile(result.filesWritten[0], "utf-8");
  expect(content).toMatchSnapshot();
});
```

First run generates snapshot, subsequent runs validate.

## Test patterns

### Fixtures and test data

Create reusable test data:

```typescript
// tests/fixtures/rules.ts
export const singleRule = {
  id: "test.rule",
  summary: "Test rule",
  severity: "error",
};

export const multipleRules = [singleRule /* ... */];
```

Use in tests:

```typescript
import { singleRule } from "./fixtures/rules";

it("exports single rule", async () => {
  const result = await exporter.export({ rules: [singleRule] });
  expect(result.filesWritten.length).toBe(1);
});
```

### Mocking and stubbing

Mock dependencies:

```typescript
import { vi } from "vitest";

it("calls logger on error", async () => {
  const logger = { error: vi.fn() };
  await syncRules(config, logger);
  expect(logger.error).toHaveBeenCalled();
});
```

### Temporary files and cleanup

Clean up after tests:

```typescript
import { unlinkSync, existsSync } from "fs";

describe("file writing", () => {
  afterEach(() => {
    if (existsSync(".test-output.md")) {
      unlinkSync(".test-output.md");
    }
  });

  it("writes file", async () => {
    await writeFile(".test-output.md", "content");
    expect(existsSync(".test-output.md")).toBe(true);
  });
});
```

### Error testing

Test error paths:

```typescript
it("validates required fields", () => {
  expect(() => {
    new Config({});
  }).toThrow(ValidationError);
});

it("includes helpful error message", () => {
  expect(() => {
    validateSchema(invalid);
  }).toThrow(/expected string/i);
});
```

## Coverage requirements

### Target coverage

- **New features**: 80%+ line coverage
- **Bug fixes**: 100% for the fixed code path
- **Refactors**: Match or improve existing coverage

### Check coverage

```bash
pnpm test --coverage
```

Coverage reports are generated in `coverage/` directory.

### Coverage for different packages

- `@aligntrue/core`: 85%+
- `@aligntrue/cli`: 80%+
- `@aligntrue/schema`: 90%+ (critical for validation)
- `@aligntrue/exporters`: 85%+

## CI integration

### GitHub Actions

Tests run on every PR:

```yaml
pnpm test
pnpm lint
```

### Pre-commit hook

Tests can run before commit:

```bash
git commit -m "feat: new feature"
# Hooks run:
# - pnpm lint
# - pnpm test (critical tests only)
```

### Merge requirements

PRs must pass:

- All tests pass (`pnpm test`)
- Linting passes (`pnpm lint`)
- Coverage doesn't decrease significantly

## Best practices

### What to test

- **Behavior**: Not implementation details
- **Edge cases**: Empty inputs, null values, errors
- **Contracts**: Function signatures and return types
- **Determinism**: Outputs are reproducible

### What not to test

- External libraries (assume they work)
- Simple getters/setters without logic
- Formatting that's validated elsewhere (linting)
- Implementation details of private functions

### Test naming

Use clear, descriptive names:

```typescript
// Good
it("throws ValidationError when profile id is missing", () => {});

// Bad
it("validates config", () => {});
```

### One assertion per test (when possible)

```typescript
// Good: focused tests
it("returns correct name", () => {
  expect(result.name).toBe("Test");
});

it("returns correct age", () => {
  expect(result.age).toBe(25);
});

// Also ok: related assertions
it("returns correct user data", () => {
  expect(result.name).toBe("Test");
  expect(result.age).toBe(25);
});
```

### Use beforeEach/afterEach for setup/cleanup

```typescript
describe("Database operations", () => {
  let db: Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("stores data", () => {
    db.insert("users", { id: 1 });
    expect(db.query("users")).toHaveLength(1);
  });
});
```

## Troubleshooting

### Tests fail locally but pass in CI

**Cause**: Environment differences (timezone, OS, Node version)

**Solution**:

- Check Node version: `node -v` should match CI
- Set timezone: `TZ=UTC pnpm test`
- Check OS-specific paths (Windows vs Unix)

### Flaky tests

**Cause**: Timing issues, non-determinism, external dependencies

**Solution**:

- Avoid `setTimeout` unless testing async behavior
- Mock external services
- Use deterministic test data
- Run tests multiple times: `pnpm test --reporter=verbose` and look for failures

### Coverage not reflecting changes

**Cause**: Cache not cleared

**Solution**:

```bash
rm -rf coverage/
pnpm test --coverage
```

## Examples

See the codebase for real examples:

- Unit tests: `packages/core/tests/validation.test.ts`
- Integration tests: `packages/cli/tests/sync.test.ts`
- Fixtures: `packages/exporters/tests/fixtures/`
- Snapshots: `packages/exporters/tests/__snapshots__/`

## See also

- [Vitest documentation](https://vitest.dev)
- For testing decisions, see the test structure and patterns section above
- [How to contribute](/docs/07-contributing/getting-started)
- [Development setup](/docs/06-development/setup)
