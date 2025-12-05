import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { revert } from "../../src/commands/revert.js";
import * as ttyHelper from "../../src/utils/tty-helper.js";
import { BackupManager } from "@aligntrue/core";
import * as core from "@aligntrue/core";
import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { cleanupDir } from "../helpers/fs-cleanup.js";

describe("revert command", () => {
  let originalCwd: string;
  let tempDirs: string[];

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDirs = [];
    vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    vi.restoreAllMocks();
    await Promise.all(tempDirs.map((dir) => cleanupDir(dir)));
  });

  it("restores the most recent backup when --latest is used in non-interactive mode", async () => {
    const tmpDir = mkdtempSync(path.join(tmpdir(), "aligntrue-revert-latest-"));
    tempDirs.push(tmpDir);
    const alignDir = path.join(tmpDir, ".aligntrue");
    mkdirSync(path.join(alignDir, ".backups"), { recursive: true });
    writeFileSync(path.join(alignDir, "config.yaml"), "mode: solo\n");
    process.chdir(tmpDir);

    const latest = {
      timestamp: "2025-02-02T10-00-00-abc-0",
      path: "/tmp/latest",
      manifest: {
        version: "1",
        timestamp: "2025-02-02T10:00:00Z",
        files: [],
        created_by: "sync",
        mode: "solo",
      },
    };
    const older = {
      timestamp: "2025-01-01T10-00-00-abc-0",
      path: "/tmp/older",
      manifest: {
        version: "1",
        timestamp: "2025-01-01T10:00:00Z",
        files: [],
        created_by: "sync",
        mode: "solo",
      },
    };

    vi.spyOn(ttyHelper, "isTTY").mockReturnValue(false);
    vi.spyOn(BackupManager, "listBackups").mockReturnValue([latest, older]);
    vi.spyOn(BackupManager, "listBackupFiles").mockReturnValue(["AGENTS.md"]);
    const restoreSpy = vi
      .spyOn(BackupManager, "restoreBackup")
      .mockReturnValue(latest as never);
    vi.spyOn(core, "loadConfig").mockResolvedValue({ mode: "solo" } as never);

    await revert(["--latest", "--yes"]);

    expect(restoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: latest.timestamp }),
    );
  });

  it("skips interactive mode-mismatch prompt with --yes in non-interactive mode", async () => {
    const tmpDir = mkdtempSync(
      path.join(tmpdir(), "aligntrue-revert-mismatch-"),
    );
    tempDirs.push(tmpDir);
    const alignDir = path.join(tmpDir, ".aligntrue");
    mkdirSync(path.join(alignDir, ".backups"), { recursive: true });
    writeFileSync(path.join(alignDir, "config.yaml"), "mode: solo\n");
    process.chdir(tmpDir);

    const backup = {
      timestamp: "2025-03-03T10-00-00-abc-0",
      path: "/tmp/mismatch",
      manifest: {
        version: "1",
        timestamp: "2025-03-03T10:00:00Z",
        files: [],
        created_by: "sync",
        mode: "team",
      },
    };

    vi.spyOn(ttyHelper, "isTTY").mockReturnValue(false);
    vi.spyOn(BackupManager, "listBackups").mockReturnValue([backup]);
    const restoreSpy = vi
      .spyOn(BackupManager, "restoreBackup")
      .mockReturnValue(backup as never);
    vi.spyOn(BackupManager, "listBackupFiles").mockReturnValue(["AGENTS.md"]);
    vi.spyOn(core, "loadConfig").mockResolvedValue({ mode: "solo" } as never);

    await revert(["--timestamp", backup.timestamp, "--yes"]);

    expect(restoreSpy).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: backup.timestamp }),
    );
  });
});
