/**
 * Tests for import helper utility
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { executeImport } from "../../src/utils/import-helper.js";

describe("executeImport", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(process.cwd(), `test-import-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  describe("Cursor import", () => {
    it("should import rules from Cursor .mdc files", async () => {
      // Setup: Create .cursor/rules directory with .mdc file
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      const mdcContent = `---
description: Test rules
alwaysApply: true
---

## Rule: quality.testing.required

**Severity:** error

**Applies to:**
- \`**/*.ts\`
- \`**/*.tsx\`

Always write tests for new features.

## Rule: style.naming.conventions

**Severity:** warn

**Applies to:**
- \`**/*.ts\`

Use camelCase for variables.
`;

      writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

      // Execute import
      const result = await executeImport("cursor", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      // Verify
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].id).toBe("quality.testing.required");
      expect(result.rules[0].severity).toBe("error");
      expect(result.rules[1].id).toBe("style.naming.conventions");
      expect(result.written).toBe(false);
    });

    it("should generate coverage report when requested", async () => {
      // Setup
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      const mdcContent = `---
description: Test
---

## Rule: test.rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Test rule.
`;

      writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

      // Execute with coverage
      const result = await executeImport("cursor", tmpDir, {
        showCoverage: true,
        writeToIR: false,
        interactive: false,
      });

      // Verify coverage report exists
      expect(result.coverage).toBeDefined();
      expect(result.coverage?.agent).toBe("cursor");
      expect(result.coverage?.rulesImported).toBe(1);
      expect(result.coverage?.coveragePercentage).toBeGreaterThan(0);
    });

    it("should write to IR file when requested", async () => {
      // Setup
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      const mdcContent = `---
description: Test
---

## Rule: test.rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Test rule.
`;

      writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

      // Create .aligntrue directory
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Execute with write
      const result = await executeImport("cursor", tmpDir, {
        showCoverage: false,
        writeToIR: true,
        interactive: false,
        projectId: "test-project",
      });

      // Verify
      expect(result.written).toBe(true);
      expect(result.irPath).toBeDefined();
      expect(existsSync(result.irPath!)).toBe(true);

      // Verify IR file content
      const { readFileSync } = await import("fs");
      const irContent = readFileSync(result.irPath!, "utf-8");
      expect(irContent).toContain("# AlignTrue Rules");
      expect(irContent).toContain("```aligntrue");
      expect(irContent).toContain("test.rule");
    });

    it("should throw error if .cursor/rules not found", async () => {
      await expect(
        executeImport("cursor", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow("Agent format not found");
    });
  });

  describe("AGENTS.md import", () => {
    it("should import rules from AGENTS.md", async () => {
      // Setup: Create AGENTS.md
      const agentsMdContent = `# AI Agent Rules

## Rule: quality.testing.required

**ID:** quality.testing.required  
**Severity:** ERROR  
**Scope:** **/*.ts, **/*.tsx

Always write tests for new features.

## Rule: style.naming.conventions

**ID:** style.naming.conventions  
**Severity:** WARN  
**Scope:** **/*.ts

Use camelCase for variables.
`;

      writeFileSync(join(tmpDir, "AGENTS.md"), agentsMdContent, "utf-8");

      // Execute import
      const result = await executeImport("agents-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      // Verify
      expect(result.rules).toHaveLength(2);
      expect(result.rules[0].id).toBe("quality.testing.required");
      expect(result.rules[0].severity).toBe("error");
      expect(result.rules[1].id).toBe("style.naming.conventions");
      expect(result.written).toBe(false);
    });

    it("should throw error if AGENTS.md not found", async () => {
      await expect(
        executeImport("agents-md", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow("Agent format not found");
    });
  });

  describe(".cursorrules import", () => {
    it("should import rules from .cursorrules", async () => {
      const cursorrulesContent = `---
alwaysApply: true
intelligent: true
---

## Rule: quality.testing.required

Always write tests for new features.

**Applies to:** **/*.ts, **/*.tsx
**Severity:** ERROR
`;

      writeFileSync(join(tmpDir, ".cursorrules"), cursorrulesContent, "utf-8");

      const result = await executeImport("cursorrules", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("quality.testing.required");
      expect(result.rules[0].severity).toBe("error");
    });

    it("should throw error if .cursorrules not found", async () => {
      await expect(
        executeImport("cursorrules", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow("Agent format not found");
    });
  });

  describe("CLAUDE.md import", () => {
    it("should import rules from CLAUDE.md (uppercase)", async () => {
      const claudeMdContent = `# CLAUDE.md

## Rule: quality.testing.required

**ID:** quality.testing.required  
**Severity:** ERROR  
**Scope:** **/*.ts, **/*.tsx

Always write tests for new features.
`;

      writeFileSync(join(tmpDir, "CLAUDE.md"), claudeMdContent, "utf-8");

      const result = await executeImport("claude-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("quality.testing.required");
      expect(result.rules[0].severity).toBe("error");
    });

    it("should import rules from claude.md (lowercase)", async () => {
      const claudeMdContent = `# claude.md

## Rule: style.naming.conventions

**ID:** style.naming.conventions  
**Severity:** WARN  
**Scope:** **/*.ts

Use camelCase for variables.
`;

      writeFileSync(join(tmpDir, "claude.md"), claudeMdContent, "utf-8");

      const result = await executeImport("claude-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("style.naming.conventions");
    });

    it("should import rules from Claude.md (title case)", async () => {
      const claudeMdContent = `# Claude.md

## Rule: security.no.secrets

**ID:** security.no.secrets  
**Severity:** ERROR  
**Scope:** **/*

No hardcoded secrets.
`;

      writeFileSync(join(tmpDir, "Claude.md"), claudeMdContent, "utf-8");

      const result = await executeImport("claude-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("security.no.secrets");
    });

    it("should throw error if CLAUDE.md not found", async () => {
      await expect(
        executeImport("claude-md", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow(
        `Agent format not found: ${join(tmpDir, "CLAUDE.md")}\nExpected: CLAUDE.md file in workspace root`,
      );
    });
  });

  describe("CRUSH.md import", () => {
    it("should import rules from CRUSH.md", async () => {
      const crushMdContent = `# CRUSH.md

## Rule: quality.code.review

**ID:** quality.code.review  
**Severity:** ERROR  
**Scope:** **/*.ts

All code must be reviewed.
`;

      writeFileSync(join(tmpDir, "CRUSH.md"), crushMdContent, "utf-8");

      const result = await executeImport("crush-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("quality.code.review");
    });
  });

  describe("WARP.md import", () => {
    it("should import rules from WARP.md", async () => {
      const warpMdContent = `# WARP.md

## Rule: performance.optimize.queries

**ID:** performance.optimize.queries  
**Severity:** WARN  
**Scope:** **/*.sql

Optimize database queries.
`;

      writeFileSync(join(tmpDir, "WARP.md"), warpMdContent, "utf-8");

      const result = await executeImport("warp-md", tmpDir, {
        showCoverage: false,
        writeToIR: false,
        interactive: false,
      });

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0].id).toBe("performance.optimize.queries");
    });
  });

  describe("Error handling", () => {
    it("should throw error for unsupported agent", async () => {
      await expect(
        executeImport("unsupported", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow("Import not supported for agent: unsupported");
    });

    it("should throw error if no rules found", async () => {
      // Create empty .cursor/rules directory
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      await expect(
        executeImport("cursor", tmpDir, {
          showCoverage: false,
          writeToIR: false,
          interactive: false,
        }),
      ).rejects.toThrow("No .mdc files found");
    });
  });

  describe("Project ID handling", () => {
    it("should use provided project ID", async () => {
      // Setup
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      const mdcContent = `---
description: Test
---

## Rule: test.rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Test.
`;

      writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

      // Create .aligntrue directory
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Execute with custom project ID
      const result = await executeImport("cursor", tmpDir, {
        showCoverage: false,
        writeToIR: true,
        interactive: false,
        projectId: "custom-project",
      });

      // Verify project ID in IR file
      const { readFileSync } = await import("fs");
      const irContent = readFileSync(result.irPath!, "utf-8");
      expect(irContent).toContain("id: custom-project");
    });

    it("should default to 'imported-rules' if no project ID provided", async () => {
      // Setup
      const cursorDir = join(tmpDir, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      const mdcContent = `---
description: Test
---

## Rule: test.rule

**Severity:** error

**Applies to:**
- \`**/*.ts\`

Test.
`;

      writeFileSync(join(cursorDir, "test.mdc"), mdcContent, "utf-8");

      // Create .aligntrue directory
      const aligntrueDir = join(tmpDir, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Execute without project ID
      const result = await executeImport("cursor", tmpDir, {
        showCoverage: false,
        writeToIR: true,
        interactive: false,
      });

      // Verify default project ID in IR file
      const { readFileSync } = await import("fs");
      const irContent = readFileSync(result.irPath!, "utf-8");
      expect(irContent).toContain("id: imported-rules");
    });
  });
});
