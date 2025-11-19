import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { BackupManager } from "../../src/backup/manager";

describe("BackupManager", () => {
  const testDir = join(__dirname, "..", "..", "..", "temp-backup-test");
  const aligntrueDir = join(testDir, ".aligntrue");

  beforeEach(() => {
    // Clean up and create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(aligntrueDir, { recursive: true });

    // Create sample files
    writeFileSync(
      join(aligntrueDir, "config.yaml"),
      "version: 1\nmode: solo",
      "utf-8",
    );
    writeFileSync(
      join(aligntrueDir, ".rules.yaml"),
      "# Rules\n\nTest rules",
      "utf-8",
    );

    // Create subdirectory with file
    mkdirSync(join(aligntrueDir, "subdir"));
    writeFileSync(
      join(aligntrueDir, "subdir", "test.txt"),
      "test content",
      "utf-8",
    );
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("createBackup", () => {
    it("should create a backup with manifest", () => {
      const backup = BackupManager.createBackup({ cwd: testDir });

      expect(backup).toBeDefined();
      // Timestamp format: YYYY-MM-DDTHH-mm-ss-SSS-PID-SEQ
      expect(backup.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}-[a-z0-9]+-[a-z0-9]+$/,
      );
      expect(backup.manifest.version).toBe("1");
      expect(backup.manifest.files).toContain("config.yaml");
      expect(backup.manifest.files).toContain(".rules.yaml");
      expect(backup.manifest.files).toContain("subdir/test.txt");
      expect(backup.manifest.created_by).toBe("manual");
    });

    it("should include notes when provided", () => {
      const backup = BackupManager.createBackup({
        cwd: testDir,
        notes: "Test backup",
      });

      expect(backup.manifest.notes).toBe("Test backup");
    });

    it("should set created_by when provided", () => {
      const backup = BackupManager.createBackup({
        cwd: testDir,
        created_by: "sync",
      });

      expect(backup.manifest.created_by).toBe("sync");
    });

    it("should throw error if .aligntrue directory does not exist", () => {
      const noAligntrueDir = join(testDir, "empty");
      mkdirSync(noAligntrueDir);

      expect(() => {
        BackupManager.createBackup({ cwd: noAligntrueDir });
      }).toThrow("AlignTrue directory not found");
    });

    it("should exclude .backups directory from backup", () => {
      // Create .backups directory with a file
      const backupsDir = join(aligntrueDir, ".backups");
      mkdirSync(backupsDir);
      writeFileSync(join(backupsDir, "old.json"), "{}", "utf-8");

      const backup = BackupManager.createBackup({ cwd: testDir });

      expect(backup.manifest.files).not.toContain(".backups");
      expect(backup.manifest.files).not.toContain(".backups/old.json");
    });
  });

  describe("listBackups", () => {
    it("should return empty array when no backups exist", () => {
      const backups = BackupManager.listBackups(testDir);
      expect(backups).toEqual([]);
    });

    it("should list all backups sorted by timestamp descending", async () => {
      // Create multiple backups with tiny delay to ensure different millisecond timestamps
      const backup1 = BackupManager.createBackup({
        cwd: testDir,
        notes: "First",
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const backup2 = BackupManager.createBackup({
        cwd: testDir,
        notes: "Second",
      });

      const backups = BackupManager.listBackups(testDir);

      expect(backups).toHaveLength(2);
      expect(backups[0].timestamp).toBe(backup2.timestamp); // Newest first
      expect(backups[1].timestamp).toBe(backup1.timestamp);
    });

    it("should skip invalid manifests", () => {
      const backupsDir = join(aligntrueDir, ".backups");
      mkdirSync(backupsDir, { recursive: true });

      // Create valid backup
      BackupManager.createBackup({ cwd: testDir });

      // Create invalid backup directory
      const invalidDir = join(backupsDir, "2025-01-01T00-00-00");
      mkdirSync(invalidDir);
      writeFileSync(join(invalidDir, "manifest.json"), "invalid json", "utf-8");

      const backups = BackupManager.listBackups(testDir);

      expect(backups).toHaveLength(1);
    });
  });

  describe("restoreBackup", () => {
    it("should restore most recent backup when no timestamp provided", async () => {
      // Create initial backup
      const backup1 = BackupManager.createBackup({ cwd: testDir });

      // Small delay to ensure different timestamps (backups use milliseconds)
      await new Promise((resolve) => setTimeout(resolve, 2));

      // Small delay to ensure files are written
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Modify files
      writeFileSync(
        join(aligntrueDir, "config.yaml"),
        "version: 2\nmode: team",
        "utf-8",
      );

      // Restore
      const restored = BackupManager.restoreBackup({ cwd: testDir });

      // Should have restored from the first backup (not the temp backup created during restore)
      expect(restored.timestamp).toBe(backup1.timestamp);

      // Check files are restored
      const content = readFileSync(join(aligntrueDir, "config.yaml"), "utf-8");
      expect(content).toBe("version: 1\nmode: solo");
      expect(restored.manifest.files).toContain("config.yaml");
    });

    it("should restore specific backup by timestamp", async () => {
      const backup1 = BackupManager.createBackup({
        cwd: testDir,
        notes: "First",
      });

      // Modify and create second backup
      await new Promise((resolve) => setTimeout(resolve, 5));
      writeFileSync(join(aligntrueDir, "config.yaml"), "version: 2", "utf-8");
      BackupManager.createBackup({ cwd: testDir, notes: "Second" });

      // Restore first backup
      BackupManager.restoreBackup({
        cwd: testDir,
        timestamp: backup1.timestamp,
      });

      const content = readFileSync(join(aligntrueDir, "config.yaml"), "utf-8");
      expect(content).toBe("version: 1\nmode: solo");
    });

    it("should throw error when no backups exist", () => {
      expect(() => {
        BackupManager.restoreBackup({ cwd: testDir });
      }).toThrow("No backups found");
    });

    it("should throw error when specified backup not found", () => {
      BackupManager.createBackup({ cwd: testDir });

      expect(() => {
        BackupManager.restoreBackup({ cwd: testDir, timestamp: "invalid" });
      }).toThrow("Backup not found: invalid");
    });
  });

  describe("cleanupOldBackups", () => {
    it("should keep specified number of backups", async () => {
      // Create 5 backups with tiny delays to ensure different millisecond timestamps
      for (let i = 0; i < 5; i++) {
        BackupManager.createBackup({ cwd: testDir, notes: `Backup ${i}` });
        if (i < 4) await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const removed = BackupManager.cleanupOldBackups({
        cwd: testDir,
        keepCount: 3,
      });

      expect(removed).toBe(2);
      const remaining = BackupManager.listBackups(testDir);
      expect(remaining).toHaveLength(3);
    });

    it("should default to keeping 20 backups", async () => {
      // Create 22 backups with tiny delays to ensure different millisecond timestamps
      for (let i = 0; i < 22; i++) {
        BackupManager.createBackup({ cwd: testDir });
        if (i < 21) await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const removed = BackupManager.cleanupOldBackups({ cwd: testDir });

      expect(removed).toBe(2);
      const remaining = BackupManager.listBackups(testDir);
      expect(remaining).toHaveLength(20);
    });

    it("should return 0 when backup count is below threshold", () => {
      BackupManager.createBackup({ cwd: testDir });

      const removed = BackupManager.cleanupOldBackups({
        cwd: testDir,
        keepCount: 5,
      });

      expect(removed).toBe(0);
    });
  });

  describe("getBackup", () => {
    it("should return backup by timestamp", () => {
      const created = BackupManager.createBackup({ cwd: testDir });
      const found = BackupManager.getBackup(testDir, created.timestamp);

      expect(found).toBeDefined();
      expect(found?.timestamp).toBe(created.timestamp);
    });

    it("should return undefined when backup not found", () => {
      const found = BackupManager.getBackup(testDir, "nonexistent");
      expect(found).toBeUndefined();
    });
  });

  describe("deleteBackup", () => {
    it("should delete specific backup", () => {
      const backup = BackupManager.createBackup({ cwd: testDir });
      const deleted = BackupManager.deleteBackup(testDir, backup.timestamp);

      expect(deleted).toBe(true);
      expect(BackupManager.listBackups(testDir)).toHaveLength(0);
    });

    it("should return false when backup not found", () => {
      const deleted = BackupManager.deleteBackup(testDir, "nonexistent");
      expect(deleted).toBe(false);
    });
  });
});
