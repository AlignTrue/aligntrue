/**
 * Tests for agent file backup and restore
 * Validates that agent files matching patterns are backed up and restored
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { BackupManager } from "../../src/backup/manager.js";
import type { BackupOptions } from "../../src/backup/types.js";

const testRoot = join(process.cwd(), "temp-test-backup-agent-files");

describe("BackupManager agent files", () => {
  beforeEach(() => {
    // Clean up before each test
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }

    // Create test directory structure
    mkdirSync(join(testRoot, ".aligntrue"), { recursive: true });
    mkdirSync(join(testRoot, ".cursor", "rules"), { recursive: true });

    // Create test files
    writeFileSync(
      join(testRoot, ".aligntrue", "config.yaml"),
      "mode: solo\n",
      "utf-8",
    );
    writeFileSync(join(testRoot, "AGENTS.md"), "# Test rules\n", "utf-8");
    writeFileSync(
      join(testRoot, ".cursor", "rules", "test.mdc"),
      "# Cursor rules\n",
      "utf-8",
    );
  });

  afterEach(() => {
    // Clean up after each test
    if (existsSync(testRoot)) {
      rmSync(testRoot, { recursive: true, force: true });
    }
  });

  it("should backup AGENTS.md when pattern matches", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: "AGENTS.md",
    };

    const backup = BackupManager.createBackup(options);

    expect(backup.manifest.agent_files).toBeDefined();
    expect(backup.manifest.agent_files).toContain("AGENTS.md");

    // Verify file was actually copied
    const backupFilePath = join(backup.path, "agent-files", "AGENTS.md");
    expect(existsSync(backupFilePath)).toBe(true);
    const content = readFileSync(backupFilePath, "utf-8");
    expect(content).toBe("# Test rules\n");
  });

  it("should backup .cursor/*.mdc files when glob pattern matches", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: ".cursor/rules/*.mdc",
    };

    const backup = BackupManager.createBackup(options);

    expect(backup.manifest.agent_files).toBeDefined();
    expect(backup.manifest.agent_files).toContain(".cursor/rules/test.mdc");

    // Verify file was actually copied
    const backupFilePath = join(
      backup.path,
      "agent-files",
      ".cursor",
      "rules",
      "test.mdc",
    );
    expect(existsSync(backupFilePath)).toBe(true);
  });

  it("should backup multiple files when array of patterns", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: ["AGENTS.md", ".cursor/rules/*.mdc"],
    };

    const backup = BackupManager.createBackup(options);

    expect(backup.manifest.agent_files).toBeDefined();
    expect(backup.manifest.agent_files).toContain("AGENTS.md");
    expect(backup.manifest.agent_files).toContain(".cursor/rules/test.mdc");
  });

  it("should not backup agent files when includeAgentFiles is false", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: false,
      agentFilePatterns: "AGENTS.md",
    };

    const backup = BackupManager.createBackup(options);

    expect(
      backup.manifest.agent_files === undefined ||
        backup.manifest.agent_files.length === 0,
    ).toBe(true);
  });

  it("should not backup agent files when agentFilePatterns not provided", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      // agentFilePatterns not provided
    };

    const backup = BackupManager.createBackup(options);

    expect(
      backup.manifest.agent_files === undefined ||
        backup.manifest.agent_files.length === 0,
    ).toBe(true);
  });

  it("should restore agent files from backup", () => {
    // Create backup
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: "AGENTS.md",
    };

    const backup = BackupManager.createBackup(options);

    // Delete original file
    rmSync(join(testRoot, "AGENTS.md"), { force: true });
    expect(existsSync(join(testRoot, "AGENTS.md"))).toBe(false);

    // Restore backup
    BackupManager.restoreBackup({
      cwd: testRoot,
      timestamp: backup.timestamp,
    });

    // Verify file was restored
    expect(existsSync(join(testRoot, "AGENTS.md"))).toBe(true);
    const content = readFileSync(join(testRoot, "AGENTS.md"), "utf-8");
    expect(content).toBe("# Test rules\n");
  });

  it("should restore multiple agent files from backup", () => {
    // Create backup
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: ["AGENTS.md", ".cursor/rules/*.mdc"],
    };

    const backup = BackupManager.createBackup(options);

    // Delete original files
    rmSync(join(testRoot, "AGENTS.md"), { force: true });
    rmSync(join(testRoot, ".cursor", "rules", "test.mdc"), { force: true });

    // Restore backup
    BackupManager.restoreBackup({
      cwd: testRoot,
      timestamp: backup.timestamp,
    });

    // Verify files were restored
    expect(existsSync(join(testRoot, "AGENTS.md"))).toBe(true);
    expect(existsSync(join(testRoot, ".cursor", "rules", "test.mdc"))).toBe(
      true,
    );
  });

  it("should handle missing agent files gracefully during backup", () => {
    const options: BackupOptions = {
      cwd: testRoot,
      created_by: "test",
      includeAgentFiles: true,
      agentFilePatterns: "nonexistent.md",
    };

    // Should not throw
    const backup = BackupManager.createBackup(options);

    expect(
      backup.manifest.agent_files === undefined ||
        backup.manifest.agent_files.length === 0,
    ).toBe(true);
  });
});
