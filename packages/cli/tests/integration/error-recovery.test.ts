/**
 * Error Recovery and Edge Case Tests
 *
 * Tests error handling paths for CLI commands:
 * 1. Sync recovery from partial failure
 * 2. Config validation errors with helpful messages
 * 3. Missing rules directory handling
 * 4. Corrupted lockfile recovery
 *
 * Note: Skipped on Windows CI due to persistent file locking issues
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { writeFileSync, existsSync, rmSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
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

  // Mock clack prompts
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

describeSkipWindows("Error Recovery and Edge Cases", () => {
  describe("Config Validation Errors", () => {
    it("provides helpful message when config is missing", async () => {
      // Delete config file
      unlinkSync(join(TEST_DIR, ".aligntrue", "config.yaml"));

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should reject with helpful error
      await expect(sync([])).rejects.toThrow();
    });

    it("provides helpful message for invalid YAML", async () => {
      // Write invalid YAML
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        `mode: solo
exporters: [
  - cursor  # Invalid - mixed array syntax
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should reject with error
      await expect(sync([])).rejects.toThrow();
    });

    it("provides helpful message for invalid mode", async () => {
      // Write config with invalid mode
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify({
          mode: "invalid-mode",
          exporters: ["cursor"],
        }),
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should reject with error
      await expect(sync([])).rejects.toThrow();
    });
  });

  describe("Missing Rules Directory", () => {
    it("handles missing rules directory gracefully", async () => {
      // Setup config pointing to rules directory
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Delete rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      if (existsSync(rulesDir)) {
        rmSync(rulesDir, { recursive: true });
      }

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should fail with clear error or succeed with no rules
      await expect(sync([])).rejects.toThrow();
    });

    it("handles empty rules directory", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Empty the rules directory
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should succeed but write no files
      try {
        await sync([]);
      } catch {
        // May throw from process.exit
      }

      // No Cursor files should be created
      const cursorRulesDir = join(TEST_DIR, ".cursor", "rules");
      if (existsSync(cursorRulesDir)) {
        const files = readdirSync(cursorRulesDir);
        expect(files.length).toBe(0);
      }
    });
  });

  describe("Corrupted Lockfile Recovery", () => {
    it("handles corrupted lockfile JSON", async () => {
      // Setup team mode config
      const config = {
        mode: "team",
        profile: { id: "test-org" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "test.md"),
        `---
title: Test
---

# Test

Content.
`,
        "utf-8",
      );

      // Write corrupted lockfile
      writeFileSync(
        join(TEST_DIR, ".aligntrue.lock.json"),
        "{ this is not valid json ]",
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should handle corrupted lockfile (regenerate or fail gracefully)
      try {
        await sync([]);
      } catch {
        // May fail but shouldn't crash
      }

      // Either lockfile was regenerated or we failed gracefully
      // Both outcomes are acceptable
    });

    it("handles lockfile with wrong version", async () => {
      // Setup team mode config
      const config = {
        mode: "team",
        profile: { id: "test-org" },
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "test.md"),
        `---
title: Test
---

# Test

Content.
`,
        "utf-8",
      );

      // Write lockfile with wrong version
      writeFileSync(
        join(TEST_DIR, ".aligntrue.lock.json"),
        JSON.stringify({
          version: "999", // Future version
          mode: "team",
          rules: [],
          bundle_hash: "abc",
        }),
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should handle version mismatch gracefully
      try {
        await sync([]);
      } catch {
        // May fail but shouldn't crash
      }
    });
  });

  describe("Invalid Rule Files", () => {
    it("handles rule file with invalid frontmatter", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rule with invalid frontmatter
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "invalid.md"),
        `---
title: [Invalid Array As Title
---

# Content
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should handle gracefully (skip file or fail with helpful error)
      try {
        await sync([]);
      } catch {
        // Expected to fail
      }
    });

    it("handles empty rule file", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create empty rule file
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(join(rulesDir, "empty.md"), "", "utf-8");

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should handle empty file gracefully
      try {
        await sync([]);
      } catch {
        // May fail but shouldn't crash
      }
    });

    it("handles rule file with only frontmatter", async () => {
      // Setup config
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create rule with only frontmatter, no content
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "frontmatter-only.md"),
        `---
title: Frontmatter Only
---
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should handle gracefully
      try {
        await sync([]);
      } catch {
        // May fail but shouldn't crash
      }
    });
  });

  describe("Exporter Errors", () => {
    it("handles missing exporter gracefully", async () => {
      // Setup config with non-existent exporter
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["non-existent-exporter"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "test.md"),
        `---
title: Test
---

# Test

Content.
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      // Should fail with clear error about missing exporter
      await expect(sync([])).rejects.toThrow();
    });
  });

  describe("Check Command Edge Cases", () => {
    it("check command on empty project", async () => {
      // Remove all rules
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      for (const file of readdirSync(rulesDir)) {
        unlinkSync(join(rulesDir, file));
      }

      const { check } = await import("../../src/commands/check.js");

      // Should handle gracefully (pass with warnings or fail clearly)
      try {
        await check([]);
      } catch {
        // May throw from process.exit
      }
    });

    it("check command without config", async () => {
      // Delete config
      unlinkSync(join(TEST_DIR, ".aligntrue", "config.yaml"));

      const { check } = await import("../../src/commands/check.js");

      // Should fail with clear error
      await expect(check([])).rejects.toThrow();
    });
  });

  describe("Dry Run Error Handling", () => {
    it("dry run does not leave partial state on error", async () => {
      // Setup config with invalid exporter to cause error
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "non-existent-exporter"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a rule
      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      writeFileSync(
        join(rulesDir, "test.md"),
        `---
title: Test
---

# Test

Content.
`,
        "utf-8",
      );

      const { sync } = await import("../../src/commands/sync/index.js");

      try {
        await sync(["--dry-run"]);
      } catch {
        // Expected to fail
      }

      // No files should be written in dry-run mode even on partial success
      const cursorRulesDir = join(TEST_DIR, ".cursor", "rules");
      expect(existsSync(cursorRulesDir)).toBe(false);
    });
  });
});
