/**
 * End-to-End Sync Workflow Tests
 *
 * Tests the complete sync workflow from rules to agent exports:
 * 1. Full workflow: init → add rules → sync → verify all agent files
 * 2. Multi-exporter sync in one command
 * 3. Verify exported files match expected format contracts
 * 4. Incremental sync (add/modify/delete rules)
 *
 * Note: Skipped on Windows CI due to persistent file locking issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
} from "fs";
import { join } from "path";
import { sync } from "../../src/commands/sync/index.js";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { setupTestProject, TestProjectContext } from "../helpers/test-setup.js";

vi.mock("@clack/prompts");

let TEST_DIR: string;
let testProjectContext: TestProjectContext;
let originalCwd: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  vi.clearAllMocks();
  originalCwd = process.cwd();

  // Create fresh test directory
  testProjectContext = setupTestProject();
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
  // Restore cwd
  process.chdir(originalCwd);

  // Cleanup
  await testProjectContext.cleanup();
});

describeSkipWindows("E2E Sync Workflow", () => {
  describe("Multi-Exporter Sync", () => {
    it("syncs to cursor and agents exporters in single command", async () => {
      // Setup: Config with multiple exporters
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const ruleContent = `---
title: Code Quality
description: Ensure high code quality
---

# Code Quality

Follow these quality guidelines:
- Write clean, readable code
- Add meaningful comments
`;
      writeFileSync(join(rulesDir, "code-quality.md"), ruleContent, "utf-8");

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify: Cursor export created
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "code-quality.mdc");
      expect(existsSync(cursorPath)).toBe(true);

      const cursorContent = readFileSync(cursorPath, "utf-8");
      expect(cursorContent).toContain("Code Quality");
      expect(cursorContent).toContain("clean, readable code");

      // Verify: AGENTS.md created
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);

      const agentsContent = readFileSync(agentsPath, "utf-8");
      expect(agentsContent).toContain("Code Quality");
      expect(agentsContent).toContain(".aligntrue/rules/code-quality.md");
    });

    it("syncs multiple rules to multiple exporters", async () => {
      // Setup: Config with multiple exporters
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create multiple rule files
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");

      writeFileSync(
        join(rulesDir, "testing.md"),
        `---
title: Testing Guidelines
---

# Testing Guidelines

Write comprehensive tests.
`,
        "utf-8",
      );

      writeFileSync(
        join(rulesDir, "security.md"),
        `---
title: Security Practices
---

# Security Practices

Never commit secrets.
`,
        "utf-8",
      );

      writeFileSync(
        join(rulesDir, "documentation.md"),
        `---
title: Documentation Standards
---

# Documentation Standards

Document all public APIs.
`,
        "utf-8",
      );

      // Execute sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify: All Cursor exports created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "testing.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "security.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "documentation.mdc")),
      ).toBe(true);

      // Verify: AGENTS.md contains all rules
      const agentsContent = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
      expect(agentsContent).toContain("Testing Guidelines");
      expect(agentsContent).toContain("Security Practices");
      expect(agentsContent).toContain("Documentation Standards");
    });
  });

  describe("Incremental Sync", () => {
    it("adds new rules on subsequent sync", async () => {
      // Setup: Config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");

      // First rule and sync
      writeFileSync(
        join(rulesDir, "rule-one.md"),
        `---
title: Rule One
---

# Rule One

First rule content.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "rule-one.mdc")),
      ).toBe(true);

      // Add second rule and sync again
      writeFileSync(
        join(rulesDir, "rule-two.md"),
        `---
title: Rule Two
---

# Rule Two

Second rule content.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify: Both rules exist
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "rule-one.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "rule-two.mdc")),
      ).toBe(true);
    });

    it("updates modified rules on subsequent sync", async () => {
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

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");

      // Initial rule
      writeFileSync(
        join(rulesDir, "changeable.md"),
        `---
title: Changeable Rule
---

# Changeable Rule

Original content.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const initialContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "changeable.mdc"),
        "utf-8",
      );
      expect(initialContent).toContain("Original content");

      // Modify rule
      writeFileSync(
        join(rulesDir, "changeable.md"),
        `---
title: Changeable Rule
---

# Changeable Rule

Updated content with new information.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // Verify: Content updated
      const updatedContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "changeable.mdc"),
        "utf-8",
      );
      expect(updatedContent).toContain("Updated content");
      expect(updatedContent).not.toContain("Original content");
    });
  });

  describe("Sync Output Format Contracts", () => {
    it("Cursor exports have correct MDC format", async () => {
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

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "format-test.md"),
        `---
title: Format Test Rule
description: Tests format output
globs:
  - "**/*.ts"
  - "**/*.tsx"
---

# Format Test Rule

This rule tests format compliance.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const cursorContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "format-test.mdc"),
        "utf-8",
      );

      // MDC format contracts:
      // 1. Has YAML frontmatter
      expect(cursorContent).toMatch(/^---\n/);
      expect(cursorContent).toContain("---");

      // 2. Has read-only marker
      expect(cursorContent).toContain("READ-ONLY");

      // 3. Contains rule content
      expect(cursorContent).toContain("Format Test Rule");
    });

    it("AGENTS.md has correct link-based format", async () => {
      // Setup
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "link-test.md"),
        `---
title: Link Test Rule
description: Tests link format
---

# Link Test Rule

This rule tests the link-based format.
`,
        "utf-8",
      );

      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const agentsContent = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");

      // AGENTS.md format contracts:
      // 1. Has read-only marker
      expect(agentsContent).toContain("READ-ONLY");

      // 2. Has header
      expect(agentsContent).toContain("# Agent Rules");

      // 3. Contains rule names and paths
      expect(agentsContent).toContain("- Link Test Rule (");
      expect(agentsContent).toContain(".aligntrue/rules/link-test.md");
    });
  });

  describe("Dry Run Mode", () => {
    it("shows what would be written without writing files", async () => {
      // Setup
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
      writeFileSync(
        join(rulesDir, "dry-run-test.md"),
        `---
title: Dry Run Test
---

# Dry Run Test

Content for dry run.
`,
        "utf-8",
      );

      // Execute with dry-run
      try {
        await sync(["--dry-run"]);
      } catch {
        // May throw from process.exit
      }

      // Verify: No files created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "dry-run-test.mdc")),
      ).toBe(false);
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(false);
    });
  });

  describe("Determinism", () => {
    it("produces identical output for identical input across syncs", async () => {
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

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "determinism-test.md"),
        `---
title: Determinism Test
---

# Determinism Test

This rule tests deterministic output.
`,
        "utf-8",
      );

      // First sync
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const firstContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "determinism-test.mdc"),
        "utf-8",
      );

      // Second sync (without changes)
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      const secondContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "determinism-test.mdc"),
        "utf-8",
      );

      // Output should be byte-identical
      expect(firstContent).toBe(secondContent);
    });
  });

  describe("Error Handling", () => {
    it("fails gracefully when config is missing", async () => {
      // Delete config
      unlinkSync(join(TEST_DIR, ".aligntrue", "config.yaml"));

      // Should throw error
      await expect(sync([])).rejects.toThrow();
    });

    it("fails gracefully when rules directory is empty", async () => {
      // Setup empty rules dir
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Remove default rules
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      // Execute sync - should succeed but write no files
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // No Cursor files should be created
      const cursorRulesDir = join(TEST_DIR, ".cursor", "rules");
      if (existsSync(cursorRulesDir)) {
        const cursorFiles = readdirSync(cursorRulesDir);
        expect(cursorFiles.length).toBe(0);
      }
    });
  });
});
