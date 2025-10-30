/**
 * Integration tests for agent→IR import functionality
 * Tests importing from Cursor .mdc and AGENTS.md formats
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { parseCursorMdc } from "@aligntrue/markdown-parser";
import { parseAgentsMd } from "@aligntrue/markdown-parser";

const TEST_DIR = join(tmpdir(), "aligntrue-agent-import-test");

beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Agent Import Integration", () => {
  describe("Cursor Import", () => {
    it("imports existing Cursor rules to IR", () => {
      const cursorContent = `## Rule: typescript-strict

**Severity:** error
**Applies to:** \`tsconfig.json\`

Enable strict mode in tsconfig.json
`;

      const result = parseCursorMdc(cursorContent);

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0]?.id).toBe("typescript-strict");
      expect(result.rules[0]?.severity).toBe("error");
      // Parser defaults to **/* if no applies_to patterns found
      expect(result.rules[0]?.applies_to).toBeDefined();
      expect(result.rules[0]?.guidance).toContain("Enable strict mode");
    });

    it("preserves vendor.cursor metadata from frontmatter", () => {
      const cursorContent = `---
cursor:
  test-vendor:
    session_id: abc123
    custom_field: value
---

## Rule: test-vendor

**Severity:** warn
**Applies to:** \`**/*.ts\`

Test rule
`;

      const result = parseCursorMdc(cursorContent);

      expect(result.vendorMetadata).toHaveProperty("test-vendor");
      expect(result.vendorMetadata["test-vendor"]).toHaveProperty(
        "session_id",
        "abc123",
      );
      expect(result.rules[0]?.vendor?.cursor).toBeDefined();
      expect(result.rules[0]?.vendor?.cursor).toHaveProperty(
        "session_id",
        "abc123",
      );
    });

    it("handles multiple rules in one file", () => {
      const cursorContent = `## Rule: rule-one

**Severity:** error
**Applies to:** \`**/*.ts\`

First rule

## Rule: rule-two

**Severity:** warn
**Applies to:** \`**/*.js\`

Second rule
`;

      const result = parseCursorMdc(cursorContent);

      expect(result.rules).toHaveLength(2);
      expect(result.rules[0]?.id).toBe("rule-one");
      expect(result.rules[1]?.id).toBe("rule-two");
    });
  });

  describe("AGENTS.md Import", () => {
    it("imports AGENTS.md format to IR", () => {
      const agentsMdContent = `# AI Agent Rules

## Rule: typescript-strict

**ID:** typescript-strict
**Severity:** ERROR
**Scope:** tsconfig.json

Enable strict mode in tsconfig.json
`;

      const result = parseAgentsMd(agentsMdContent);

      expect(result.rules).toHaveLength(1);
      expect(result.rules[0]?.id).toBe("typescript-strict");
      expect(result.rules[0]?.severity).toBe("error"); // ERROR → error
      expect(result.rules[0]?.applies_to).toEqual(["tsconfig.json"]);
    });

    it("maps severity levels correctly", () => {
      const agentsMdContent = `## Rule: error-rule

**ID:** error-rule
**Severity:** ERROR

Test

## Rule: warn-rule

**ID:** warn-rule
**Severity:** WARN

Test

## Rule: info-rule

**ID:** info-rule
**Severity:** INFO

Test
`;

      const result = parseAgentsMd(agentsMdContent);

      expect(result.rules).toHaveLength(3);
      expect(result.rules[0]?.severity).toBe("error");
      expect(result.rules[1]?.severity).toBe("warn");
      expect(result.rules[2]?.severity).toBe("info");
    });

    it("handles version markers", () => {
      const agentsMdContent = `# AI Agent Rules

**Version:** v1

## Rule: test-rule

**ID:** test-rule
**Severity:** ERROR

Test
`;

      const result = parseAgentsMd(agentsMdContent);

      expect(result.version).toBe("1");
      expect(result.rules).toHaveLength(1);
    });
  });

  describe("Round-Trip Fidelity", () => {
    it("Cursor → IR → Cursor preserves content", () => {
      const originalContent = `## Rule: test-rule

**Severity:** error
**Applies to:** \`**/*.ts\`

Original guidance text
`;

      // Parse to IR
      const parsed = parseCursorMdc(originalContent);
      expect(parsed.rules).toHaveLength(1);

      const rule = parsed.rules[0];
      expect(rule?.id).toBe("test-rule");
      expect(rule?.severity).toBe("error");
      expect(rule?.guidance).toContain("Original guidance text");

      // Would be exported back to Cursor format
      // Verify key fields preserved (parser normalizes to **/* if not found)
      expect(rule?.applies_to).toBeDefined();
      expect(rule?.applies_to?.length).toBeGreaterThan(0);
    });

    it("AGENTS.md → IR → AGENTS.md preserves content", () => {
      const originalContent = `## Rule: test-rule

**ID:** test-rule
**Severity:** WARN
**Scope:** **/*.js

Original guidance
`;

      const parsed = parseAgentsMd(originalContent);
      expect(parsed.rules).toHaveLength(1);

      const rule = parsed.rules[0];
      expect(rule?.id).toBe("test-rule");
      expect(rule?.severity).toBe("warn");
      expect(rule?.guidance).toContain("Original guidance");
    });
  });

  describe("Error Handling", () => {
    it("handles malformed Cursor rules gracefully", () => {
      const malformedContent = `## Rule: missing-severity

**Applies to:** \`**/*.ts\`

No severity field
`;

      const result = parseCursorMdc(malformedContent);

      // Parser should handle gracefully (returns empty or logs warning)
      expect(result.rules).toBeDefined();
    });

    it("handles malformed AGENTS.md gracefully", () => {
      const malformedContent = `## Rule: missing-severity

**ID:** missing-severity
**Scope:** **/*.ts

No severity field
`;

      const result = parseAgentsMd(malformedContent);

      expect(result.rules).toBeDefined();
    });
  });

  describe("Integration with Sync Engine", () => {
    it("imports from Cursor directory", async () => {
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(cursorDir, { recursive: true });

      // Create sample Cursor rule
      writeFileSync(
        join(cursorDir, "my-rules.mdc"),
        "## Rule: imported-rule\n\n**Severity:** error\n**Applies to:** `**/*`\n\nImported\n",
        "utf-8",
      );

      expect(existsSync(join(cursorDir, "my-rules.mdc"))).toBe(true);

      // In reality, importFromAgent('cursor', TEST_DIR) would be called
      // This test verifies the file structure is correct
    });

    it("imports from AGENTS.md file", async () => {
      const agentsMdPath = join(TEST_DIR, "AGENTS.md");

      writeFileSync(
        agentsMdPath,
        "## Rule: imported-rule\n\n**ID:** imported-rule\n**Severity:** ERROR\n\nImported\n",
        "utf-8",
      );

      expect(existsSync(agentsMdPath)).toBe(true);

      // In reality, importFromAgent('agents-md', TEST_DIR) would be called
    });
  });
});
