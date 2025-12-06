import { BackupManager } from "@aligntrue/core";

export function buildBackupRestoreHint(cwd: string): string | undefined {
  const backups = BackupManager.listBackups(cwd);
  if (!backups.length) {
    return undefined;
  }

  const latest = backups[0];
  if (!latest) {
    return undefined;
  }
  return `Backups detected (${backups.length}). Restore latest: aligntrue backup restore --timestamp ${latest.timestamp} --yes`;
}
