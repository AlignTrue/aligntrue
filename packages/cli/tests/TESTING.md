# CLI test patterns

This guide documents standard testing patterns for AlignTrue CLI commands.

## Overview

### Test philosophy

**Unit tests** verify command logic in isolation with mocked dependencies. Use when testing business logic, error handling, and flag parsing.

**Integration tests** verify complete workflows with real filesystem operations. Use when testing end-to-end user journeys.

### When to mock vs use real filesystem

**Mock (unit tests):**

- Core modules (loadConfig, SyncEngine, BackupManager)
- Schema validation functions
- Exporter registry
- Network operations

**Real filesystem (integration tests):**

- Multi-command workflows
- Directory structure validation
- File content verification
- Cross-platform behavior

### Test helper utilities

The `command-test-helpers.ts` module provides utilities to reduce duplication and standardize patterns:

- `mockCommandArgs()` - Generate flag arrays from objects
- `assertStandardHelp()` - Validate help text format
- `expectStandardHelp()` - Return validation result
- `captureCommandOutput()` - Capture stdout/stderr (optional, spies usually sufficient)

## Standard patterns

### Unit tests (command logic)

Use extensive mocking to isolate command logic:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockCommandArgs, assertStandardHelp } from "../utils/command-test-helpers.js";

// Mock dependencies at file level
vi.mock("fs");
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  SyncEngine: vi.fn(function () {
    return {
      registerExporter: vi.fn(),
      syncToAgents: vi.fn(),
    };
  }),
}));

import { myCommand } from "../../src/commands/my-command.js";

