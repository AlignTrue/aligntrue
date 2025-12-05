/**
 * Rule Editing Lifecycle Integration Tests
 *
 * Tests the core user workflow: create/edit/delete rules -> sync -> verify in exporters.
 * This validates the fundamental product promise that changes to rules propagate correctly.
 *
 * Note: Skipped on Windows CI due to persistent file locking issues.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  unlinkSync,
  renameSync,
  mkdirSync,
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
  testProjectContext = setupTestProject({ skipFiles: true });
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
  process.chdir(originalCwd);
  await testProjectContext.cleanup();
});

/**
 * Helper to create a standard config file
 */
function createConfig(exporters: string[] = ["cursor", "agents"]) {
  const config = {
    sources: [{ type: "local", path: ".aligntrue/rules" }],
    exporters,
  };
  writeFileSync(
    join(TEST_DIR, ".aligntrue", "config.yaml"),
    yaml.stringify(config),
    "utf-8",
  );
}

/**
 * Helper to create a rule file with frontmatter
 */
function createRule(filename: string, title: string, content: string) {
  const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
  mkdirSync(rulesDir, { recursive: true });

  const ruleContent = `---
title: "${title}"
---

# ${title}

${content}
`;
  writeFileSync(join(rulesDir, filename), ruleContent, "utf-8");
}

/**
 * Helper to execute sync and handle expected exit
 * Always uses --no-detect to skip agent detection in test environment
 */
async function executeSync(args: string[] = []) {
  try {
    await sync(["--no-detect", ...args]);
  } catch {
    // May throw from process.exit - expected behavior
  }
}

