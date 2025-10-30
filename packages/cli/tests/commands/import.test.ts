/**
 * Tests for import command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { importCommand } from "../../src/commands/import.js";

// Test workspace
const testWorkspace = join(process.cwd(), "test-import-workspace");

beforeEach(() => {
  // Clean up any existing test workspace
  if (existsSync(testWorkspace)) {
    rmSync(testWorkspace, { recursive: true, force: true });
  }

  // Create test workspace
  mkdirSync(testWorkspace, { recursive: true });

  // Change to test workspace
  process.chdir(testWorkspace);
});

afterEach(() => {
  // Change back to original directory
  process.chdir(join(testWorkspace, ".."));

  // Clean up test workspace
  if (existsSync(testWorkspace)) {
    rmSync(testWorkspace, { recursive: true, force: true });
  }
});

describe("import command", () => {
  it("should show help when no agent specified", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand([]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 1");
    }

    expect(logSpy).toHaveBeenCalled();

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should show help with --help flag", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["--help"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    expect(logSpy).toHaveBeenCalled();
    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("aligntrue import");
    expect(output).toContain("cursor");
    expect(output).toContain("agents-md");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should error for unsupported agent", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["unsupported-agent"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 1");
    }

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should error when cursor directory not found", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 1");
    }

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should error when AGENTS.md not found", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["agents-md"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 1");
    }

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should import from cursor with coverage report", async () => {
    // Create .cursor/rules directory with test file
    const cursorDir = join(testWorkspace, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });

    const mdcContent = `---
description: Test rules
---
## Rule: test-rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Test guidance for rule.
`;

    writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    expect(logSpy).toHaveBeenCalled();

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("Import Coverage Report: cursor");
    expect(output).toContain("Imported: 1 rules");
    expect(output).toContain("Field Mapping:");
    expect(output).toContain("Coverage:");
    expect(output).toContain("Confidence:");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should import from AGENTS.md with coverage report", async () => {
    const agentsMdContent = `# AGENTS.md

**Version:** v1

## Rule: test-rule

**ID:** test-rule
**Severity:** ERROR
**Scope:** **/*.ts

Test guidance.
---
`;

    writeFileSync(join(testWorkspace, "AGENTS.md"), agentsMdContent, "utf-8");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["agents-md"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }
    expect(logSpy).toHaveBeenCalled();

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("Import Coverage Report: agents-md");
    expect(output).toContain("Imported: 1 rules");
    expect(output).toContain("Coverage:");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should skip coverage with --no-coverage flag", async () => {
    const cursorDir = join(testWorkspace, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });

    const mdcContent = `---
description: Test
---
## Rule: test

**Severity:** info

Test.
`;

    writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor", "--no-coverage"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).not.toContain("Coverage Report");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should write to IR file with --write flag", async () => {
    const cursorDir = join(testWorkspace, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });

    const mdcContent = `---
description: Test
---
## Rule: test-rule

**Severity:** warn

**Applies to:**
- \`**/*.ts\`

Test guidance.
`;

    writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

    // Create .aligntrue directory
    mkdirSync(join(testWorkspace, ".aligntrue"), { recursive: true });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor", "--write"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    // Check that rules.md was created
    const rulesPath = join(testWorkspace, ".aligntrue", "rules.md");
    expect(existsSync(rulesPath)).toBe(true);

    const content = readFileSync(rulesPath, "utf-8");
    expect(content).toContain("```aligntrue");
    expect(content).toContain("id: test-rule");
    expect(content).toContain("severity: warn");
    expect(content).toContain("Test guidance");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should preview with --dry-run flag", async () => {
    const cursorDir = join(testWorkspace, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });

    const mdcContent = `---
description: Test
---
## Rule: test-rule

**Severity:** error

Test.
`;

    writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

    // Create .aligntrue directory
    mkdirSync(join(testWorkspace, ".aligntrue"), { recursive: true });

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor", "--write", "--dry-run"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("Preview of .aligntrue/rules.md");

    // Check that rules.md was NOT created
    const rulesPath = join(testWorkspace, ".aligntrue", "rules.md");
    expect(existsSync(rulesPath)).toBe(false);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("should handle multiple rules from cursor", async () => {
    const cursorDir = join(testWorkspace, ".cursor", "rules");
    mkdirSync(cursorDir, { recursive: true });

    const mdcContent = `---
description: Multiple rules
---
## Rule: rule-one

**Severity:** error

First rule.

## Rule: rule-two

**Severity:** warn

Second rule.
`;

    writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code) => {
      throw new Error(`exit: ${code}`);
    }) as any);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await importCommand(["cursor"]);
    } catch (e: any) {
      expect(e.message).toBe("exit: 0");
    }

    const output = logSpy.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(output).toContain("Imported: 2 rules");

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });
});
