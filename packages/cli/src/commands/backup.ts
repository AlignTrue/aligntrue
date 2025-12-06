/**
 * Backup command for AlignTrue CLI
 *
 * Manages backups of .aligntrue/ directory with create/list/restore/cleanup subcommands
 */

import * as clack from "@clack/prompts";
import {
  BackupManager,
  type BackupInfo,
  loadConfig,
  getAlignTruePaths,
  getExporterNames,
} from "@aligntrue/core";
import { ExporterRegistry } from "@aligntrue/exporters";
import {
  exitWithError,
  parseCommonArgs,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { withSpinner } from "../utils/spinner.js";
import { discoverExporterManifests } from "../utils/exporter-validation.js";
import {
  AlignTrueError,
  SyncError,
  ValidationError,
} from "../utils/error-types.js";

/**
 * Get agent file patterns from configured exporters for backup purposes
 */
async function getAgentFilePatterns(cwd: string): Promise<string[]> {
  const patterns: string[] = [];

  try {
    const paths = getAlignTruePaths(cwd);
    const config = await loadConfig(paths.config);
    const exporterNames = getExporterNames(config.exporters);

    // Use shared discovery helper
    const registry = new ExporterRegistry();
    const manifestPaths = await discoverExporterManifests(registry);

    for (const manifestPath of manifestPaths) {
      await registry.registerFromManifest(manifestPath);
    }

    for (const exporterName of exporterNames) {
      const manifest = registry.getManifest(exporterName);
      if (manifest?.outputs) {
        patterns.push(...manifest.outputs);
      }
    }
  } catch {
    // Config load or discovery failed, return empty patterns
  }

  return patterns;
}

interface BackupArgs {
  // Common
  help?: boolean;
  positional?: string[];
  config?: string;
  yes?: boolean; // Non-interactive mode - skip confirmation prompts
  latest?: boolean; // Restore most recent backup

  // Create subcommand
  notes?: string;

  // Restore subcommand
  timestamp?: string;
}

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--notes",
    hasValue: true,
    description: "Add notes to backup (create subcommand)",
  },
  {
    flag: "--timestamp",
    hasValue: true,
    description: "Restore specific backup by timestamp (restore subcommand)",
  },
  {
    flag: "--latest",
    hasValue: false,
    description: "Restore the most recent backup (restore subcommand)",
  },
  {
    flag: "--config",
    hasValue: true,
    description: "Path to config file",
  },
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Skip confirmation prompts (for CI/scripts)",
  },
];

const HELP_TEXT = `
Usage: aligntrue backup <subcommand> [options]

Manage local backups of your .aligntrue/ directory

Backup Subcommands:
  create              Create a manual local backup
  list                List all available local backups
  restore             Restore from a local backup (most recent by default)
  cleanup             Remove old local backups based on retention policy

Options:
  --notes <text>         Add notes to backup (create subcommand)
  --timestamp <id>       Restore specific backup by timestamp (restore subcommand)
  --latest               Restore the most recent backup (restore subcommand)
  --config <path>        Path to config file
  --yes, -y              Skip confirmation prompts (for CI/scripts)
  --help                 Show this help message

Local cleanup uses time-based retention from config:
  - retention_days: Remove backups older than N days (default: 30)
  - minimum_keep: Always keep at least N backups (default: 3)

Examples:
  # Create a manual local backup with notes
  aligntrue backup create --notes "Before major refactor"

  # Restore the most recent backup quickly
  aligntrue backup restore --latest --yes

Learn more: https://aligntrue.ai/backup
`;