describe("my-command", () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("help", () => {
    it("shows help with --help flag", async () => {
      const args = mockCommandArgs({ help: true });

      await expect(myCommand(args)).rejects.toThrow("process.exit called");

      const output = consoleLogSpy.mock.calls[0][0];
      assertStandardHelp(output);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("flag parsing", () => {
    it("handles --config flag", async () => {
      const args = mockCommandArgs({ config: "custom.yaml" });

      await myCommand(args);

      expect(loadConfig).toHaveBeenCalledWith(expect.objectContaining({ configPath: "custom.yaml" }));
    });
  });
});
```

**Key points:**

- Mock dependencies at file level (before imports)
- Use `mockCommandArgs()` for flag arrays
- Spy on console.log/error and process.exit in beforeEach
- Restore all mocks in afterEach
- Use `assertStandardHelp()` for help validation
- process.exit should throw Error for test detection

### Integration tests (E2E workflows)

Use real filesystem with temp directories:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { myCommand } from "../../src/commands/my-command.js";

describe("my-command integration", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "my-cmd-test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates expected directory structure", async () => {
    await myCommand([]);

    expect(existsSync(".aligntrue")).toBe(true);
    expect(existsSync(".aligntrue/config.yaml")).toBe(true);
  });

  it("handles existing files gracefully", async () => {
    mkdirSync(".aligntrue", { recursive: true });
    writeFileSync(".aligntrue/config.yaml", "existing");

    await expect(myCommand([])).rejects.toThrow();
  });
});
```

**Key points:**

- Use `mkdtempSync()` for unique temp directories
- `process.chdir()` to temp directory in beforeEach
- Restore original directory and cleanup in afterEach
- Test real filesystem operations
- Verify file contents and directory structure

## Helper utilities

### mockCommandArgs()

Generate flag arrays from objects:

```typescript
import { mockCommandArgs } from "../utils/command-test-helpers.js";

// Boolean flags
const args1 = mockCommandArgs({ help: true, dryRun: true });
// Returns: ["--help", "--dry-run"]

// Flags with values
const args2 = mockCommandArgs({ config: "custom.yaml", force: true });
// Returns: ["--config", "custom.yaml", "--force"]

// Complex combinations
const args3 = mockCommandArgs({
  acceptAgent: "cursor",
  config: "team.yaml",
  dryRun: false, // Omitted
});
// Returns: ["--accept-agent", "cursor", "--config", "team.yaml"]
```

**Benefits:**

- Consistent flag naming (camelCase → kebab-case)
- Type-safe with TypeScript
- Easier to read and maintain
- Reduces duplication

### assertStandardHelp()

Validate help text format:

```typescript
import { assertStandardHelp } from "../utils/command-test-helpers.js";

it("shows valid help text", async () => {
  await myCommand(["--help"]);

  const output = consoleLogSpy.mock.calls[0][0];
  assertStandardHelp(output); // Throws if invalid
});
```

**Validates:**

- Usage section present
- Description present (between blank lines)

**Alternative:** Use `expectStandardHelp()` for non-throwing validation:

```typescript
import { expectStandardHelp } from "../utils/command-test-helpers.js";

const result = expectStandardHelp(output);
expect(result.valid).toBe(true);
expect(result.missing).toEqual([]);
```

### captureCommandOutput() (optional)

Most tests use spies instead, but available if needed:

```typescript
import { captureCommandOutput } from "../utils/command-test-helpers.js";

const capture = captureCommandOutput();
capture.start();

await myCommand([]);

const output = capture.stop();
expect(output.stdout).toContain("Success");
expect(output.stderr).toBe("");
```

## Common patterns

### Setup/teardown

**Best practices:**

- Clear/reset all mocks in beforeEach
- Restore all mocks in afterEach
- Use `vi.restoreAllMocks()` to catch everything
- Cleanup temp directories immediately after tests

```typescript
beforeEach(() => {
  vi.clearAllMocks(); // Reset call counts
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks(); // Restore original implementations
});
```

### Assertions

**Error checking:**

```typescript
// process.exit throws in tests
await expect(command(args)).rejects.toThrow("process.exit called");
expect(processExitSpy).toHaveBeenCalledWith(1);

// Error messages
expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Config file not found"));
```

**Exit code validation:**

```typescript
// Success
expect(processExitSpy).toHaveBeenCalledWith(0);

// User error
expect(processExitSpy).toHaveBeenCalledWith(1);

// System error
expect(processExitSpy).toHaveBeenCalledWith(2);
```

**Output validation:**

```typescript
// Help text
expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: aligntrue"));

// Success messages
expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("✓"));

// JSON output
const output = consoleLogSpy.mock.calls[0][0];
const parsed = JSON.parse(output);
expect(parsed.status).toBe("success");
```

### Mock setup

**Common mocks to factor out:**

```typescript
// packages/cli/tests/utils/common-mocks.ts (if created)
export const mockCore = () => ({
  loadConfig: vi.fn(),
  loadIR: vi.fn(() => ({ rules: [] })),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
    rules: `${cwd}/.aligntrue/rules.md`,
    // ... other paths
  })),
});

export const mockSchema = () => ({
  validateAlign: vi.fn(() => ({
    schema: { valid: true, errors: [] },
    integrity: { valid: true },
  })),
  validateRuleId: vi.fn(() => ({ valid: true })),
});
```

**Using in tests:**

```typescript
import { mockCore, mockSchema } from "../utils/common-mocks.js";

vi.mock("@aligntrue/core", () => mockCore());
vi.mock("@aligntrue/schema", () => mockSchema());
```

## Anti-patterns

### What to avoid

❌ **Inline flag arrays everywhere:**

```typescript
await command(["--config", "test.yaml", "--dry-run"]);
await command(["--config", "test.yaml", "--force"]);
await command(["--config", "test.yaml"]);
```

✅ **Use mockCommandArgs():**

```typescript
await command(mockCommandArgs({ config: "test.yaml", dryRun: true }));
await command(mockCommandArgs({ config: "test.yaml", force: true }));
await command(mockCommandArgs({ config: "test.yaml" }));
```

---

❌ **Duplicated mock setup:**

```typescript
// In sync.test.ts
vi.mock("@aligntrue/core", () => ({ loadConfig: vi.fn() }));

// In check.test.ts
vi.mock("@aligntrue/core", () => ({ loadConfig: vi.fn() }));

// In team.test.ts
vi.mock("@aligntrue/core", () => ({ loadConfig: vi.fn() }));
```

✅ **Shared mock setup (if pattern emerges):**

```typescript
// All files import same mock factory
import { mockCore } from "../utils/common-mocks.js";
vi.mock("@aligntrue/core", () => mockCore());
```

---

❌ **Mixed process.exit handling:**

```typescript
// File 1
processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => {});

// File 2
processExitSpy = vi.spyOn(process, "exit").mockImplementation((code) => {
  throw new Error(`process.exit(${code})`);
});
```

✅ **Consistent throw pattern:**

```typescript
// All files use same pattern
processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
  throw new Error("process.exit called");
}) as any);
```

---

❌ **Vague help text validation:**

```typescript
expect(output).toContain("Usage");
```

✅ **Use assertStandardHelp():**

```typescript
assertStandardHelp(output); // Validates structure
expect(output).toContain("aligntrue my-command"); // Then check specifics
```

## Common pitfalls

### Pitfall 1: Forgetting to restore mocks

```typescript
afterEach(() => {
  // ❌ Forgot vi.restoreAllMocks()
  consoleLogSpy.mockRestore();
});
```

**Fix:**

```typescript
afterEach(() => {
  vi.restoreAllMocks(); // ✅ Restores everything
});
```

### Pitfall 2: Not cleaning up temp directories

```typescript
afterEach(() => {
  // ❌ Directory left behind
  process.chdir(originalCwd);
});
```

**Fix:**

```typescript
afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { recursive: true, force: true }); // ✅ Cleanup
});
```

### Pitfall 3: Brittle output assertions

```typescript
expect(output).toBe("Usage: aligntrue sync [options]"); // ❌ Exact match fragile
```

**Fix:**

```typescript
expect(output).toContain("Usage: aligntrue sync"); // ✅ Flexible
expect(output).toContain("[options]");
```

### Pitfall 4: Not handling process.exit in tests

```typescript
await command(["--help"]); // ❌ Uncaught exit
```

**Fix:**

```typescript
await expect(command(["--help"])).rejects.toThrow("process.exit called"); // ✅
```

## Examples

### Full unit test template

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockCommandArgs } from "../utils/command-test-helpers.js";

vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
}));