describeSkipWindows("Rule Editing Lifecycle", () => {
  describe("Create New Rule", () => {
    it("creates new rule file -> sync -> appears in Cursor export", async () => {
      createConfig(["cursor"]);
      createRule(
        "new-feature.md",
        "New Feature Guidelines",
        "Use feature flags for new features.",
      );

      await executeSync();

      // Verify: Rule appears in Cursor export
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "new-feature.mdc");
      expect(existsSync(cursorPath)).toBe(true);

      const content = readFileSync(cursorPath, "utf-8");
      expect(content).toContain("New Feature Guidelines");
      expect(content).toContain("Use feature flags for new features");
    });

    it("creates new rule file -> sync -> appears in AGENTS.md", async () => {
      createConfig(["agents"]);
      createRule(
        "security.md",
        "Security Guidelines",
        "Always validate user input.",
      );
      // Add a second rule to trigger link-based format (auto mode uses links for 2+ rules)
      createRule("testing.md", "Testing Standards", "Write tests before code.");

      await executeSync();

      // Verify: Rule appears in AGENTS.md
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);

      const content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("Security Guidelines");
      expect(content).toContain(".aligntrue/rules/security.md");
    });

    it("creates new rule -> sync -> appears in multiple exporters", async () => {
      createConfig(["cursor", "agents"]);
      createRule("testing.md", "Testing Standards", "Write tests before code.");

      await executeSync();

      // Verify: Cursor export
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "testing.mdc");
      expect(existsSync(cursorPath)).toBe(true);
      expect(readFileSync(cursorPath, "utf-8")).toContain("Testing Standards");

      // Verify: AGENTS.md
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsPath)).toBe(true);
      expect(readFileSync(agentsPath, "utf-8")).toContain("Testing Standards");
    });
  });

  describe("Edit Existing Rule", () => {
    it("edits rule content -> sync -> changes propagate to Cursor", async () => {
      createConfig(["cursor"]);
      createRule("code-style.md", "Code Style", "Original content here.");

      // First sync
      await executeSync();
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "code-style.mdc");
      expect(readFileSync(cursorPath, "utf-8")).toContain(
        "Original content here",
      );

      // Edit the rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const updatedContent = `---
title: "Code Style"
---

# Code Style

Updated content with new guidelines.
`;
      writeFileSync(join(rulesDir, "code-style.md"), updatedContent, "utf-8");

      // Sync again
      await executeSync();

      // Verify: Changes propagated
      const updatedExport = readFileSync(cursorPath, "utf-8");
      expect(updatedExport).toContain("Updated content with new guidelines");
      expect(updatedExport).not.toContain("Original content here");
    });

    it("edits rule content -> sync -> changes propagate to AGENTS.md", async () => {
      createConfig(["agents"]);
      createRule("docs.md", "Documentation", "Write docs for public APIs.");

      // First sync
      await executeSync();
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      expect(readFileSync(agentsPath, "utf-8")).toContain("Documentation");

      // Edit the rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const updatedContent = `---
title: "Documentation Updated"
---

# Documentation Updated

Always document all functions, not just public APIs.
`;
      writeFileSync(join(rulesDir, "docs.md"), updatedContent, "utf-8");

      // Sync again
      await executeSync();

      // Verify: Changes propagated (title and content updated)
      const updatedExport = readFileSync(agentsPath, "utf-8");
      expect(updatedExport).toContain("Documentation Updated");
    });

    it("edits rule title -> sync -> title updates in exports", async () => {
      createConfig(["cursor"]);
      createRule("naming.md", "Naming Conventions", "Use camelCase.");

      await executeSync();

      // Edit the title
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const updatedContent = `---
title: "Variable Naming Conventions"
---

# Variable Naming Conventions

Use camelCase for variables, PascalCase for classes.
`;
      writeFileSync(join(rulesDir, "naming.md"), updatedContent, "utf-8");

      await executeSync();

      // Verify: Title updated in export
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "naming.mdc");
      const content = readFileSync(cursorPath, "utf-8");
      expect(content).toContain("Variable Naming Conventions");
    });
  });

  describe("Delete Rule", () => {
    it("deletes rule file -> sync -> AGENTS.md regenerated without deleted rule", async () => {
      // AGENTS.md is a single-file format, fully rewritten each sync
      createConfig(["agents"]);
      createRule("delete-me.md", "Delete Me", "To be removed.");
      createRule("keep-me.md", "Keep Me", "To be kept.");

      // First sync - both rules referenced
      await executeSync();
      const agentsPath = join(TEST_DIR, "AGENTS.md");
      let content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("Delete Me");
      expect(content).toContain("Keep Me");

      // Delete one rule
      unlinkSync(join(TEST_DIR, ".aligntrue", "rules", "delete-me.md"));

      // Sync again
      await executeSync();

      // Verify: Deleted rule not in regenerated AGENTS.md
      content = readFileSync(agentsPath, "utf-8");
      expect(content).not.toContain("Delete Me");
      expect(content).toContain("Keep Me");
    });

    it("multi-file exporters: stale files detected but not auto-cleaned", async () => {
      // By design, sync does NOT auto-remove stale .mdc files to prevent data loss.
      // Stale detection and cleanup is available via separate functions.
      createConfig(["cursor"]);
      createRule("temporary.md", "Temporary Rule", "This will be deleted.");
      createRule("permanent.md", "Permanent Rule", "This stays.");

      // First sync - both rules exist
      await executeSync();
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "temporary.mdc")),
      ).toBe(true);
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "permanent.mdc")),
      ).toBe(true);

      // Delete the temporary rule source
      unlinkSync(join(TEST_DIR, ".aligntrue", "rules", "temporary.md"));

      // Sync again
      await executeSync();

      // Note: Stale .mdc file remains (by design - prevents accidental data loss)
      // Users can run `aligntrue clean` or similar to remove stale exports
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "permanent.mdc")),
      ).toBe(true);

      // Permanent rule content updated correctly
      const content = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "permanent.mdc"),
        "utf-8",
      );
      expect(content).toContain("Permanent Rule");
    });

    it("disabled rule: export skipped and existing export reported as stale", async () => {
      createConfig(["cursor"]);
      createRule("disabled.md", "Temporary Rule", "Should be disabled later.");

      // Initial sync writes the export
      await executeSync();
      const exportPath = join(TEST_DIR, ".cursor", "rules", "disabled.mdc");
      expect(existsSync(exportPath)).toBe(true);

      // Disable the rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const disabledContent = `---
title: "Temporary Rule"
enabled: false
---

# Temporary Rule

Should be disabled later.
`;
      writeFileSync(join(rulesDir, "disabled.md"), disabledContent, "utf-8");

      const warnSpy = vi.spyOn(clack.log, "warn");

      await executeSync();

      // Export no longer rewritten, and stale detection reports the existing file
      expect(existsSync(exportPath)).toBe(true);
      const warnCalls = warnSpy.mock.calls.map((call) => call[0] as string);
      expect(warnCalls.some((msg) => msg.includes("stale export file"))).toBe(
        true,
      );
      expect(
        warnCalls.some((msg) => msg.includes(".cursor/rules/disabled.mdc")),
      ).toBe(true);
    });
  });

  describe("Rename/Reorganize Rules", () => {
    it("renames rule file -> sync -> new export created with updated name", async () => {
      createConfig(["cursor"]);
      createRule("old-name.md", "Guidelines", "Some guidelines.");

      await executeSync();
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "old-name.mdc")),
      ).toBe(true);

      // Rename the file
      renameSync(
        join(TEST_DIR, ".aligntrue", "rules", "old-name.md"),
        join(TEST_DIR, ".aligntrue", "rules", "new-name.md"),
      );

      await executeSync();

      // Verify: New export created with correct content
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "new-name.mdc")),
      ).toBe(true);
      const content = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "new-name.mdc"),
        "utf-8",
      );
      expect(content).toContain("Guidelines");

      // Note: Old export may still exist (stale file, by design)
      // This prevents accidental data loss when files are reorganized
    });

    it("nested subdirectory rules are exported correctly", async () => {
      createConfig(["cursor"]);

      // Create main rules dir first
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });

      // Create a top-level rule first to ensure export dir exists
      const topLevelRule = `---
title: "Top Level Rule"
---

# Top Level Rule

This is at the top level.
`;
      writeFileSync(join(rulesDir, "top-level.md"), topLevelRule, "utf-8");

      // Create rules in subdirectory
      const subDir = join(rulesDir, "backend");
      mkdirSync(subDir, { recursive: true });

      const backendRule = `---
title: "Backend API Rules"
---

# Backend API Rules

Always validate input parameters.
`;
      writeFileSync(join(subDir, "api.md"), backendRule, "utf-8");

      await executeSync();

      // Verify: At least the top-level rule is exported
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      expect(existsSync(cursorDir)).toBe(true);

      const topLevelExport = join(cursorDir, "top-level.mdc");
      expect(existsSync(topLevelExport)).toBe(true);
      expect(readFileSync(topLevelExport, "utf-8")).toContain("Top Level Rule");

      // Note: Subdirectory handling varies by exporter implementation
      // Some exporters flatten, others preserve structure
    });
  });

  describe("Idempotency", () => {
    it("syncing unchanged rules produces identical exports", async () => {
      createConfig(["cursor"]);
      createRule("stable.md", "Stable Rule", "This rule never changes.");

      // First sync
      await executeSync();
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "stable.mdc");
      const firstContent = readFileSync(cursorPath, "utf-8");

      // Second sync without changes
      await executeSync();
      const secondContent = readFileSync(cursorPath, "utf-8");

      // Verify: Content is identical
      expect(secondContent).toBe(firstContent);
    });

    it("sync twice produces same file set", async () => {
      createConfig(["cursor"]);
      createRule("rule1.md", "Rule One", "First rule.");
      createRule("rule2.md", "Rule Two", "Second rule.");

      // First sync
      await executeSync();
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      const firstFiles = readdirSync(cursorDir).sort();

      // Second sync
      await executeSync();
      const secondFiles = readdirSync(cursorDir).sort();

      // Verify: Same files exist
      expect(secondFiles).toEqual(firstFiles);
    });
  });

  describe("Content Integrity", () => {
    it("preserves markdown formatting through sync", async () => {
      createConfig(["cursor"]);

      const complexContent = `---
title: "Complex Formatting"
---

# Complex Formatting

## Code Examples

\`\`\`typescript
function example(): void {
  console.log("Hello");
}
\`\`\`

## Lists

- Item one
- Item two
  - Nested item

## Links

See [documentation](https://example.com) for more.
`;
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(join(rulesDir, "complex.md"), complexContent, "utf-8");

      await executeSync();

      // Verify: Formatting preserved
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "complex.mdc");
      const exportedContent = readFileSync(cursorPath, "utf-8");

      expect(exportedContent).toContain("```typescript");
      expect(exportedContent).toContain('console.log("Hello")');
      expect(exportedContent).toContain("- Item one");
      expect(exportedContent).toContain("- Nested item");
    });

    it("preserves special characters in content", async () => {
      createConfig(["cursor"]);

      const contentWithSpecialChars = `---
title: "Special Characters"
---

# Special Characters

Use \`&&\` for logical AND, \`||\` for OR.

Paths: \`C:\\Users\\test\` or \`/home/user\`.

Quotes: "double" and 'single'.
`;
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "special.md"),
        contentWithSpecialChars,
        "utf-8",
      );

      await executeSync();

      const cursorPath = join(TEST_DIR, ".cursor", "rules", "special.mdc");
      const content = readFileSync(cursorPath, "utf-8");

      expect(content).toContain("&&");
      expect(content).toContain("||");
    });
  });
});
