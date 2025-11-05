## CLI Test Patterns

Standard patterns for testing AlignTrue CLI commands with Vitest.

## Overview

All CLI tests use mock-based patterns with standardized setup. Tests verify command behavior through mocked dependencies rather than integration testing.

## Standard Test Pattern

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import * as clack from "@clack/prompts";

// Mock dependencies before imports
vi.mock("fs");
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  // ... other mocks
}));

import { myCommand } from "../../src/commands/mycommand.js";
import * as core from "@aligntrue/core";
import { existsSync } from "fs";

describe("My Command - Basic Behavior", () => {
  let mockExit: ReturnType<typeof vi.spyOn>;
  let mockLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
    mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

    vi.mocked(clack.log.error).mockImplementation(() => {});
    vi.mocked(clack.log.success).mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);

    vi.mocked(core.loadConfig).mockResolvedValue({
      version: "1",
      mode: "solo",
      exporters: ["cursor"],
      sources: [],
    });
  });

  it("executes successfully", async () => {
    await myCommand(["--flag", "value"]);

    expect(mockExit).toHaveBeenCalledWith(0);
    expect(core.loadConfig).toHaveBeenCalled();
  });
});
```

## Test Structure

### 1. Mock Dependencies Before Imports

Always mock before importing the module under test:

```typescript
vi.mock("fs");
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
}));
```

### 2. Group Tests by Scenario

Use descriptive suite names:

- `Command Name - Basic Behavior`
- `Command Name - Error Cases`
- `Command Name - Interactive Mode`
- `Command Name - Validation`

### 3. Setup Common Mocks in beforeEach

Reset mocks and set default behavior:

```typescript
beforeEach(() => {
  vi.clearAllMocks();

  mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as any);
  mockLog = vi.spyOn(console, "log").mockImplementation(() => {});

  // Set default mocks
  vi.mocked(core.loadConfig).mockResolvedValue(defaultConfig);
});
```

## Common Patterns

### Testing Command Execution

```typescript
it("executes with flags", async () => {
  await myCommand(["--config", "custom.yaml", "--dry-run"]);

  expect(mockExit).toHaveBeenCalledWith(0);
  expect(core.loadConfig).toHaveBeenCalledWith("custom.yaml");
});
```

### Testing Error Cases

```typescript
it("shows error for invalid input", async () => {
  await myCommand(["--invalid"]);

  expect(mockExit).toHaveBeenCalledWith(1);
  expect(clack.log.error).toHaveBeenCalledWith(
    expect.stringContaining("Invalid"),
  );
});
```

### Testing Interactive Prompts

```typescript
it("prompts user for confirmation", async () => {
  vi.mocked(clack.confirm).mockResolvedValue(true);

  await myCommand([]);

  expect(clack.confirm).toHaveBeenCalled();
  expect(core.saveConfig).toHaveBeenCalled();
});
```

### Testing Output

```typescript
it("outputs expected format", async () => {
  await myCommand(["--json"]);

  const output = mockLog.mock.calls.map((call) => call.join(" ")).join("\n");

  const json = JSON.parse(output);
  expect(json.status).toBe("success");
});
```

## Test Coverage Goals

- **80%+ coverage** for CLI commands
- **100% coverage** for critical paths (sync, init, config)
- **Error paths** tested for all validation and file operations
- **Interactive flows** tested with mocked prompts

## Known Limitations

### Process.exit Mocking

Mocked `process.exit` doesn't stop execution. Tests expecting non-execution after exit may fail:

```typescript
// This pattern has limitations
mockExit.mockImplementation(() => {});
await myCommand([]); // Continues executing after process.exit(1)

// For critical cases, make exit throw
mockExit.mockImplementationOnce((code) => {
  throw new Error(`process.exit: ${code}`);
});
await expect(myCommand([])).rejects.toThrow("process.exit: 1");
```

### File System Mocking

Tests mock `fs` but don't create real files. Focus on API calls rather than file contents:

```typescript
// Good: Test that saveConfig was called
expect(core.saveConfig).toHaveBeenCalledWith(expectedConfig);

// Avoid: Testing actual file writes (too implementation-specific)
```

## Helper Utilities

See `tests/utils/test-helpers.ts` for shared utilities:

- `setupStandardMocks()` - Standard mock setup
- `extractJsonOutput()` - Find JSON in console output
- `getCombinedOutput()` - Combine all console calls
- `mockCoreModule()` - Standard @aligntrue/core mocks

## Tips

1. **Keep tests focused** - One behavior per test
2. **Use descriptive names** - Test name should explain what's being verified
3. **Mock at module level** - Use `vi.mock()` before imports
4. **Reset between tests** - Always call `vi.clearAllMocks()` in `beforeEach`
5. **Test happy and error paths** - Both success and failure cases
6. **Avoid testing implementation details** - Focus on observable behavior

## Anti-Patterns to Avoid

❌ **Testing internal functions directly**

```typescript
// Bad: Testing private helper
import { parseArgs } from "../../src/commands/helpers.js";
```

✅ **Test through public API**

```typescript
// Good: Test command with args
await myCommand(["--config", "test.yaml"]);
```

❌ **Complex mock setup per test**

```typescript
// Bad: Repeated setup in each test
it("test 1", async () => {
  vi.mocked(core.loadConfig).mockResolvedValue(...);
  vi.mocked(core.saveConfig).mockResolvedValue(...);
  // ...
});
```

✅ **Common setup in beforeEach**

```typescript
// Good: Setup once, override when needed
beforeEach(() => {
  vi.mocked(core.loadConfig).mockResolvedValue(defaultConfig);
});

it("test with override", async () => {
  vi.mocked(core.loadConfig).mockResolvedValue(customConfig);
  // ...
});
```

## Example Test Files

Reference these for patterns:

- `tests/commands/sync.test.ts` - Complex command with multiple modes
- `tests/commands/team.test.ts` - Subcommand routing
- `tests/commands/override-add.test.ts` - Flag parsing and validation
- `tests/commands/override-status.test.ts` - JSON output formatting

## Running Tests

```bash
# All tests
pnpm test

# Single file
pnpm test sync.test.ts

# Watch mode
pnpm test:watch

# With coverage
pnpm test --coverage
```