import { myCommand } from "../../src/commands/my-command.js";

describe("my-command", () => {
  let consoleLogSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows help", async () => {
    const args = mockCommandArgs({ help: true });
    await expect(myCommand(args)).rejects.toThrow("process.exit called");
    expect(consoleLogSpy).toHaveBeenCalled();
  });
});
```

### Full integration test template

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("my-command integration", () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "test-"));
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates config", async () => {
    writeFileSync(".aligntrue/config.yaml", "mode: solo");
    expect(existsSync(".aligntrue/config.yaml")).toBe(true);
  });
});
```

## Migration guide

### Adopting test helpers in existing tests

For existing tests that don't use helpers, adopt incrementally:

**Step 1:** Add helper imports

```typescript
import { mockCommandArgs, assertStandardHelp } from "../utils/command-test-helpers.js";
```

**Step 2:** Replace inline flag arrays in help tests

```typescript
// Before
await command(["--help"]);

// After
await command(mockCommandArgs({ help: true }));
```

**Step 3:** Replace help text validation

```typescript
// Before
expect(output).toContain("Usage:");

// After
assertStandardHelp(output);
expect(output).toContain("aligntrue my-command");
```

**Step 4:** Gradually adopt in other tests

```typescript
// Before
await command(["--config", "custom.yaml", "--force"]);

// After
await command(mockCommandArgs({ config: "custom.yaml", force: true }));
```

**Note:** Full migration is optional. Helpers reduce duplication but existing patterns can coexist.

## Test organization

### File structure

```
packages/cli/tests/
├─ commands/           # Command unit tests
│  ├─ sync.test.ts
│  ├─ check.test.ts
│  └─ ...
├─ integration/        # E2E workflow tests
│  ├─ solo-workflow.test.ts
│  ├─ team-workflow.test.ts
│  └─ ...
├─ utils/              # Test utilities
│  ├─ command-test-helpers.ts
│  ├─ command-test-helpers.test.ts
│  └─ common-mocks.ts (if created)
└─ TESTING.md          # This guide
```

### Test naming

- **Unit tests:** `{command}.test.ts`
- **Integration tests:** `{workflow}.test.ts`
- **Test helpers:** `{module}-test-helpers.ts`

### Describe blocks

```typescript
describe("command-name", () => {
  describe("help and validation", () => {
    /* ... */
  });
  describe("core functionality", () => {
    /* ... */
  });
  describe("error handling", () => {
    /* ... */
  });
  describe("edge cases", () => {
    /* ... */
  });
});
```

## See also

- `packages/cli/tests/utils/command-test-helpers.ts` - Helper implementations
- `packages/cli/COMMAND-FRAMEWORK.md` - Command implementation patterns
- Phase 2 completion summary - Test framework introduction
