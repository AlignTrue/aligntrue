/**
 * Revert command - restore files from backup with preview
 */

import { BackupManager, type BackupInfo } from "@aligntrue/core";
import { loadConfig } from "@aligntrue/core";
import * as clack from "@clack/prompts";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { diffLines } from "diff";

/**
 * Execute revert command
 */
export async function revert(args: string[]): Promise<void> {
  // Show help
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Restore files from backup with preview\n");
    console.log("Usage: aligntrue revert [file] [options]\n");
    console.log("Options:");
    console.log("  -t, --timestamp <id>  Backup timestamp to restore from");
    console.log("  -y, --yes             Skip confirmation prompts");
    console.log("  -h, --help            Show this help\n");
    console.log("Examples:");
    console.log("  aligntrue revert");
    console.log("  aligntrue revert AGENTS.md");
    console.log("  aligntrue revert --timestamp 2024-01-15T10-30-00-000Z");
    console.log("  aligntrue revert .cursor/rules/aligntrue.mdc -y");
    return;
  }

  const cwd = process.cwd();

  // Parse arguments
  let targetFile: string | undefined;
  let timestamp: string | undefined;
  let yes = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "-t" || arg === "--timestamp") {
      timestamp = args[++i];
    } else if (arg === "-y" || arg === "--yes") {
      yes = true;
    } else if (!arg.startsWith("-")) {
      targetFile = arg;
    }
  }

  clack.intro("Revert from backup");

  try {
    // List available backups
    const backups = BackupManager.listBackups(cwd);

    if (backups.length === 0) {
      clack.log.warn("No backups found");
      clack.outro("Nothing to revert");
      return;
    }

    let selectedTimestamp: string;

    if (timestamp) {
      // Use provided timestamp
      const backup = backups.find((b) => b.timestamp === timestamp);
      if (!backup) {
        clack.log.error(`Backup not found: ${timestamp}`);
        clack.log.info("Available backups:");
        backups.forEach((b) => {
          clack.log.info(`  ${b.timestamp} - ${b.manifest.created_by}`);
        });
        process.exit(1);
      }
      selectedTimestamp = timestamp;
    } else {
      // Interactive backup selection
      const backupChoices = backups.map((b) => ({
        value: b.timestamp,
        label: `${b.timestamp} - ${b.manifest.created_by}`,
        hint: b.manifest.notes || "No notes",
      }));

      const selected = await clack.select({
        message: "Choose backup to restore:",
        options: backupChoices,
      });

      if (clack.isCancel(selected)) {
        clack.cancel("Revert cancelled");
        process.exit(0);
      }

      selectedTimestamp = selected as string;
    }

    const backup = backups.find((b) => b.timestamp === selectedTimestamp);
    if (!backup) {
      clack.log.error("Internal error: selected backup not found");
      process.exit(1);
    }

    // Check for mode mismatch
    const modeMismatch = await detectModeMismatch(backup, cwd);
    if (modeMismatch) {
      const action = await promptMigrationOnRestore(modeMismatch);
      if (action === "cancel") {
        clack.cancel("Revert cancelled");
        process.exit(0);
      }
      // TODO: Apply mode change if needed
    }

    // Show diff preview
    if (targetFile) {
      // Preview single file diff
      const filePath = resolve(cwd, targetFile);
      if (!existsSync(filePath)) {
        clack.log.warn(`Current file not found: ${targetFile}`);
      }

      const currentContent = existsSync(filePath)
        ? readFileSync(filePath, "utf-8")
        : "";
      const backupContent = BackupManager.readBackupFile(
        backup.timestamp,
        targetFile,
        { cwd },
      );

      if (!backupContent) {
        clack.log.error(`File not found in backup: ${targetFile}`);
        clack.outro("Revert cancelled");
        process.exit(1);
      }

      // Calculate diff
      const diff = diffLines(currentContent, backupContent);
      const hasChanges = diff.some((part) => part.added || part.removed);

      if (!hasChanges) {
        clack.log.info("No changes detected");
        clack.outro("File already matches backup");
        return;
      }

      // Show diff
      clack.log.info(`\nPreview of changes to ${targetFile}:`);
      console.log("");

      diff.forEach((part) => {
        const prefix = part.added ? "+" : part.removed ? "-" : " ";
        const lines = part.value.split("\n");
        lines.forEach((line, idx) => {
          if (idx === lines.length - 1 && line === "") return; // Skip trailing newline

          let color = "\x1b[0m"; // Reset
          if (part.added) color = "\x1b[32m"; // Green
          if (part.removed) color = "\x1b[31m"; // Red

          console.log(`${color}${prefix} ${line}\x1b[0m`);
        });
      });

      console.log("");
    } else {
      // Show summary of all files in backup
      clack.log.info("\nBackup contents:");
      const files = BackupManager.listBackupFiles(selectedTimestamp, { cwd });
      if (files.length === 0) {
        clack.log.warn("No files in this backup");
      } else {
        files.forEach((file) => {
          clack.log.info(`  - ${file}`);
        });
      }
      console.log("");
    }

    // Confirm restore
    if (!yes) {
      const confirm = await clack.confirm({
        message: targetFile
          ? `Restore ${targetFile} from backup ${selectedTimestamp}?`
          : `Restore all files from backup ${selectedTimestamp}?`,
      });

      if (!confirm || clack.isCancel(confirm)) {
        clack.cancel("Revert cancelled");
        process.exit(0);
      }
    }

    // Restore backup
    const spinner = clack.spinner();
    spinner.start("Restoring backup");

    const restoreOptions: {
      cwd: string;
      timestamp: string;
      files?: string[];
    } = {
      cwd,
      timestamp: selectedTimestamp,
    };

    if (targetFile) {
      restoreOptions.files = [targetFile];
    }

    BackupManager.restoreBackup(restoreOptions);

    spinner.stop("Backup restored");
    clack.outro(`✓ Restored from backup ${selectedTimestamp}`);
  } catch (err) {
    clack.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/**
 * Detect mode mismatch between current config and backup
 */
async function detectModeMismatch(
  backup: BackupInfo,
  cwd: string,
): Promise<{ currentMode: string; backupMode: string } | null> {
  // Check if backup has mode information
  if (!backup.manifest.mode) {
    return null;
  }

  // Load current config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  if (!existsSync(configPath)) {
    return null;
  }

  try {
    const config = await loadConfig(configPath);
    if (config.mode !== backup.manifest.mode) {
      return {
        currentMode: config.mode,
        backupMode: backup.manifest.mode,
      };
    }
  } catch {
    // Ignore config load errors
  }

  return null;
}

