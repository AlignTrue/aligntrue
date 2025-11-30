import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { backupCommand } from "../../src/commands/backup";
import { BackupManager } from "@aligntrue/core";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
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

    // Create rules directory with markdown file
    const rulesDir = join(aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });
    writeFileSync(
      join(rulesDir, "global.md"),
      "## Global\n\nTest rules\n",
      "utf-8",
    );

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
      const _backup = BackupManager.createBackup({ cwd: testDir });

      // Small delay to ensure different timestamps (backups use milliseconds)
      await new Promise((resolve) => setTimeout(resolve, 2));

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

  // Note: cleanup subcommand tests removed - they tested the old count-based
  // cleanup behavior. The current implementation uses time-based retention
  // (retention_days, minimum_keep) from config, which is hard to test
  // in unit tests since all backups are created within seconds.

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
