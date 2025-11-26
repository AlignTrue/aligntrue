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
- `tests/integration/git-sources.test.ts` - Remote git source operations
- `tests/integration/personal-remote.test.ts` - Personal remote workflow
- `tests/integration/performance.test.ts` - Performance benchmarks and large rule sets

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

## Remote Workflow Testing

Tests for personal remote workflow use the `AlignTrue/examples` GitHub repository for deterministic testing.

### Test Fixtures

Fixtures are located in `examples/remote-test/`:

- `personal-rules.md` - Personal coding preferences (10 sections)
- `large-rules/` - Large rule set (10 files, 112 sections total)
- `README.md` - Documentation for fixtures

### Setup Requirements

1. Copy `examples/remote-test/` to `AlignTrue/examples` GitHub repo
2. Commit and get commit hash
3. Update `COMMIT_HASH` constant in test files:
   - `tests/integration/git-sources.test.ts`
   - `tests/integration/personal-remote.test.ts`

### Test Scenarios

**Git Sources (`git-sources.test.ts`):**

- Pull personal rules from GitHub repo
- Vendor align structure detection
- Align integrity validation

**Personal Remote (`personal-remote.test.ts`):**

- Remote configuration validation
- Sync from remote to local IR
- Merge team and personal rules
- Error handling (network, missing files, invalid URLs)

**Performance (`performance.test.ts`):**

- Large rule set sync (<60 seconds for 100+ sections)
- Memory usage monitoring (<500MB heap)
- Multi-file source performance
- No catastrophic slowdown with multiple files

### Running Remote Tests

```bash
# All integration tests (includes remote tests)
pnpm test tests/integration

# Specific remote tests
pnpm test git-sources.test.ts
pnpm test personal-remote.test.ts

# Performance tests with large rule sets
pnpm test performance.test.ts
```

### Skipping Behavior

Tests automatically skip when:

- `COMMIT_HASH` is not set (placeholder value)
- Network consent is required
- Git is not available
- Fixtures don't exist yet

### Enabling Remote and Performance Suites

Set `RUN_REMOTE_TESTS=1` before invoking `pnpm test` if you want the remote git and performance suites to run.
This keeps CI / default pre-commit runs fast and leaves the “run in playbook only” suites to explicit test sessions.

### Performance Thresholds

Current thresholds for large rule sets (100-150 sections):

- **Sync time**: <60 seconds (first run)
- **Sync time**: <30 seconds (subsequent runs)
- **Memory usage**: <500MB heap
- **File I/O**: No catastrophic slowdown with 10+ files

These thresholds catch performance regressions while allowing for platform variance.

### Updating Fixtures

To update test fixtures:

1. Edit files in `examples/remote-test/`
2. Copy entire directory to `AlignTrue/examples` repo
3. Commit and push to GitHub
4. Get new commit hash from GitHub
5. Update `COMMIT_HASH` in test files
6. Run tests to verify: `pnpm test tests/integration`

See `examples/remote-test/README.md` for detailed fixture documentation.
