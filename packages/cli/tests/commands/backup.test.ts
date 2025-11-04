import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { backupCommand } from "../../src/commands/backup";
import { BackupManager } from "@aligntrue/core";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";

// Mock clack
vi.mock("@clack/prompts", () => ({
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    step: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  confirm: vi.fn(() => Promise.resolve(true)),
  isCancel: vi.fn(() => false),
}));

describe("backup command", () => {
  const testDir = join(__dirname, "..", "..", "..", "temp-backup-cli-test");
  const aligntrueDir = join(testDir, ".aligntrue");
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();

    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(aligntrueDir, { recursive: true });

    // Create sample files
    writeFileSync(join(aligntrueDir, "config.yaml"), "mode: solo", "utf-8");
    writeFileSync(join(aligntrueDir, "rules.md"), "# Rules", "utf-8");

    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("create subcommand", () => {
    it("should create a backup", async () => {
      await backupCommand(["create"]);

      const backups = BackupManager.listBackups(testDir);
      expect(backups).toHaveLength(1);
      expect(backups[0].manifest.created_by).toBe("manual");
    });

    it("should create backup with notes", async () => {
      await backupCommand(["create", "--notes", "Test backup"]);

      const backups = BackupManager.listBackups(testDir);
      expect(backups).toHaveLength(1);
      expect(backups[0].manifest.notes).toBe("Test backup");
    });
  });

  describe("list subcommand", () => {
    it("should list backups", async () => {
      BackupManager.createBackup({ cwd: testDir });

      await expect(backupCommand(["list"])).resolves.toBeUndefined();
    });

    it("should handle no backups", async () => {
      await expect(backupCommand(["list"])).resolves.toBeUndefined();
    });
  });

  describe("restore subcommand", () => {
    it("should restore most recent backup", async () => {
      const backup = BackupManager.createBackup({ cwd: testDir });

      // Modify files
      writeFileSync(join(aligntrueDir, "config.yaml"), "mode: team", "utf-8");

      await backupCommand(["restore"]);

      // File should be restored
      const content = readFileSync(join(aligntrueDir, "config.yaml"), "utf-8");
      expect(content).toBe("mode: solo");
    });

    it("should restore specific backup", async () => {
      const backup1 = BackupManager.createBackup({ cwd: testDir });
      await new Promise((resolve) => setTimeout(resolve, 5));

      writeFileSync(join(aligntrueDir, "config.yaml"), "mode: team", "utf-8");
      BackupManager.createBackup({ cwd: testDir });

      await backupCommand(["restore", "--to", backup1.timestamp]);

      const content = readFileSync(join(aligntrueDir, "config.yaml"), "utf-8");
      expect(content).toBe("mode: solo");
    });
  });

  describe("cleanup subcommand", () => {
    it("should cleanup old backups", async () => {
      // Create 5 backups
      for (let i = 0; i < 5; i++) {
        BackupManager.createBackup({ cwd: testDir });
        if (i < 4) await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await backupCommand(["cleanup", "--keep", "3"]);

      const backups = BackupManager.listBackups(testDir);
      expect(backups).toHaveLength(3);
    });

    it("should use default keep count", async () => {
      // Create 12 backups
      for (let i = 0; i < 12; i++) {
        BackupManager.createBackup({ cwd: testDir });
        if (i < 11) await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await backupCommand(["cleanup"]);

      const backups = BackupManager.listBackups(testDir);
      expect(backups).toHaveLength(10);
    });
  });

  describe("error handling", () => {
    it("should show help on missing subcommand", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await backupCommand([]);

      expect(exitSpy).toHaveBeenCalledWith(0);
      exitSpy.mockRestore();
    });

    it("should error on unknown subcommand", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await backupCommand(["unknown"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });
});

// Add missing import
import { readFileSync } from "fs";