export async function backupCommand(argv: string[]): Promise<void> {
  let args;
  try {
    args = parseCommonArgs(argv, ARG_DEFINITIONS);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hasBackupConfigFlag = argv.some((arg) =>
      ["--retention_days", "--minimum_keep"].some((flag) =>
        arg.startsWith(flag),
      ),
    );

    if (
      hasBackupConfigFlag ||
      /retention_days|minim(um)?_keep/i.test(message)
    ) {
      clack.log.error(message);
      clack.log.info(
        "These retention settings are configured in .aligntrue/config.yaml, not via CLI flags.",
      );
      clack.log.info(
        "Set them with: aligntrue config set backup.retention_days 30",
      );
      clack.log.info(
        "               aligntrue config set backup.minimum_keep 3",
      );
      exitWithError(2, "Invalid flag for backup cleanup", {
        hint: "Use config keys backup.retention_days and backup.minimum_keep instead of CLI flags.",
      });
    }

    throw err;
  }

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
        throw new ValidationError(
          `Unknown subcommand: ${subcommand}`,
          "Run 'aligntrue backup --help' for usage",
        );
    }
  } catch (error) {
    if (error instanceof AlignTrueError) {
      throw error;
    }

    throw new SyncError(
      error instanceof Error ? error.message : String(error),
      "Backup command failed",
    );
  }
}

async function handleCreate(
  cwd: string,
  args: BackupArgs,
  argv: string[],
): Promise<void> {
  // Parse notes from argv manually if needed
  const notesIndex = argv.indexOf("--notes");
  const notes =
    notesIndex >= 0 && argv[notesIndex + 1] ? argv[notesIndex + 1] : args.notes;

  await withSpinner(
    "Creating backup...",
    async () => {
      // Get agent file patterns from configured exporters
      const agentFilePatterns = await getAgentFilePatterns(cwd);

      const backupOptions: {
        cwd: string;
        created_by: string;
        notes?: string;
        includeAgentFiles?: boolean;
        agentFilePatterns?: string[] | null;
      } = {
        cwd,
        created_by: "manual",
        includeAgentFiles: true,
        agentFilePatterns:
          agentFilePatterns.length > 0 ? agentFilePatterns : null,
      };
      if (notes) {
        backupOptions.notes = notes;
      }
      const backup = BackupManager.createBackup(backupOptions);

      clack.log.success(`Backup: ${backup.timestamp}`);
      if (backup.manifest.notes) {
        clack.log.info(`Notes: ${backup.manifest.notes}`);
      }
      clack.log.info(`Files: ${backup.manifest.files.length} backed up`);
      if (
        backup.manifest.agent_files &&
        backup.manifest.agent_files.length > 0
      ) {
        clack.log.info(
          `Agent files: ${backup.manifest.agent_files.length} backed up`,
        );
      }
      clack.log.step(`Location: ${backup.path}`);
    },
    "Backup created",
    (err) => {
      clack.log.error(`Backup failed: ${err.message}`);
      throw err;
    },
  );
}