/**
 * Prompt user for action when mode mismatch is detected
 */
async function promptMigrationOnRestore(mismatch: {
  currentMode: string;
  backupMode: string;
}): Promise<"switch" | "migrate" | "cancel"> {
  console.log("\n┌─────────────────────────────────────────────────────────┐");
  console.log("│ Mode Mismatch Detected                                  │");
  console.log("│                                                         │");
  console.log(`│ Current mode: ${mismatch.currentMode.padEnd(44)} │`);
  console.log(`│ Backup mode: ${mismatch.backupMode.padEnd(45)} │`);
  console.log("│                                                         │");
  console.log("│ This backup contains rules from a different mode.      │");
  console.log("└─────────────────────────────────────────────────────────┘\n");

  const action = await clack.select({
    message: "What would you like to do?",
    options: [
      {
        value: "switch",
        label: `Switch back to ${mismatch.backupMode} mode`,
        hint: "Restores backup as-is and changes mode",
      },
      {
        value: "migrate",
        label: `Stay in ${mismatch.currentMode} mode and migrate`,
        hint: "Restores backup and runs migration wizard",
      },
      {
        value: "cancel",
        label: "Cancel restore",
        hint: "Keep current state",
      },
    ],
  });

  if (clack.isCancel(action)) {
    return "cancel";
  }

  return action as "switch" | "migrate" | "cancel";
}
