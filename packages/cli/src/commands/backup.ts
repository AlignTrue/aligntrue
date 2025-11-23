/**
 * Backup command for AlignTrue CLI
 *
 * Manages backups of .aligntrue/ directory with create/list/restore/cleanup subcommands
 */

import * as clack from "@clack/prompts";
import { BackupManager, type BackupInfo } from "@aligntrue/core";
import {
  parseCommonArgs,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { createSpinner } from "../utils/spinner.js";

interface BackupArgs {
  // Common
  help?: boolean;
  config?: string;

  // Create subcommand
  notes?: string;

  // Restore subcommand
  to?: string;

  // Cleanup subcommand
  keep?: string;
  legacy?: boolean;
}

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--notes",
    hasValue: true,
    description: "Add notes to backup (create subcommand)",
  },
  {
    flag: "--to",
    hasValue: true,
    description: "Restore specific backup by timestamp (restore subcommand)",
  },
  {
    flag: "--keep",
    hasValue: true,
    description: "Number of backups to keep (cleanup subcommand)",
  },
  {
    flag: "--legacy",
    hasValue: false,
    description: "Cleanup orphaned .bak files (cleanup subcommand)",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Path to config file",
  },
];

const HELP_TEXT = `
Usage: aligntrue backup <subcommand> [options]

Manage backups of your .aligntrue/ directory

Subcommands:
  create              Create a manual backup
  list                List all available backups
  restore             Restore from a backup (most recent by default)
  cleanup             Remove old backups (keeps 20 most recent by default)

Options:
  --notes <text>      Add notes to backup (create subcommand)
  --to <timestamp>    Restore specific backup by timestamp (restore subcommand)
  --keep <count>      Number of backups to keep (cleanup subcommand, min 10)
  --legacy            Cleanup orphaned .bak files (cleanup subcommand)
  --config <path>     Path to config file
  --help              Show this help message

Examples:
  # Create a manual backup with notes
  aligntrue backup create --notes "Before major refactor"

  # List all backups
  aligntrue backup list

  # Restore most recent backup (restores .aligntrue/ and agent files)
  aligntrue backup restore

  # Restore specific backup
  aligntrue backup restore --to 2025-10-29T12-34-56-789

  # Clean up old backups, keep only 15
  aligntrue backup cleanup --keep 15

  # Clean up legacy .bak files
  aligntrue backup cleanup --legacy
`;