async function handleList(cwd: string): Promise<void> {
  const backups = BackupManager.listBackups(cwd);

  if (backups.length === 0) {
    clack.log.warn("No backups found");
    clack.log.info(
      'Backups are local to this machine and are not cloned with the repo.\nCreate one with: aligntrue backup create --notes "initial"',
    );
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
    throw new ValidationError(
      "No backups found",
      "Create a backup first: aligntrue backup create",
    );
  }

  // Parse --timestamp from argv manually if needed
  const timestampIndex = argv.indexOf("--timestamp");
  const latestFlag =
    (args.latest as boolean | undefined) || argv.includes("--latest");
  const toTimestamp =
    timestampIndex >= 0 && argv[timestampIndex + 1]
      ? argv[timestampIndex + 1]
      : args.timestamp;

  if (latestFlag && toTimestamp) {
    throw new ValidationError(
      "Cannot use --latest with --timestamp",
      "Choose one: --latest to restore most recent or --timestamp <id> for a specific backup",
    );
  }

  let targetBackup: BackupInfo | undefined;

  if (toTimestamp) {
    targetBackup = backups.find((b) => b.timestamp === toTimestamp);
    if (!targetBackup) {
      throw new ValidationError(
        `Backup not found: ${toTimestamp}`,
        "Run 'aligntrue backup list' to view available timestamps",
      );
    }
  } else if (latestFlag) {
    targetBackup = backups[0]; // Most recent
  } else {
    targetBackup = backups[0]; // Most recent
  }

  if (!targetBackup) {
    throw new ValidationError(
      "No backups available to restore",
      "Create a backup first: aligntrue backup create",
    );
  }

  // Show what will be restored
  const date = new Date(targetBackup.manifest.timestamp);
  const formattedDate = date.toLocaleString();

  clack.log.warn("This will overwrite your current .aligntrue/ directory");
  clack.log.info(`Restoring backup from ${formattedDate}`);
  clack.log.info(`Files: ${targetBackup.manifest.files.length}`);

  // Check for --yes flag to skip confirmation
  const yesFlag = argv.includes("--yes") || argv.includes("-y");
  if (!yesFlag) {
    const confirmed = await clack.confirm({
      message: "Continue with restore?",
      initialValue: false,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.log.step("Restore cancelled");
      // Non-zero exit code for scripting clarity
      process.exitCode = 1;
      return;
    }
  }

  await withSpinner(
    "Restoring backup...",
    async () => {
      const restoreOptions: { cwd: string; timestamp?: string } = { cwd };
      if (toTimestamp) {
        restoreOptions.timestamp = toTimestamp;
      }
      const restored = BackupManager.restoreBackup(restoreOptions);

      clack.log.success(`Restored backup: ${restored.timestamp}`);
      clack.log.info(`Files restored: ${restored.manifest.files.length}`);
    },
    "Restore complete",
    (err) => {
      clack.log.error(`Restore failed: ${err.message}`);
      throw err;
    },
  );
}

async function handleCleanup(
  cwd: string,
  _args: BackupArgs,
  argv: string[],
): Promise<void> {
  const { loadConfig } = await import("@aligntrue/core");
  const config = await loadConfig(undefined, cwd);

  const retentionDays = config.backup?.retention_days ?? 30;
  const minimumKeep = config.backup?.minimum_keep ?? 3;

  const backups = BackupManager.listBackups(cwd);
  const cleanupTargets = BackupManager.computeCleanupTargets(
    backups,
    retentionDays,
    minimumKeep,
  );

  if (cleanupTargets.length === 0) {
    if (backups.length <= minimumKeep) {
      clack.log.info(
        `No cleanup needed (${backups.length} backups, minimum keep: ${minimumKeep})`,
      );
    } else if (retentionDays <= 0) {
      clack.log.info(
        `No cleanup needed (retention_days: 0, already at minimum keep: ${minimumKeep})`,
      );
    } else {
      clack.log.info(
        `No old backups to remove (retention: ${retentionDays} days, minimum keep: ${minimumKeep})`,
      );
    }
    return;
  }

  clack.log.warn(
    `Will remove ${cleanupTargets.length} backup${cleanupTargets.length === 1 ? "" : "s"}${retentionDays > 0 ? ` older than ${retentionDays} days` : ""}`,
  );
  clack.log.info(`Keeping minimum ${minimumKeep} most recent backups`);

  // Check for --yes flag to skip confirmation
  const yesFlag = argv.includes("--yes") || argv.includes("-y");
  if (!yesFlag) {
    const confirmed = await clack.confirm({
      message: "Continue with cleanup?",
      initialValue: true,
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.log.step("Cleanup cancelled");
      return;
    }
  }

  await withSpinner(
    "Cleaning up old backups...",
    async () => {
      const removed = BackupManager.cleanupOldBackups({
        cwd,
        retentionDays,
        minimumKeep,
      });

      clack.log.success(`Removed ${removed} backup${removed === 1 ? "" : "s"}`);
      clack.log.info(`${backups.length - removed} backups remaining`);
    },
    "Cleanup complete",
    (err) => {
      clack.log.error(`Cleanup failed: ${err.message}`);
      throw err;
    },
  );
}
