/**
 * Revert command - restore files from backup with preview
 */

import { BackupManager, type BackupInfo } from "@aligntrue/core";
import { loadConfig } from "@aligntrue/core";
import * as clack from "@clack/prompts";
import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { diffLines } from "diff";
import { globSync } from "glob";
import { isTTY } from "../utils/tty-helper.js";
import { CommonErrors } from "../utils/common-errors.js";
import { exitWithError } from "../utils/error-formatter.js";
import { createManagedSpinner, stopSpinnerSilently } from "../utils/spinner.js";

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
    console.log("      --latest          Restore the most recent backup");
    console.log(
      "  -y, --yes             Skip confirmation prompts (restore immediately)",
    );
    console.log("  -h, --help            Show this help\n");
    console.log("Examples:");
    console.log("  # Interactive restore (preview changes before applying)");
    console.log("  aligntrue revert");
    console.log("");
    console.log("  # Restore specific file with preview");
    console.log("  aligntrue revert AGENTS.md");
    console.log("");
    console.log("  # Restore from specific backup");
    console.log("  aligntrue revert --timestamp 2024-01-15T10-30-00-000Z");
    return;
  }

  const cwd = process.cwd();

  // Parse arguments
  let targetFile: string | undefined;
  let timestamp: string | undefined;
  let yes = false;
  let latest = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "-t" || arg === "--timestamp") {
      timestamp = args[++i];
    } else if (arg === "-y" || arg === "--yes") {
      yes = true;
    } else if (arg === "--latest") {
      latest = true;
    } else if (!arg.startsWith("-")) {
      targetFile = arg;
    }
  }

  if (isTTY()) {
    clack.intro("Revert from backup");
  } else {
    console.log("Revert from backup");
  }

  try {
    // List available backups
    const backups = BackupManager.listBackups(cwd);

    if (backups.length === 0) {
      if (isTTY()) {
        clack.log.warn("No backups found");
        clack.outro("Nothing to revert");
      } else {
        console.log("No backups found");
        console.log("Nothing to revert");
      }
      return;
    }

    let selectedTimestamp: string;

    if (latest) {
      const newest = backups[0];
      if (!newest) {
        console.error("Error: No backups found to restore");
        exitWithError(
          { title: "No backups found", message: "Nothing to restore" },
          1,
        );
      }
      selectedTimestamp = newest.timestamp;
    } else if (timestamp) {
      // Use provided timestamp
      const backup = backups.find((b) => b.timestamp === timestamp);
      if (!backup) {
        const extraHint =
          timestamp === "files"
            ? "Hint: '.backups/files' is an internal folder. Run 'aligntrue backup list' to choose a valid timestamp."
            : "Run 'aligntrue backup list' to view available timestamps.";
        if (isTTY()) {
          clack.log.error(`Backup not found: ${timestamp}`);
          clack.log.info(extraHint);
          clack.log.info("Available backups:");
          backups.forEach((b) => {
            clack.log.info(`  ${b.timestamp} - ${b.manifest.created_by}`);
          });
        } else {
          console.error(`Error: Backup not found: ${timestamp}`);
          console.log(extraHint);
          console.log("Available backups:");
          backups.forEach((b) => {
            console.log(`  ${b.timestamp} - ${b.manifest.created_by}`);
          });
        }
        exitWithError(
          {
            title: "Backup not found",
            message: `Backup not found: ${timestamp}`,
          },
          1,
        );
      }
      selectedTimestamp = timestamp;
    } else {
      if (!isTTY()) {
        console.error(
          "Error: --timestamp or --latest required in non-interactive mode",
        );
        console.error("Usage: aligntrue revert --timestamp <timestamp>");
        console.error("   or: aligntrue revert --latest");
        console.log("\nAvailable backups:");
        backups.forEach((b) => {
          console.log(`  ${b.timestamp} - ${b.manifest.created_by}`);
        });
        exitWithError(
          {
            title: "Timestamp required",
            message:
              "--timestamp or --latest is required in non-interactive mode",
          },
          1,
        );
      }

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
      exitWithError(
        {
          title: "Backup missing",
          message: "Selected backup was not found",
        },
        1,
      );
    }

    // Check for mode mismatch
    const modeMismatch = await detectModeMismatch(backup, cwd);
    if (modeMismatch) {
      const message = [
        "Mode mismatch detected.",
        `Current mode: ${modeMismatch.currentMode || "solo"}`,
        `Backup mode: ${modeMismatch.backupMode}`,
        "Proceeding with restore. Re-enable the backup mode or use a matching backup to avoid differences.",
      ].join(" ");

      if (!isTTY() || yes) {
        // Log to both clack and console for consistent test capture
        clack.log.warn(message);
        console.warn(message);
      } else {
        const action = await promptMigrationOnRestore(modeMismatch);
        if (action === "cancel") {
          clack.cancel("Revert cancelled");
          process.exit(0);
        }
      }
      // Mode changes are not supported in revert
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
      let backupContent = BackupManager.readBackupFile(
        backup.timestamp,
        targetFile,
        { cwd },
      );

      // Fallback for agent files stored under agent-files/ directory
      if (
        !backupContent &&
        backup.manifest.agent_files?.includes(targetFile) &&
        backup.manifest.agent_files.length > 0
      ) {
        const agentPath = resolve(
          cwd,
          ".aligntrue",
          ".backups",
          backup.timestamp,
          "agent-files",
          targetFile,
        );
        if (existsSync(agentPath)) {
          backupContent = readFileSync(agentPath, "utf-8");
        }
      }

      if (!backupContent) {
        if (backup.manifest.agent_files?.includes(targetFile)) {
          // Agent file may not have been captured in manifest paths; skip preview but continue restore
          backupContent = "";
        }
      }

      if (!backupContent) {
        const backupRoot = resolve(
          cwd,
          ".aligntrue",
          ".backups",
          backup.timestamp,
        );
        const matches = globSync(`**/${targetFile}`, { cwd: backupRoot });
        if (matches[0]) {
          const candidate = resolve(backupRoot, matches[0]!);
          backupContent = readFileSync(candidate, "utf-8");
        }
      }

      if (!backupContent) {
        clack.log.error(`File not found in backup: ${targetFile}`);
        clack.outro("Revert cancelled");
        exitWithError(
          {
            title: "File not found in backup",
            message: `File not found in backup: ${targetFile}`,
          },
          1,
        );
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
      if (!isTTY()) {
        exitWithError(CommonErrors.nonInteractiveConfirmation("--yes"), 1);
      }

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
    const spinner = createManagedSpinner({ disabled: !isTTY() });

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

    try {
      BackupManager.restoreBackup(restoreOptions);
    } catch (err) {
      // Fallback: if selective restore fails (e.g., agent file path mismatch), restore full backup
      if (targetFile && backup?.manifest.agent_files?.length) {
        BackupManager.restoreBackup({
          cwd,
          timestamp: selectedTimestamp,
        });
      } else {
        throw err;
      }
    }

    if (isTTY()) {
      // Stop silently without rendering an empty step, outro follows
      stopSpinnerSilently(spinner);
      clack.outro(`✓ Restored from backup ${selectedTimestamp}`);
    } else {
      console.log("✓ Backup restored");
      console.log(`✓ Restored from backup ${selectedTimestamp}`);
    }
  } catch (err) {
    if (isTTY()) {
      clack.log.error(err instanceof Error ? err.message : String(err));
    } else {
      console.error(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    exitWithError(
      {
        title: "Restore failed",
        message: err instanceof Error ? err.message : String(err),
      },
      1,
    );
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
