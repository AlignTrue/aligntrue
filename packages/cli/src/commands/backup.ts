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
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  parseCommonArgs,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { withSpinner, createManagedSpinner } from "../utils/spinner.js";

// Get the exporters package directory for adapter discovery
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get agent file patterns from configured exporters for backup purposes
 */
async function getAgentFilePatterns(cwd: string): Promise<string[]> {
  const patterns: string[] = [];

  try {
    const paths = getAlignTruePaths(cwd);
    const config = await loadConfig(paths.config);
    const exporterNames = getExporterNames(config.exporters);

    // Initialize registry and load adapters
    const registry = new ExporterRegistry();
    const exportersDir = join(__dirname, "../../../exporters/src");

    try {
      const manifests = registry.discoverAdapters(exportersDir);
      for (const manifestPath of manifests) {
        await registry.registerFromManifest(manifestPath);
      }
    } catch {
      // Fallback: try dist directory
      const distExportersDir = join(__dirname, "../../../exporters/dist");
      try {
        const manifests = registry.discoverAdapters(distExportersDir);
        for (const manifestPath of manifests) {
          await registry.registerFromManifest(manifestPath);
        }
      } catch {
        // Registry discovery failed, return empty patterns
      }
    }

    for (const exporterName of exporterNames) {
      const manifest = registry.getManifest(exporterName);
      if (manifest?.outputs) {
        patterns.push(...manifest.outputs);
      }
    }
  } catch {
    // Config load failed, return empty patterns
  }

  return patterns;
}

interface BackupArgs {
  // Common
  help?: boolean;
  config?: string;

  // Create subcommand
  notes?: string;

  // Restore subcommand
  to?: string;

  // Cleanup subcommand
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
  cleanup             Remove old backups based on retention policy

Options:
  --notes <text>      Add notes to backup (create subcommand)
  --to <timestamp>    Restore specific backup by timestamp (restore subcommand)
  --legacy            Cleanup orphaned .bak files (cleanup subcommand)
  --config <path>     Path to config file
  --help              Show this help message

Cleanup uses time-based retention from config:
  - retention_days: Remove backups older than N days (default: 30)
  - minimum_keep: Always keep at least N backups (default: 3)

Examples:
  # Create a manual backup with notes
  aligntrue backup create --notes "Before major refactor"

  # List all backups
  aligntrue backup list

  # Restore most recent backup (restores .aligntrue/ and agent files)
  aligntrue backup restore

  # Restore specific backup
  aligntrue backup restore --to 2025-10-29T12-34-56-789

  # Clean up old backups based on retention policy
  aligntrue backup cleanup

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
  args: BackupArgs,
  argv: string[],
): Promise<void> {
  // Handle legacy cleanup
  if (args.legacy || argv.includes("--legacy")) {
    await handleLegacyCleanup(cwd);
    return;
  }

  const { loadConfig } = await import("@aligntrue/core");
  const config = await loadConfig(undefined, cwd);

  const retentionDays = config.backup?.retention_days ?? 30;
  const minimumKeep = config.backup?.minimum_keep ?? 3;

  const backups = BackupManager.listBackups(cwd);

  if (backups.length <= minimumKeep) {
    clack.log.info(
      `No cleanup needed (${backups.length} backups, minimum keep: ${minimumKeep})`,
    );
    return;
  }

  // Calculate which backups would be removed
  if (retentionDays === 0) {
    clack.log.info(
      "Auto-cleanup disabled (retention_days: 0). Manual cleanup not yet implemented.",
    );
    return;
  }

  const now = Date.now();
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const oldBackups = backups.filter((backup) => {
    const backupTime = new Date(backup.manifest.timestamp).getTime();
    return now - backupTime > retentionMs;
  });

  if (oldBackups.length === 0) {
    clack.log.info(
      `No old backups to remove (retention: ${retentionDays} days, minimum keep: ${minimumKeep})`,
    );
    return;
  }

  const toRemove = Math.max(
    0,
    oldBackups.length - (backups.length - minimumKeep),
  );

  if (toRemove === 0) {
    clack.log.info(
      `No backups to remove (all within minimum keep: ${minimumKeep})`,
    );
    return;
  }

  clack.log.warn(
    `Will remove ${toRemove} backup${toRemove === 1 ? "" : "s"} older than ${retentionDays} days`,
  );
  clack.log.info(`Keeping minimum ${minimumKeep} most recent backups`);

  const confirmed = await clack.confirm({
    message: "Continue with cleanup?",
    initialValue: true,
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step("Cleanup cancelled");
    return;
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

async function handleLegacyCleanup(cwd: string): Promise<void> {
  const { globSync } = await import("glob");
  const { unlinkSync, rmSync, existsSync } = await import("fs");
  const { join } = await import("path");

  const spinner = createManagedSpinner();

  spinner.start("Scanning for legacy backup locations...");

  const itemsToDelete: Array<{ path: string; type: "file" | "directory" }> = [];

  // Find .bak files in workspace root and subdirectories (but not node_modules, .git)
  const bakFiles = globSync(["**/*.bak", ".bak"], {
    cwd,
    ignore: ["node_modules/**", ".git/**", ".aligntrue/**"],
  });

  bakFiles.forEach((f: string) => {
    itemsToDelete.push({ path: join(cwd, f), type: "file" });
  });

  // Find old backup location: .aligntrue/overwritten-rules/
  const overwrittenRulesDir = join(cwd, ".aligntrue", "overwritten-rules");
  if (existsSync(overwrittenRulesDir)) {
    itemsToDelete.push({ path: overwrittenRulesDir, type: "directory" });
  }

  // Find agent-specific overwritten-files locations
  const agentLocations = [
    ".cursor/overwritten-files",
    ".amazonq/overwritten-files",
    ".kilocode/overwritten-files",
    ".augment/overwritten-files",
    ".kiro/overwritten-files",
    ".trae/overwritten-files",
    ".vscode/overwritten-files",
  ];

  for (const agentLoc of agentLocations) {
    const agentOverwrittenDir = join(cwd, agentLoc);
    if (existsSync(agentOverwrittenDir)) {
      itemsToDelete.push({ path: agentOverwrittenDir, type: "directory" });
    }
  }

  spinner.stop(
    `Found ${itemsToDelete.length} legacy backup location(s) to remove`,
  );

  if (itemsToDelete.length === 0) {
    clack.log.success("No legacy backup locations found");
    return;
  }

  clack.log.warn(`Found ${itemsToDelete.length} legacy backup location(s):`);
  itemsToDelete.slice(0, 10).forEach((item) => {
    const relativePath = item.path.replace(cwd + "/", "").replace(cwd, ".");
    console.log(`  - ${relativePath} (${item.type})`);
  });
  if (itemsToDelete.length > 10) {
    console.log(`  ...and ${itemsToDelete.length - 10} more`);
  }

  const confirmed = await clack.confirm({
    message: "Delete these legacy locations?",
    initialValue: false,
  });

  if (clack.isCancel(confirmed) || !confirmed) {
    clack.log.step("Cleanup cancelled");
    return;
  }

  let deleted = 0;
  for (const item of itemsToDelete) {
    try {
      if (item.type === "file") {
        unlinkSync(item.path);
      } else {
        rmSync(item.path, { recursive: true, force: true });
      }
      deleted++;
    } catch {
      // Ignore errors
    }
  }

  clack.log.success(
    `Deleted ${deleted} legacy location${deleted !== 1 ? "s" : ""}`,
  );
  clack.log.info("All backups are now in .aligntrue/.backups/");
}
