/**
 * Integration tests for sync command
 * Tests real file system operations and actual exports
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();

  // Create fresh test directory
  testProjectContext = await setupTestProject();
  TEST_DIR = testProjectContext.projectDir;

  // Change to test directory
  process.chdir(TEST_DIR);

  // Mock process.exit to throw for integration tests
  vi.spyOn(process, "exit").mockImplementation((code?: number) => {
    throw new Error(`process.exit(${code})`);
  });

  // Mock clack prompts to avoid terminal interaction
  const mockSpinner = {
    start: vi.fn(),
    stop: vi.fn(),
  };
  vi.mocked(clack.spinner).mockReturnValue(mockSpinner as never);
  vi.mocked(clack.intro).mockImplementation(() => {});
  vi.mocked(clack.outro).mockImplementation(() => {});
  vi.mocked(clack.confirm).mockResolvedValue(true);
  vi.mocked(clack.cancel).mockImplementation(() => {});
  vi.mocked(clack.isCancel).mockReturnValue(false);
});

afterEach(async () => {
  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("Sync Command Integration", () => {
  describe("Basic Sync (IR → Agents)", () => {
    it("reads rules from .aligntrue/rules/*.md and syncs to exporters", async () => {
      // Setup: Create config and rules directory
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory if not present
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a rule file in the new format
      const ruleContent = `---
title: Test rule example
description: A test rule
---

# Test rule example

Test guidance
`;
      writeFileSync(join(rulesDir, "test-rule.md"), ruleContent, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Cursor export created (1:1 mapping now)
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "test-rule.mdc");
      expect(existsSync(cursorPath)).toBe(true);

      const cursorContent = readFileSync(cursorPath, "utf-8");
      expect(cursorContent).toContain("Test rule example");
      expect(cursorContent).toContain("Test guidance");

      // Verify: AGENTS.md export created (link-based format)
      const agentsMdPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsMdPath)).toBe(true);

      const agentsMdContent = readFileSync(agentsMdPath, "utf-8");
      // Link-based format contains links to rules, not full content
      expect(agentsMdContent).toContain("Test rule example");
      expect(agentsMdContent).toContain(".aligntrue/rules/test-rule.md");
    });

    it("respects configured exporters in config", async () => {
      // Setup: Config with only cursor exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory if not present
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a rule file in the new format
      const ruleContent = `---
title: Test rule example
---

# Test rule example

Test guidance
`;
      writeFileSync(join(rulesDir, "test-rule.md"), ruleContent, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Only cursor export created (1:1 mapping)
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "test-rule.mdc")),
      ).toBe(true);
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(false);
    });

    it("creates backup before syncing", async () => {
      // Setup
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory if not present
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a rule file in the new format
      const ruleContent = `---
title: Test rule example
---

# Test rule example

Test guidance
`;
      writeFileSync(join(rulesDir, "test-rule.md"), ruleContent, "utf-8");

      // Create existing export to backup
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".cursor", "rules", "test-rule.mdc"),
        "# Old content\n",
        "utf-8",
      );

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Backup directory exists
      const backupDir = join(TEST_DIR, ".aligntrue", ".backups");
      expect(existsSync(backupDir)).toBe(true);
    });
  });

  describe("Dry Run Mode", () => {
    it("shows changes without writing files with --dry-run", async () => {
      // Setup
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory if not present
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a rule file in the new format
      const ruleContent = `---
title: Test rule example
---

# Test rule example

Test guidance
`;
      writeFileSync(join(rulesDir, "test-rule.md"), ruleContent, "utf-8");

      // Execute sync with dry-run
      try {
        await sync(["--dry-run"]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: No files created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "test-rule.mdc")),
      ).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("exits with error if config not found", async () => {
      // Delete config file created by setupTestProject
      const fs = await import("fs");
      fs.unlinkSync(join(TEST_DIR, ".aligntrue", "config.yaml"));

      // Should throw when config is missing
      await expect(sync([])).rejects.toThrow();
    });

    it("exits with error if rules directory not found", async () => {
      // Setup: Config exists but no rules directory
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Delete the rules directory if it exists
      const fs = await import("fs");
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      if (fs.existsSync(rulesDir)) {
        fs.rmSync(rulesDir, { recursive: true });
      }

      // Should throw when rules directory is missing
      await expect(sync([])).rejects.toThrow();
    });
  });

  describe("Multiple Rules", () => {
    it("syncs multiple rules correctly", async () => {
      // Setup
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rules directory if not present
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create multiple rule files
      const rule1 = `---
title: First rule
---

# First rule

First rule guidance
`;
      const rule2 = `---
title: Second rule
---

# Second rule

Second rule guidance
`;
      const rule3 = `---
title: Third rule
---

# Third rule

Third rule guidance
`;
      writeFileSync(join(rulesDir, "first-rule.md"), rule1, "utf-8");
      writeFileSync(join(rulesDir, "second-rule.md"), rule2, "utf-8");
      writeFileSync(join(rulesDir, "third-rule.md"), rule3, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit if command fails
      }

      // Verify: Each rule has its own .mdc file (1:1 mapping)
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "first-rule.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "second-rule.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "third-rule.mdc")),
      ).toBe(true);

      // Verify content in each file
      const firstRuleContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "first-rule.mdc"),
        "utf-8",
      );
      expect(firstRuleContent).toContain("First rule");
      expect(firstRuleContent).toContain("First rule guidance");

      const secondRuleContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "second-rule.mdc"),
        "utf-8",
      );
      expect(secondRuleContent).toContain("Second rule");
      expect(secondRuleContent).toContain("Second rule guidance");
    });
  });

  describe("Nested ignore files", () => {
    it("creates ignore files in nested directories with nested_location frontmatter", async () => {
      // Setup: Config with cursor and agents exporters to trigger ignore file creation
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a rule with nested_location set to a subdirectory
      const ruleContent = `---
title: Nested location rule
description: A rule that exports to nested directory
nested_location: apps/docs
---

# Nested location rule

This rule will be exported to apps/docs/.cursor/rules/
`;
      writeFileSync(join(rulesDir, "nested-rule.md"), ruleContent, "utf-8");

      // Run sync
      await sync([]);

      // Verify the nested directory ignore file was created
      const nestedIgnorePath = join(TEST_DIR, "apps", "docs", ".cursorignore");
      expect(existsSync(nestedIgnorePath)).toBe(true);

      const nestedIgnoreContent = readFileSync(nestedIgnorePath, "utf-8");
      // Should ignore AGENTS.md since cursor and agents exporters conflict
      expect(nestedIgnoreContent).toContain("AGENTS.md");
    });

    it("creates multiple nested ignore files for multiple nested_locations", async () => {
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create rules with different nested locations
      const rule1 = `---
title: First nested
nested_location: apps/docs
---

# First`;
      writeFileSync(join(rulesDir, "rule1.md"), rule1, "utf-8");

      const rule2 = `---
title: Second nested
nested_location: packages/cli
---

# Second`;
      writeFileSync(join(rulesDir, "rule2.md"), rule2, "utf-8");

      // Run sync
      await sync([]);

      // Verify both nested ignore files were created
      const docsIgnorePath = join(TEST_DIR, "apps", "docs", ".cursorignore");
      const cliIgnorePath = join(TEST_DIR, "packages", "cli", ".cursorignore");

      expect(existsSync(docsIgnorePath)).toBe(true);
      expect(existsSync(cliIgnorePath)).toBe(true);
    });
  });
});
