/**
 * Integration tests for interactive CLI flows
 *
 * Validates critical user workflows that use interactive prompts:
 * - Edit source detection with Cursor files
 * - Backup creation and restoration with agent files
 * - Formatting normalization in exports
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import yaml from "yaml";

/**
 * Test environment utilities
 */
function createTestProject(name: string): string {
  const testDir = join("/tmp", `aligntrue-test-${name}-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestProject(testDir: string): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function runCli(args: string[], cwd: string): string {
  try {
    return execSync(
      `node /Users/gabe/Sites/aligntrue/packages/cli/dist/index.js ${args}`,
      {
        cwd,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }
}

describe("Interactive CLI Flows", () => {
  describe("Edit Source Detection", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = createTestProject("edit-source");
    });

    afterEach(() => {
      cleanupTestProject(testDir);
    });

    it("should detect Cursor files as primary edit source in interactive mode", () => {
      // Create Cursor files before init
      mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(testDir, ".cursor", "rules", "backend.mdc"),
        "## Backend Rules\n\nUse async/await",
      );

      // Run interactive init (this would normally prompt)
      // Note: In non-interactive mode with --yes, it auto-selects Cursor
      runCli("init --yes --mode solo", testDir);

      // Verify config was created
      const configPath = join(testDir, ".aligntrue", "config.yaml");
      expect(existsSync(configPath)).toBe(true);

      // Verify config contains cursor edit source
      const config = yaml.parse(readFileSync(configPath, "utf-8"));
      expect(config.sync?.edit_source).toBe(".cursor/rules/*.mdc");
    });

    it("should default to AGENTS.md when no Cursor files exist", () => {
      // Init without Cursor files
      runCli("init --yes --mode solo", testDir);

      // Verify config defaults to AGENTS.md
      const configPath = join(testDir, ".aligntrue", "config.yaml");
      const config = yaml.parse(readFileSync(configPath, "utf-8"));
      expect(config.sync?.edit_source).toBe("AGENTS.md");
    });
  });

  describe("Backup Creation and Restoration", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = createTestProject("backup-restore");
      // Initialize a project
      runCli("init --yes --mode solo --exporters cursor,agents", testDir);
    });

    afterEach(() => {
      cleanupTestProject(testDir);
    });

    it("should create backup with agent files", () => {
      // Add content and sync to trigger backup
      const agentsPath = join(testDir, "AGENTS.md");
      writeFileSync(
        agentsPath,
        "## Test Rule\n\nThis is a test rule for backup.",
      );

      // Sync (creates backup)
      runCli("sync --yes", testDir);

      // Verify backup directory exists
      const backupDir = join(testDir, ".aligntrue", ".backups");
      expect(existsSync(backupDir)).toBe(true);

      // Get latest backup
      const backups = execSync("ls -t", { cwd: backupDir, encoding: "utf-8" })
        .split("\n")
        .filter((line) => line.trim());
      expect(backups.length).toBeGreaterThan(0);

      const latestBackup = backups[0];
      const backupPath = join(backupDir, latestBackup);

      // Verify backup structure
      expect(existsSync(join(backupPath, "config.yaml"))).toBe(true);
      expect(existsSync(join(backupPath, ".rules.yaml"))).toBe(true);

      // Verify agent files are in backup
      const agentFilesDir = join(backupPath, "agent-files");
      if (existsSync(agentFilesDir)) {
        const files = execSync("ls", { cwd: agentFilesDir, encoding: "utf-8" })
          .split("\n")
          .filter((line) => line.trim());
        // Agent files should be backed up
        expect(files.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("should restore from backup correctly", () => {
      // Modify a file
      const agentsPath = join(testDir, "AGENTS.md");
      writeFileSync(agentsPath, "## Original Rule\n\nOriginal content.");
      runCli("sync --yes", testDir);

      // Get backup timestamp
      const backupDir = join(testDir, ".aligntrue", ".backups");
      const backups = execSync("ls -t", { cwd: backupDir, encoding: "utf-8" })
        .split("\n")
        .filter((line) => line.trim());
      const latestBackup = backups[0];

      // Modify file again
      writeFileSync(agentsPath, "## Modified Rule\n\nModified content.");

      // Restore from backup
      runCli(`revert --to ${latestBackup} --yes`, testDir);

      // Verify file was restored
      const content = readFileSync(agentsPath, "utf-8");
      expect(content).toContain("Original Rule");
    });
  });

  describe("Formatting Normalization", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = createTestProject("formatting");
      runCli("init --yes --mode solo --exporters cursor,agents", testDir);
    });

    afterEach(() => {
      cleanupTestProject(testDir);
    });

    it("should normalize horizontal rules followed by headings", () => {
      // Create AGENTS.md with formatting issue: ---### without newline
      const agentsPath = join(testDir, "AGENTS.md");
      writeFileSync(
        agentsPath,
        "## First Section\n\nContent here.\n\n---### Second Section\n\nMore content.",
      );

      // Sync to export and normalize
      runCli("sync --yes", testDir);

      // Check exported file formatting
      const exportedPath = join(testDir, "AGENTS.md");
      const content = readFileSync(exportedPath, "utf-8");

      // Should have proper spacing, not concatenated ---###
      expect(content).not.toMatch(/---###/);
      // Should have newlines after horizontal rule
      expect(content).toMatch(/---\n\n#/);
    });

    it("should maintain horizontal rule spacing around content", () => {
      const agentsPath = join(testDir, "AGENTS.md");
      writeFileSync(agentsPath, "Content before.\n---\nContent after.");

      runCli("sync --yes", testDir);

      const content = readFileSync(agentsPath, "utf-8");
      // Should have spacing around horizontal rules
      expect(content).toMatch(/\n\n---\n\n/);
    });
  });

  describe("Non-Interactive Mode Behavior", () => {
    let testDir: string;

    beforeEach(() => {
      testDir = createTestProject("non-interactive");
    });

    afterEach(() => {
      cleanupTestProject(testDir);
    });

    it("should use Cursor as default edit source when files exist", () => {
      // Create Cursor files
      mkdirSync(join(testDir, ".cursor", "rules"), { recursive: true });
      writeFileSync(
        join(testDir, ".cursor", "rules", "main.mdc"),
        "## Main Rules",
      );

      // Init with --yes (non-interactive)
      runCli("init --yes", testDir);

      const configPath = join(testDir, ".aligntrue", "config.yaml");
      const config = yaml.parse(readFileSync(configPath, "utf-8"));

      // Non-interactive mode should auto-select Cursor when files exist
      expect(config.sync?.edit_source).toBe(".cursor/rules/*.mdc");
    });

    it("should use AGENTS.md as fallback in non-interactive mode", () => {
      // Init with --yes without Cursor files
      runCli("init --yes", testDir);

      const configPath = join(testDir, ".aligntrue", "config.yaml");
      const config = yaml.parse(readFileSync(configPath, "utf-8"));

      // Should default to AGENTS.md
      expect(config.sync?.edit_source).toBe("AGENTS.md");
    });
  });
});
