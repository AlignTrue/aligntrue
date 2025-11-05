## CLI Test Patterns

AlignTrue CLI uses a **hybrid testing approach** with two test types:

1. **Smoke tests** (`tests/commands/*`) - Fast, minimal validation
2. **Integration tests** (`tests/integration/*`) - Real file system operations

## Test Philosophy

**Smoke tests** catch obvious breaks quickly:

- Verify command doesn't crash
- Check help flags work
- Validate basic argument parsing
- Run in <1 second total

**Integration tests** verify actual behavior:

- Use real file system operations
- Import real `@aligntrue/*` packages (no mocks)
- Create temp directories for isolation
- Verify actual outputs and side effects

## When to Use Each Type

### Use Smoke Tests For

- Help flag validation (`--help`, `-h`)
- Basic argument validation
- Quick sanity checks
- Commands that are low-risk or rarely change

### Use Integration Tests For

- Core workflow commands (init, sync, check)
- File creation and modification
- Config updates
- Export generation
- Any behavior that matters to users

## Integration Test Pattern

All integration tests follow this pattern:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { myCommand } from "../../src/commands/mycommand.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-mycommand");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("My Command Integration", () => {
  it("creates expected files", async () => {
    // Setup: Create config
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    const config = { exporters: ["cursor"] };
    writeFileSync(
      join(TEST_DIR, ".aligntrue", "config.yaml"),
      yaml.stringify(config),
      "utf-8",
    );

    // Execute command
    await myCommand(["--flag", "value"]);

    // Verify: Check actual file system changes
    expect(existsSync(join(TEST_DIR, "output.txt"))).toBe(true);
    const content = readFileSync(join(TEST_DIR, "output.txt"), "utf-8");
    expect(content).toContain("expected content");
  });
});
```

## Key Principles

### 1. No Mocking of @aligntrue/\* Packages

```typescript
// ❌ BAD: Mocking internal packages
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));

// ✅ GOOD: Use real packages
import { loadConfig, saveConfig } from "@aligntrue/core";
```

### 2. Real File System Operations

```typescript
// ❌ BAD: Mocking fs
vi.mock("fs");

// ✅ GOOD: Use real fs with temp directories
import { writeFileSync, readFileSync } from "fs";
const TEST_DIR = join(tmpdir(), "aligntrue-test-mycommand");
```

### 3. Isolated Test Directories

```typescript
// ✅ GOOD: Each test gets fresh directory
beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
  process.chdir(TEST_DIR);
});
```

### 4. Mock Only External Services

```typescript
// ✅ OK: Mock network calls, not internal logic
vi.mock("node-fetch");
```

### 5. Handle process.exit

```typescript
// ✅ GOOD: Mock process.exit to capture exit codes
const originalExit = process.exit;
let exitCode: number | undefined;
process.exit = ((code?: number) => {
  exitCode = code;
}) as never;

await myCommand([]);

process.exit = originalExit;
expect(exitCode).toBe(0);
```

## Smoke Test Pattern

Smoke tests are minimal and fast:

```typescript
import { describe, it, expect } from "vitest";
import { myCommand } from "../../src/commands/mycommand.js";

describe("mycommand - smoke tests", () => {
  it("shows help with --help flag", async () => {
    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (() => {
      exitCalled = true;
    }) as never;

    await myCommand(["--help"]);

    process.exit = originalExit;
    expect(exitCalled).toBe(true);
  });

  it("requires config file", async () => {
    const originalExit = process.exit;
    let exitCode: number | undefined;
    process.exit = ((code?: number) => {
      exitCode = code;
    }) as never;

    await myCommand([]);

    process.exit = originalExit;
    expect(exitCode).toBeGreaterThan(0);
  });
});
```

## Test Coverage Goals

- **Integration tests**: 80%+ coverage for core commands
- **Smoke tests**: Basic validation for all commands
- **Critical paths**: 100% coverage (init, sync, check)

## Example Test Files

**Integration Tests:**

- `tests/integration/init-command.test.ts` - File creation, config setup
- `tests/integration/sync-command.test.ts` - Export generation, backups
- `tests/integration/check-command.test.ts` - Validation, error reporting
- `tests/integration/team-command.test.ts` - Lockfile operations
- `tests/integration/override-add-command.test.ts` - Config updates

**Smoke Tests:**

- `tests/commands/sync.test.ts` - Help, basic validation
- `tests/commands/override-add.test.ts` - Argument parsing
- `tests/commands/override-remove.test.ts` - Basic checks
- `tests/commands/override-status.test.ts` - Help validation

## Running Tests

```bash
# All tests
pnpm test

# Integration tests only
pnpm test tests/integration

# Smoke tests only
pnpm test tests/commands

# Single file
pnpm test init-command.test.ts

# Watch mode
pnpm test:watch
```

## Anti-Patterns to Avoid

### ❌ Heavy Mocking

```typescript
// BAD: 100+ lines of mocks
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  loadIR: vi.fn(),
  SyncEngine: vi.fn(),
  // ... 50 more mocks
}));
```

### ❌ Testing Implementation Details

```typescript
// BAD: Testing internal function calls
expect(mockLoadConfig).toHaveBeenCalledWith(configPath);

// GOOD: Testing actual behavior
expect(existsSync(configPath)).toBe(true);
const config = yaml.parse(readFileSync(configPath, "utf-8"));
expect(config.exporters).toContain("cursor");
```

### ❌ Shared Test State

```typescript
// BAD: Tests depend on each other
let sharedConfig: Config;
it("test 1", () => { sharedConfig = {...} });
it("test 2", () => { /* uses sharedConfig */ });

// GOOD: Each test is independent
beforeEach(() => {
  // Fresh setup for each test
});
```

## Benefits of This Approach

1. **Tests survive refactors** - Internal API changes don't break tests
2. **Faster to write** - No complex mock setup
3. **More reliable** - Tests verify actual behavior
4. **Better debugging** - Failures indicate real problems
5. **Maintainable** - Less mock drift over time

## Migration Notes

When converting mock-heavy tests to integration tests:

1. Delete excessive mocks
2. Create temp directory setup
3. Use real file operations
4. Verify actual outputs
5. Keep 3-5 smoke tests for quick validation

The goal: **Durable tests that verify user-facing behavior, not implementation details.**
