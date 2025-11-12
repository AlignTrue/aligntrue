/**
 * Backup and restore workflow tests
 * Ensures backup creation, listing, and restoration work correctly
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

const TEST_DIR = join(__dirname, "../../../temp-test-backup");
const CLI_PATH = join(__dirname, "../../dist/index.js");

describe("Backup/Restore Workflow Tests", () => {
  beforeEach(() => {
    // Clean and create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should create a backup", () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, "AGENTS.md"),
      "# Test Rules\n\nSome content here.",
      "utf-8",
    );

    // Create backup
    const output = execSync(`node "${CLI_PATH}" backup`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Verify backup was created
    expect(output).toContain("Backup created");

    // Verify backup directory exists
    const backupDir = join(TEST_DIR, ".aligntrue/.backups");
    expect(existsSync(backupDir)).toBe(true);
  });

  it("should list backups", () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, "AGENTS.md"),
      "# Test Rules\n\nContent.",
      "utf-8",
    );

    // Create a backup
    execSync(`node "${CLI_PATH}" backup`, {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    // List backups
    const output = execSync(`node "${CLI_PATH}" backup list`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Verify output contains backup info
    expect(output).toContain("backup");
  });

  it("should restore from backup", () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    const originalContent = "# Original Rules\n\nOriginal content.";
    writeFileSync(join(TEST_DIR, "AGENTS.md"), originalContent, "utf-8");

    // Create backup
    const backupOutput = execSync(`node "${CLI_PATH}" backup`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Extract timestamp from backup output
    const timestampMatch = backupOutput.match(
      /(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/,
    );
    expect(timestampMatch).toBeTruthy();
    const timestamp = timestampMatch![1];

    // Modify file
    const modifiedContent = "# Modified Rules\n\nModified content.";
    writeFileSync(join(TEST_DIR, "AGENTS.md"), modifiedContent, "utf-8");

    // Verify file was modified
    const afterModify = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
    expect(afterModify).toBe(modifiedContent);

    // Restore from backup
    execSync(`node "${CLI_PATH}" revert --to ${timestamp} --yes`, {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    // Verify file was restored
    const afterRestore = readFileSync(join(TEST_DIR, "AGENTS.md"), "utf-8");
    expect(afterRestore).toBe(originalContent);
  });

  it("should handle multiple backups", () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    // Create first backup
    writeFileSync(join(TEST_DIR, "AGENTS.md"), "Version 1", "utf-8");
    execSync(`node "${CLI_PATH}" backup`, {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    // Wait a bit to ensure different timestamps
    // Note: sleep function defined but not used in this test

    // Create second backup
    writeFileSync(join(TEST_DIR, "AGENTS.md"), "Version 2", "utf-8");
    execSync(`node "${CLI_PATH}" backup`, {
      cwd: TEST_DIR,
      stdio: "pipe",
    });

    // List backups
    const output = execSync(`node "${CLI_PATH}" backup list`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Should show multiple backups
    // Count occurrences of "backup" or timestamp patterns
    const backupCount = (output.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
    expect(backupCount).toBeGreaterThanOrEqual(2);
  });

  it("should auto-backup on sync when configured", () => {
    // Setup with auto_backup enabled
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:
  - agents-md
backup:
  auto_backup: true
  backup_on:
    - sync
`,
      "utf-8",
    );

    writeFileSync(
      join(TEST_DIR, ".aligntrue/.rules.yaml"),
      `id: test-pack
version: "1.0.0"
spec_version: "1"
sections:
  - heading: Test
    content: Test content.
    level: 2
`,
      "utf-8",
    );

    // Run sync
    const output = execSync(`node "${CLI_PATH}" sync`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Verify backup was created
    expect(output).toContain("Backup created") ||
      expect(output).toContain("backup");

    // Verify backup directory exists
    const backupDir = join(TEST_DIR, ".aligntrue/.backups");
    expect(existsSync(backupDir)).toBe(true);
  });

  it("should cleanup old backups", () => {
    // Setup
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });

    writeFileSync(
      join(TEST_DIR, ".aligntrue/config.yaml"),
      `exporters:\n  - agents-md\n`,
      "utf-8",
    );

    writeFileSync(join(TEST_DIR, "AGENTS.md"), "Content", "utf-8");

    // Create multiple backups
    for (let i = 0; i < 3; i++) {
      execSync(`node "${CLI_PATH}" backup`, {
        cwd: TEST_DIR,
        stdio: "pipe",
      });
    }

    // Run cleanup (keep only 1)
    const output = execSync(
      `node "${CLI_PATH}" backup cleanup --keep 1 --yes`,
      {
        cwd: TEST_DIR,
        stdio: "pipe",
        encoding: "utf-8",
      },
    );

    // Verify cleanup happened
    expect(output).toContain("cleanup") ||
      expect(output).toContain("removed") ||
      expect(output).toContain("deleted");

    // List remaining backups
    const listOutput = execSync(`node "${CLI_PATH}" backup list`, {
      cwd: TEST_DIR,
      stdio: "pipe",
      encoding: "utf-8",
    });

    // Should have only 1 backup left
    const backupCount = (listOutput.match(/\d{4}-\d{2}-\d{2}/g) || []).length;
    expect(backupCount).toBeLessThanOrEqual(1);
  });
});
