/**
 * Integration tests for sync command
 * Tests real file system operations and actual exports
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { sync } from "../../src/commands/sync.js";
import * as yaml from "yaml";

const TEST_DIR = join(tmpdir(), "aligntrue-test-sync");

beforeEach(() => {
  // Create fresh test directory
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEST_DIR, { recursive: true });

  // Change to test directory
  process.chdir(TEST_DIR);
});

afterEach(() => {
  // Cleanup
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true });
  }
});

describe("Sync Command Integration", () => {
  describe("Basic Sync (IR → Agents)", () => {
    it("reads IR from .aligntrue/rules.md and syncs to exporters", async () => {
      // Setup: Create config and IR
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor", "agents-md"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Execute sync
      await sync([]);

      // Verify: Cursor export created
      const cursorPath = join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc");
      expect(existsSync(cursorPath)).toBe(true);

      const cursorContent = readFileSync(cursorPath, "utf-8");
      expect(cursorContent).toContain("test-rule");
      expect(cursorContent).toContain("Test guidance");

      // Verify: AGENTS.md export created
      const agentsMdPath = join(TEST_DIR, "AGENTS.md");
      expect(existsSync(agentsMdPath)).toBe(true);

      const agentsMdContent = readFileSync(agentsMdPath, "utf-8");
      expect(agentsMdContent).toContain("test-rule");
      expect(agentsMdContent).toContain("Test guidance");
    });

    it("respects configured exporters in config", async () => {
      // Setup: Config with only cursor exporter
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Execute sync
      await sync([]);

      // Verify: Only cursor export created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(true);
      expect(existsSync(join(TEST_DIR, "AGENTS.md"))).toBe(false);
    });

    it("creates backup before syncing", async () => {
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Create existing export to backup
      mkdirSync(join(TEST_DIR, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc"),
        "# Old content\n",
        "utf-8",
      );

      // Execute sync
      await sync([]);

      // Verify: Backup directory created
      const backupDir = join(TEST_DIR, ".aligntrue", "backups");
      expect(existsSync(backupDir)).toBe(true);
    });
  });

  describe("Dry Run Mode", () => {
    it("shows changes without writing files with --dry-run", async () => {
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Execute sync with dry-run
      await sync(["--dry-run"]);

      // Verify: No files created
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("exits with error if config not found", async () => {
      // Mock process.exit
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await sync([]);

      // Restore process.exit
      process.exit = originalExit;

      expect(exitCode).toBe(2);
    });

    it("exits with error if IR not found", async () => {
      // Setup: Config exists but no IR
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      // Mock process.exit
      const originalExit = process.exit;
      let exitCode: number | undefined;
      process.exit = ((code?: number) => {
        exitCode = code;
      }) as never;

      await sync([]);

      // Restore process.exit
      process.exit = originalExit;

      expect(exitCode).toBe(2);
    });
  });

  describe("Custom Config Path", () => {
    it("loads config from custom path with --config flag", async () => {
      // Setup: Custom config location
      mkdirSync(join(TEST_DIR, "custom"), { recursive: true });
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, "custom", "my-config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test-rule
    severity: error
    applies_to: "**/*.ts"
    guidance: Test guidance
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Execute sync with custom config
      await sync(["--config", "custom/my-config.yaml"]);

      // Verify: Sync completed with custom config
      expect(
        existsSync(join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc")),
      ).toBe(true);
    });
  });

  describe("Multiple Rules", () => {
    it("syncs multiple rules correctly", async () => {
      // Setup
      mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

      const config = {
        exporters: ["cursor"],
      };
      writeFileSync(
        join(TEST_DIR, ".aligntrue", "config.yaml"),
        yaml.stringify(config),
        "utf-8",
      );

      const ir = `# AlignTrue Rules

\`\`\`aligntrue
id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: rule-1
    severity: error
    applies_to: "**/*.ts"
    guidance: First rule
  - id: rule-2
    severity: warn
    applies_to: "**/*.js"
    guidance: Second rule
  - id: rule-3
    severity: info
    applies_to: "**/*.md"
    guidance: Third rule
\`\`\`
`;
      writeFileSync(join(TEST_DIR, ".aligntrue", "rules.md"), ir, "utf-8");

      // Execute sync
      await sync([]);

      // Verify: All rules in export
      const cursorContent = readFileSync(
        join(TEST_DIR, ".cursor", "rules", "aligntrue.mdc"),
        "utf-8",
      );
      expect(cursorContent).toContain("rule-1");
      expect(cursorContent).toContain("rule-2");
      expect(cursorContent).toContain("rule-3");
      expect(cursorContent).toContain("First rule");
      expect(cursorContent).toContain("Second rule");
      expect(cursorContent).toContain("Third rule");
    });
  });
});
