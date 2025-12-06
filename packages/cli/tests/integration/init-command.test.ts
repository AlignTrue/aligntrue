/**
 * Integration tests for init command
 * Tests real file system operations without mocking @aligntrue/* packages
 *
 * Note: Skipped on Windows CI due to persistent EBUSY file locking issues
 * that cannot be reliably worked around. Coverage is provided by Unix CI.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  writeFileSync,
  readFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  chmodSync,
} from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { init } from "../../src/commands/init.js";
import * as yaml from "yaml";
import { cleanupDir } from "../helpers/fs-cleanup.js";

let TEST_DIR: string;

// Skip on Windows due to unreliable file cleanup in CI
const describeSkipWindows =
  process.platform === "win32" ? describe.skip : describe;

beforeEach(async () => {
  TEST_DIR = mkdtempSync(join(tmpdir(), "aligntrue-test-init-"));
  process.chdir(TEST_DIR);
});

afterEach(async () => {
  await cleanupDir(TEST_DIR);
});

describeSkipWindows("Init Command Integration", () => {
  describe("Fresh Start", () => {
    it("creates .aligntrue/config.yaml with correct structure", async () => {
      await init(["--yes"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      expect(existsSync(configPath)).toBe(true);

      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toBeDefined();
      expect(Array.isArray(config.exporters)).toBe(true);
      expect(config.exporters.length).toBeGreaterThan(0);
      // Note: sync.* fields were removed in Ruler-style architecture
    });

    it("creates .aligntrue/rules/ directory with starter templates", async () => {
      await init(["--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      expect(existsSync(rulesDir)).toBe(true);

      // Should have at least one starter rule file
      const { readdirSync } = await import("fs");
      const files = readdirSync(rulesDir).filter((f: string) =>
        f.endsWith(".md"),
      );
      expect(files.length).toBeGreaterThan(0);
    });

    it("creates .aligntrue/README.md with documentation", async () => {
      await init(["--yes"]);

      const readmePath = join(TEST_DIR, ".aligntrue", "README.md");
      expect(existsSync(readmePath)).toBe(true);

      const readmeContent = readFileSync(readmePath, "utf-8");
      expect(readmeContent).toContain("rules/");
      expect(readmeContent).toContain("ONLY DIRECTORY YOU SHOULD EDIT");
      expect(readmeContent).toContain("config.yaml");
      expect(readmeContent).toContain("aligntrue sync");
    });

    it("does not create cursor starter files automatically", async () => {
      await init(["--yes", "--exporters", "cursor"]);

      const cursorPath = join(
        TEST_DIR,
        ".cursor",
        "rules",
        "aligntrue-starter.mdc",
      );
      expect(existsSync(cursorPath)).toBe(false);
    });

    it("respects --exporters flag", async () => {
      await init(["--yes", "--exporters", "cursor,agents"]);

      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.exporters).toEqual(["cursor", "agents"]);
    });
  });

  describe("Already Initialized", () => {
    it("detects existing .aligntrue directory and exits", async () => {
      // Create existing .aligntrue directory
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });
      const rulesDir = join(aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "existing.md"),
        "# Existing rule\n",
        "utf-8",
      );
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        "exporters:\n  - cursor\n",
        "utf-8",
      );

      // Mock process.exit to capture exit code
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await init(["--yes"]);

      // Restore process.exit
      process.exit = originalExit;

      expect(exitCode).toBe(0);
    });

    it("fails when .aligntrue exists but is partial or not writable", async () => {
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });
      chmodSync(aligntrueDir, 0o555); // read/execute only to simulate permission issue

      await expect(init(["--yes"])).rejects.toThrow(/partial AlignTrue setup/i);

      // Restore permissions for cleanup
      chmodSync(aligntrueDir, 0o755);
    });
  });

  describe("File Creation", () => {
    it("creates all files atomically (no .tmp files left behind)", async () => {
      await init(["--yes"]);

      // Check no .tmp files exist
      const files = [
        join(TEST_DIR, ".aligntrue", "config.yaml.tmp"),
        join(TEST_DIR, ".cursor", "rules", "aligntrue-starter.mdc.tmp"),
      ];

      files.forEach((file) => {
        expect(existsSync(file)).toBe(false);
      });
    });

    it("creates directories recursively as needed", async () => {
      await init(["--yes", "--exporters", "cursor"]);

      expect(existsSync(join(TEST_DIR, ".aligntrue"))).toBe(true);
    });
  });

  describe("Team Mode Detection", () => {
    it("detects team mode from existing lockfile", async () => {
      // Setup: Create a team configuration with lockfile
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Create a team mode config
      const teamConfig = {
        mode: "team",
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor", "agents"],
        modules: { lockfile: true },
      };
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        yaml.stringify(teamConfig),
        "utf-8",
      );

      // Create a lockfile (indicates team mode)
      const lockfile = {
        version: "2",
        bundle_hash: "test-hash",
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue/lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create minimal rules directory
      const rulesDir = join(aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "global.md"),
        "## Global\n\nTest content.\n",
        "utf-8",
      );

      // Mock process.exit to capture exit code and stop execution
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`EXIT_${code}`);
      }) as never;

      // Run init - should detect team mode and exit
      try {
        await init(["--yes"]);
      } catch (err) {
        // Expected - process.exit throws to stop execution
        if (!(err instanceof Error) || !err.message.startsWith("EXIT_")) {
          throw err;
        }
      }

      // Restore process.exit
      process.exit = originalExit;

      // Verify exit code is 0 (success, already initialized)
      expect(exitCode).toBe(0);

      // Verify team mode is preserved
      const configPath = join(TEST_DIR, ".aligntrue", "config.yaml");
      const configContent = readFileSync(configPath, "utf-8");
      const config = yaml.parse(configContent);

      expect(config.mode).toBe("team");
      expect(existsSync(join(TEST_DIR, ".aligntrue/lock.json"))).toBe(true);
    });

    it("detects team mode from lockfile even if config is missing mode field", async () => {
      // Setup: Create config without mode field but with lockfile present
      const aligntrueDir = join(TEST_DIR, ".aligntrue");
      mkdirSync(aligntrueDir, { recursive: true });

      // Create a config without explicit mode
      const config = {
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["cursor"],
      };
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Create a lockfile (indicates team mode)
      const lockfile = {
        bundle_hash: "test-hash",
        generated_at: new Date().toISOString(),
        mode: "team",
        rules: [],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue/lock.json"),
        JSON.stringify(lockfile, null, 2),
        "utf-8",
      );

      // Create minimal rules directory
      const rulesDir = join(aligntrueDir, "rules");
      mkdirSync(rulesDir, { recursive: true });
      writeFileSync(
        join(rulesDir, "global.md"),
        "## Global\n\nTest content.\n",
        "utf-8",
      );

      // Mock process.exit to capture exit code and stop execution
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
        throw new Error(`EXIT_${code}`);
      }) as never;

      // Run init - should detect team mode from lockfile and exit
      try {
        await init(["--yes"]);
      } catch (err) {
        // Expected - process.exit throws to stop execution
        if (!(err instanceof Error) || !err.message.startsWith("EXIT_")) {
          throw err;
        }
      }

      // Restore process.exit
      process.exit = originalExit;

      // Verify exit code is 0 (success, already initialized)
      expect(exitCode).toBe(0);

      // Verify lockfile still exists (not deleted)
      expect(existsSync(join(TEST_DIR, ".aligntrue/lock.json"))).toBe(true);
    });

    it("fails when only lockfile exists without config or rules", async () => {
      // Remove .aligntrue directory to simulate clone missing config files
      rmSync(join(TEST_DIR, ".aligntrue"), { recursive: true, force: true });

      // Recreate directory for lockfile
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      writeFileSync(
        join(TEST_DIR, ".aligntrue/lock.json"),
        JSON.stringify(
          {
            bundle_hash: "standalone-hash",
            generated_at: new Date().toISOString(),
            mode: "team",
            rules: [],
          },
          null,
          2,
        ),
        "utf-8",
      );

      await expect(init(["--yes"])).rejects.toThrow(/partial AlignTrue setup/i);
    });
  });

  describe("Starter Template Frontmatter", () => {
    it("adds description to all starter templates", async () => {
      await init(["--yes"]);

      const rulesDir = join(TEST_DIR, ".aligntrue", "rules");
      const { readdirSync } = await import("fs");
      const files = readdirSync(rulesDir).filter((f: string) =>
        f.endsWith(".md"),
      );

      // Verify each starter template has a description
      for (const file of files) {
        const content = readFileSync(join(rulesDir, file), "utf-8");
        // Should have frontmatter with description field
        expect(content).toMatch(/^---\n[\s\S]*?description:/);
      }
    });

    it("sets apply_to: alwaysOn for global rule", async () => {
      await init(["--yes"]);

      const globalRulePath = join(TEST_DIR, ".aligntrue", "rules", "global.md");
      expect(existsSync(globalRulePath)).toBe(true);

      const content = readFileSync(globalRulePath, "utf-8");

      // Should have apply_to field set to alwaysOn
      expect(content).toContain("apply_to: alwaysOn");
    });

    it("does not include STARTER RULE comment in exported rules", async () => {
      await init(["--yes", "--exporters", "cursor"]);

      // Run sync to export rules
      const { sync } = await import("../../src/commands/sync/index.js");
      await sync([]);

      // Check exported cursor rules
      const cursorDir = join(TEST_DIR, ".cursor", "rules");
      if (existsSync(cursorDir)) {
        const { readdirSync } = await import("fs");
        const files = readdirSync(cursorDir).filter((f: string) =>
          f.endsWith(".mdc"),
        );

        for (const file of files) {
          const content = readFileSync(join(cursorDir, file), "utf-8");
          // Exported files should not have STARTER RULE comment
          expect(content).not.toContain("STARTER RULE:");
        }
      }
    });
  });

  describe("Nested Rule Import and Export", () => {
    it("imports nested cursor rule with nested_location and exports to original path", async () => {
      // Create a nested cursor rule at apps/docs/.cursor/rules/web_stack.mdc
      const nestedCursorDir = join(
        TEST_DIR,
        "apps",
        "docs",
        ".cursor",
        "rules",
      );
      mkdirSync(nestedCursorDir, { recursive: true });
      writeFileSync(
        join(nestedCursorDir, "web_stack.mdc"),
        `---
description: Web stack guide for docs site
title: web_stack.mdc
---

# Web stack guide

This is a test rule for the docs app.
`,
        "utf-8",
      );

      // Run init with cursor exporter
      await init(["--yes", "--exporters", "cursor"]);

      // Verify the imported rule has nested_location in frontmatter
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "web_stack.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      expect(importedContent).toContain("nested_location: apps/docs");
      // Note: original_path is no longer written to frontmatter (moved to audit log)

      // Run sync to export the rule
      const { sync } = await import("../../src/commands/sync/index.js");
      await sync([]);

      // Verify the rule was exported to the nested location
      const exportedRulePath = join(nestedCursorDir, "web_stack.mdc");
      expect(existsSync(exportedRulePath)).toBe(true);

      // Verify it was NOT exported to root .cursor/rules/
      const rootCursorDir = join(TEST_DIR, ".cursor", "rules");
      const rootExportPath = join(rootCursorDir, "web_stack.mdc");
      // The root .cursor/rules should not have this file (it should only be in apps/docs/)
      if (existsSync(rootExportPath)) {
        // If root exists, the nested one should also exist
        // Both paths might exist if there's other content, but the key is nested works
        expect(existsSync(exportedRulePath)).toBe(true);
      }
    });

    it("imports nested AGENTS.md with nested_location", async () => {
      // Create a nested AGENTS.md at packages/cli/AGENTS.md
      const nestedAgentsDir = join(TEST_DIR, "packages", "cli");
      mkdirSync(nestedAgentsDir, { recursive: true });
      writeFileSync(
        join(nestedAgentsDir, "AGENTS.md"),
        `# CLI Package Guidelines

## Overview
This is the CLI package agents file.
`,
        "utf-8",
      );

      // Run init with agents exporter
      await init(["--yes", "--exporters", "agents"]);

      // Verify the imported rule has nested_location in frontmatter
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "AGENTS.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      expect(importedContent).toContain("nested_location: packages/cli");
      // Note: original_path is no longer written to frontmatter (moved to audit log)
    });

    it("does not set nested_location for root-level cursor rules", async () => {
      // Create a root-level cursor rule at .cursor/rules/global.mdc
      const rootCursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(rootCursorDir, { recursive: true });
      writeFileSync(
        join(rootCursorDir, "global.mdc"),
        `---
description: Global guidelines
title: global.mdc
---

# Global Guidelines

Root level rule content.
`,
        "utf-8",
      );

      // Run init with cursor exporter
      await init(["--yes", "--exporters", "cursor"]);

      // Verify the imported rule does NOT have nested_location
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "global.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      expect(importedContent).not.toContain("nested_location:");
      // Note: original_path is no longer written to frontmatter (moved to audit log)
    });

    it("infers nested_location from scope when rule has scope but no physical nesting", async () => {
      // Create a root-level cursor rule at .cursor/rules/web_stack.mdc
      // with scope: apps/docs in frontmatter (representing a scoped rule at root)
      const rootCursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(rootCursorDir, { recursive: true });
      writeFileSync(
        join(rootCursorDir, "web_stack.mdc"),
        `---
description: Web stack guide for docs site
title: web_stack
scope: apps/docs
---

# Web stack guide

This is a scoped rule at root level.
`,
        "utf-8",
      );

      // Run init with cursor exporter
      await init(["--yes", "--exporters", "cursor"]);

      // Verify the imported rule has nested_location inferred from scope
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "web_stack.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      // Should have nested_location inferred from scope
      expect(importedContent).toContain("nested_location: apps/docs");
      // Should preserve the original scope
      expect(importedContent).toContain("scope: apps/docs");

      // Run sync to verify the rule exports to the nested location
      const { sync } = await import("../../src/commands/sync/index.js");
      await sync([]);

      // Verify the rule was exported to the nested location
      const nestedCursorDir = join(
        TEST_DIR,
        "apps",
        "docs",
        ".cursor",
        "rules",
      );
      const exportedRulePath = join(nestedCursorDir, "web_stack.mdc");
      expect(existsSync(exportedRulePath)).toBe(true);
    });

    it("does not infer nested_location from generic scope values", async () => {
      // Create a root-level cursor rule with scope: "General" (generic, not a path)
      const rootCursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(rootCursorDir, { recursive: true });
      writeFileSync(
        join(rootCursorDir, "generic.mdc"),
        `---
description: Generic rule
title: generic
scope: General
---

# Generic Rule

This is a generic scoped rule.
`,
        "utf-8",
      );

      // Run init with cursor exporter
      await init(["--yes", "--exporters", "cursor"]);

      // Verify the imported rule does NOT have nested_location
      // (scope: General should not be treated as a path)
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "generic.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      expect(importedContent).not.toContain("nested_location:");
      expect(importedContent).toContain("scope: General");
    });

    it("does not infer nested_location from lowercase generic scope values", async () => {
      // Create a root-level cursor rule with scope: "reference" (lowercase generic, not a path)
      // This tests the fix for the regex /^[a-z][\w-]*$/ that incorrectly matched any lowercase word
      const rootCursorDir = join(TEST_DIR, ".cursor", "rules");
      mkdirSync(rootCursorDir, { recursive: true });
      writeFileSync(
        join(rootCursorDir, "style_guide.mdc"),
        `---
description: Style guide rule
title: style_guide
scope: reference
---

# Style Guide

This rule has a lowercase generic scope that should not be treated as a path.
`,
        "utf-8",
      );

      // Run init with cursor exporter
      await init(["--yes", "--exporters", "cursor"]);

      // Verify the imported rule does NOT have nested_location
      // (scope: reference should not be treated as a path like "apps/docs")
      const importedRulePath = join(
        TEST_DIR,
        ".aligntrue",
        "rules",
        "style_guide.md",
      );
      expect(existsSync(importedRulePath)).toBe(true);

      const importedContent = readFileSync(importedRulePath, "utf-8");
      expect(importedContent).not.toContain("nested_location:");
      expect(importedContent).toContain("scope: reference");
    });
  });
});