export async function backupCommand(argv: string[]): Promise<void> {
  const args = parseCommonArgs(argv, ARG_DEFINITIONS);

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const subcommand = (args.positional[0] as string | undefined) ?? argv[0];

  if (!subcommand) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const cwd = process.cwd();

  try {
    switch (subcommand) {
      case "create":
        await handleCreate(cwd, args, argv);
        break;

      case "list":
        await handleList(cwd);
        break;

      case "restore":
        await handleRestore(cwd, args, argv);
        break;

      case "cleanup":
        await handleCleanup(cwd, args, argv);
        break;

      default:
        console.log(HELP_TEXT);
        console.error(`Error: Unknown subcommand: ${subcommand}\n`);
        process.exit(1);
    }
  } catch (error) {
    clack.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function handleCreate(
  cwd: string,
  args: BackupArgs,
  argv: string[],
): Promise<void> {
  const spinner = createSpinner();
  let spinnerActive = false;
  const stopSpinner = (message?: string, code?: number) => {
    if (spinnerActive) {
      spinner.stop(message, code);
      spinnerActive = false;
    }
  };

  spinner.start("Creating backup...");
  spinnerActive = true;

  // Parse notes from argv manually if needed
  const notesIndex = argv.indexOf("--notes");
  const notes =
    notesIndex >= 0 && argv[notesIndex + 1] ? argv[notesIndex + 1] : args.notes;

  try {
    const backupOptions: { cwd: string; created_by: string; notes?: string } = {
      cwd,
      created_by: "manual",
    };
    if (notes) {
      backupOptions.notes = notes;
    }
    const backup = BackupManager.createBackup(backupOptions);

    stopSpinner("Backup created");

    clack.log.success(`Backup: ${backup.timestamp}`);
    if (backup.manifest.notes) {
      clack.log.info(`Notes: ${backup.manifest.notes}`);
    }
    clack.log.info(`Files: ${backup.manifest.files.length} backed up`);
    clack.log.step(`Location: ${backup.path}`);
  } catch (error) {
    stopSpinner("Backup failed", 1);
    throw error;
  }
}

async function handleList(cwd: string): Promise<void> {
  const backups = BackupManager.listBackups(cwd);

  if (backups.length === 0) {
    clack.log.warn("No backups found");
    return;
  }

  clack.log.success(
    `Found ${backups.length} backup${backups.length === 1 ? "" : "s"}:\n`,
  );

  for (const backup of backups) {
    const date = new Date(backup.manifest.timestamp);
    const formattedDate = date.toLocaleString();

    console.log(`  ${backup.timestamp}`);
    console.log(`    Created: ${formattedDate}`);
    console.log(`    By: ${backup.manifest.created_by}`);
    console.log(`    Files: ${backup.manifest.files.length}`);
    if (backup.manifest.notes) {
      console.log(`    Notes: ${backup.manifest.notes}`);
    }
    console.log();
  }
}

async function handleRestore(
  cwd: string,
  args: BackupArgs,
  argv: string[],
): Promise<void> {
  const backups = BackupManager.listBackups(cwd);

  if (backups.length === 0) {
    throw new Error("No backups found");
  }

  // Parse --to from argv manually if needed
  const toIndex = argv.indexOf("--to");
  const toTimestamp =
    toIndex >= 0 && argv[toIndex + 1] ? argv[toIndex + 1] : args.to;

  let targetBackup: BackupInfo | undefined;

  if (toTimestamp) {
    targetBackup = backups.find((b) => b.timestamp === toTimestamp);
    if (!targetBackup) {
      throw new Error(`Backup not found: ${toTimestamp}`);
    }
  } else {
    targetBackup = backups[0]; // Most recent
  }

  if (!targetBackup) {
    clack.log.error("No backups available to restore");
    process.exit(1);
  }

  // Show what will be restored
  const date = new Date(targetBackup.manifest.timestamp);
  const formattedDate = date.toLocaleString();

  clack.log.warn("This will overwrite your current .aligntrue/ directory");
  clack.log.info(`Restoring backup from ${formattedDate}`);
  clack.log.info(`Files: ${targetBackup.manifest.files.length}`);

  const confirmed = await clack.confirm({
    message: "Continue with restore?",
    initialValue: false,
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step("Restore cancelled");
    return;
  }

  const spinner = createSpinner();
  let spinnerActive = false;
  const stopSpinner = (message?: string, code?: number) => {
    if (spinnerActive) {
      spinner.stop(message, code);
      spinnerActive = false;
    }
  };

  spinner.start("Restoring backup...");
  spinnerActive = true;

  try {
    const restoreOptions: { cwd: string; timestamp?: string } = { cwd };
    if (toTimestamp) {
      restoreOptions.timestamp = toTimestamp;
    }
    const restored = BackupManager.restoreBackup(restoreOptions);

    stopSpinner("Restore complete");

    clack.log.success(`Restored backup: ${restored.timestamp}`);
    clack.log.info(`Files restored: ${restored.manifest.files.length}`);
  } catch (error) {
    stopSpinner("Restore failed", 1);
    throw error;
  }
}

async function handleCleanup(
  cwd: string,
  args: BackupArgs,
  argv: string[],
): Promise<void> {
  // Handle legacy cleanup
  if (args.legacy || argv.includes("--legacy")) {
    await handleLegacyCleanup(cwd);
    return;
  }

  const keepIndex = argv.indexOf("--keep");
  const keepValue =
    keepIndex >= 0 && argv[keepIndex + 1] ? argv[keepIndex + 1] : args.keep;
  const keepCount = keepValue ? parseInt(keepValue, 10) : 20;

  if (isNaN(keepCount) || keepCount < 10) {
    throw new Error(`Invalid --keep value: ${keepValue}. Must be at least 10.`);
  }

  const backups = BackupManager.listBackups(cwd);

  if (backups.length <= keepCount) {
    clack.log.info(
      `No cleanup needed (${backups.length} backups, keeping ${keepCount})`,
    );
    return;
  }

  const toRemove = backups.length - keepCount;

  clack.log.warn(
    `Will remove ${toRemove} old backup${toRemove === 1 ? "" : "s"}`,
  );
  clack.log.info(`Keeping ${keepCount} most recent backups`);

  const confirmed = await clack.confirm({
    message: "Continue with cleanup?",
    initialValue: true,
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step("Cleanup cancelled");
    return;
  }

  const spinner = createSpinner();
  let spinnerActive = false;
  const stopSpinner = (message?: string, code?: number) => {
    if (spinnerActive) {
      spinner.stop(message, code);
      spinnerActive = false;
    }
  };

  spinner.start("Cleaning up old backups...");
  spinnerActive = true;

  try {
    const removed = BackupManager.cleanupOldBackups({ cwd, keepCount });

    stopSpinner("Cleanup complete");

    clack.log.success(`Removed ${removed} backup${removed === 1 ? "" : "s"}`);
    clack.log.info(`${keepCount} backups remaining`);
  } catch (error) {
    stopSpinner("Cleanup failed", 1);
    throw error;
  }
}

async function handleLegacyCleanup(cwd: string): Promise<void> {
  const { globSync } = await import("glob");
  const { unlinkSync } = await import("fs");
  const { join } = await import("path");

  const spinner = createSpinner();
  let spinnerActive = false;
  const stopSpinner = (message?: string, code?: number) => {
    if (spinnerActive) {
      spinner.stop(message, code);
      spinnerActive = false;
    }
  };

  spinner.start("Scanning for legacy .bak files...");
  spinnerActive = true;

  const bakFiles = globSync(["**/*.bak", ".bak"], {
    cwd,
    ignore: ["node_modules/**", ".git/**", ".aligntrue/**"],
  });

  stopSpinner(`Found ${bakFiles.length} legacy file(s)`);

  if (bakFiles.length === 0) {
    clack.log.success("No legacy .bak files found");
    return;
  }

  clack.log.warn(`Found ${bakFiles.length} legacy .bak files:`);
  bakFiles.slice(0, 10).forEach((f: string) => console.log(`  - ${f}`));
  if (bakFiles.length > 10) {
    console.log(`  ...and ${bakFiles.length - 10} more`);
  }

  const confirmed = await clack.confirm({
    message: "Delete these files?",
    initialValue: false,
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step("Cleanup cancelled");
    return;
  }

  let deleted = 0;
  for (const file of bakFiles) {
    try {
      unlinkSync(join(cwd, file));
      deleted++;
    } catch {
      // Ignore errors
    }
  }

  clack.log.success(`Deleted ${deleted} legacy file(s)`);
}
