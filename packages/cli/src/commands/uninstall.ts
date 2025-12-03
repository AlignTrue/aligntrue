/**
 * Uninstall command for AlignTrue CLI
 *
 * Provides a clean way to remove AlignTrue from a project, with interactive
 * prompts for what to keep/remove.
 */

import * as clack from "@clack/prompts";
import {
  detectAlignTrueFiles,
  previewUninstall,
  executeUninstall,
  type UninstallOptions,
  type ExportHandling,
  type SourceHandling,
  type DetectionResult,
  type UninstallPreview,
} from "@aligntrue/core";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { withSpinner } from "../utils/spinner.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview changes without making them",
  },
  {
    flag: "--non-interactive",
    alias: "-y",
    hasValue: false,
    description: "Run without prompts (use with export/source flags)",
  },
  {
    flag: "--convert-exports",
    hasValue: false,
    description: "Convert exports to editable (remove READ-ONLY markers)",
  },
  {
    flag: "--delete-exports",
    hasValue: false,
    description: "Delete all exported agent files",
  },
  {
    flag: "--keep-exports",
    hasValue: false,
    description: "Keep exports as-is (skip)",
  },
  {
    flag: "--delete-source",
    hasValue: false,
    description: "Delete .aligntrue/ directory",
  },
  {
    flag: "--keep-source",
    hasValue: false,
    description: "Keep .aligntrue/ directory",
  },
];

const HELP_CONFIG = {
  name: "uninstall",
  description:
    "Remove AlignTrue from the current project. Creates a backup before making changes.",
  usage: "aligntrue uninstall [options]",
  args: ARG_DEFINITIONS,
  examples: [
    "aligntrue uninstall                             Interactive mode",
    "aligntrue uninstall --dry-run                   Preview what would change",
    "aligntrue uninstall -y --convert-exports        Non-interactive: convert exports",
    "aligntrue uninstall -y --delete-exports --delete-source  Full removal",
  ],
  notes: [
    "A backup is always created before any changes are made.",
    "You can restore with: aligntrue backup restore --timestamp <backup-id>",
  ],
};

interface UninstallFlags {
  dryRun: boolean;
  nonInteractive: boolean;
  convertExports: boolean;
  deleteExports: boolean;
  keepExports: boolean;
  deleteSource: boolean;
  keepSource: boolean;
}

/**
 * Check if running in interactive terminal
 */
function isTTY(): boolean {
  return Boolean(process.stdout.isTTY && process.stderr.isTTY);
}

/**
 * Main uninstall command entry point
 */
export async function uninstall(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS, { strict: false });

  if (parsed.help) {
    showStandardHelp(HELP_CONFIG);
    process.exit(0);
  }

  const flags: UninstallFlags = {
    dryRun: Boolean(parsed.flags["dry-run"]),
    nonInteractive:
      Boolean(parsed.flags["non-interactive"]) ||
      Boolean(parsed.flags["y"]) ||
      process.env["CI"] === "true" ||
      !isTTY(),
    convertExports: Boolean(parsed.flags["convert-exports"]),
    deleteExports: Boolean(parsed.flags["delete-exports"]),
    keepExports: Boolean(parsed.flags["keep-exports"]),
    deleteSource: Boolean(parsed.flags["delete-source"]),
    keepSource: Boolean(parsed.flags["keep-source"]),
  };

  const cwd = process.cwd();

  // Detect AlignTrue files synchronously (fast operation)
  const detection = detectAlignTrueFiles(cwd);

  if (!detection.isInstalled) {
    console.log("\nAlignTrue is not installed in this directory.");
    console.log("Nothing to uninstall.\n");
    process.exit(0);
  }

  // Show what was found
  showDetectionSummary(detection);

  // Determine export handling
  let exportHandling: ExportHandling;
  let sourceHandling: SourceHandling;

  if (flags.nonInteractive) {
    // Non-interactive mode: use flags or defaults
    exportHandling = resolveExportHandling(flags);
    sourceHandling = resolveSourceHandling(flags);
  } else {
    // Interactive mode: prompt user
    clack.intro("AlignTrue Uninstall");

    // Ask about exports
    const hasExports = detection.exportedFiles.length > 0;
    if (hasExports) {
      const exportChoice = await clack.select({
        message: "What would you like to do with exported agent files?",
        options: [
          {
            value: "convert",
            label: "Convert to editable (remove READ-ONLY markers)",
            hint: "Recommended - keeps content, removes AlignTrue markers",
          },
          {
            value: "delete",
            label: "Delete completely",
            hint: "Removes all exported files",
          },
          {
            value: "skip",
            label: "Skip (leave as-is)",
            hint: "Files remain with READ-ONLY markers",
          },
        ],
        initialValue: "convert",
      });

      if (clack.isCancel(exportChoice)) {
        clack.cancel("Uninstall cancelled");
        process.exit(0);
      }

      exportHandling = exportChoice as ExportHandling;
    } else {
      exportHandling = "skip";
    }

    // Ask about source
    const sourceChoice = await clack.select({
      message: "What would you like to do with source rules (.aligntrue/)?",
      options: [
        {
          value: "keep",
          label: "Keep (you can reference rules later)",
          hint: "Recommended - preserves your rules",
        },
        {
          value: "delete",
          label: "Delete (full removal)",
          hint: "Removes .aligntrue/ directory",
        },
      ],
      initialValue: "keep",
    });

    if (clack.isCancel(sourceChoice)) {
      clack.cancel("Uninstall cancelled");
      process.exit(0);
    }

    sourceHandling = sourceChoice as SourceHandling;
  }

  // Build options
  const options: UninstallOptions = {
    cwd,
    exportHandling,
    sourceHandling,
    ...(flags.dryRun ? { dryRun: true } : {}),
  };

  // Generate preview
  const preview = previewUninstall(detection, options);

  // Show preview
  showPreview(preview, flags.dryRun);

  // Confirm if interactive
  if (!flags.nonInteractive && !flags.dryRun) {
    const confirm = await clack.confirm({
      message: "Proceed with uninstall?",
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Uninstall cancelled");
      process.exit(0);
    }
  }

  // Execute uninstall
  if (flags.dryRun) {
    console.log("\n--dry-run: No changes made.\n");
    process.exit(0);
  }

  await withSpinner(
    "Uninstalling AlignTrue...",
    async () => {
      const result = await executeUninstall(detection, options);

      if (!result.success) {
        throw new Error(result.error || "Uninstall failed");
      }

      // Show results
      showResults(result, flags.nonInteractive);
    },
    undefined, // No success message from spinner - we show custom output
    (err) => {
      clack.log.error(`Uninstall failed: ${err.message}`);
      throw err;
    },
  );

  // Final message
  if (!flags.nonInteractive) {
    clack.outro("AlignTrue has been removed from this project");
  } else {
    console.log("\nAlignTrue has been removed from this project.\n");
  }
}

/**
 * Resolve export handling from flags (non-interactive mode)
 */
function resolveExportHandling(flags: UninstallFlags): ExportHandling {
  if (flags.convertExports) return "convert";
  if (flags.deleteExports) return "delete";
  if (flags.keepExports) return "skip";
  // Default for non-interactive: convert
  return "convert";
}

/**
 * Resolve source handling from flags (non-interactive mode)
 */
function resolveSourceHandling(flags: UninstallFlags): SourceHandling {
  if (flags.deleteSource) return "delete";
  if (flags.keepSource) return "keep";
  // Default for non-interactive: keep
  return "keep";
}

/**
 * Show summary of detected AlignTrue files
 */
function showDetectionSummary(detection: DetectionResult): void {
  console.log("\nAlignTrue installation detected:\n");

  // Count files with READ-ONLY markers
  const markedExports = detection.exportedFiles.filter(
    (f) => f.hasReadOnlyMarker,
  ).length;
  const totalExports = detection.exportedFiles.length;

  if (totalExports > 0) {
    console.log(
      `  Exported agent files: ${totalExports} (${markedExports} with READ-ONLY markers)`,
    );
  }

  if (detection.sourceFiles.length > 0) {
    console.log(`  Source rule files: ${detection.sourceFiles.length}`);
  }

  if (detection.configFiles.length > 0) {
    console.log(`  Config files: ${detection.configFiles.length}`);
  }

  if (detection.lockfile) {
    console.log(`  Lockfile: yes`);
  }

  if (detection.cacheDir) {
    const sizeMB = (detection.cacheDir.size / 1024 / 1024).toFixed(2);
    console.log(`  Cache: ${sizeMB} MB`);
  }

  if (detection.backupsDir) {
    const sizeMB = (detection.backupsDir.size / 1024 / 1024).toFixed(2);
    console.log(`  Backups: ${sizeMB} MB`);
  }

  if (detection.gitignoreEntries.length > 0) {
    console.log(`  Gitignore entries: ${detection.gitignoreEntries.length}`);
  }

  console.log("");
}

/**
 * Show preview of what will be changed
 */
function showPreview(preview: UninstallPreview, isDryRun: boolean): void {
  const prefix = isDryRun ? "Would " : "Will ";

  console.log(`\n${isDryRun ? "Dry run - " : ""}Preview:\n`);

  if (preview.toConvert.length > 0) {
    console.log(
      `  ${prefix}convert ${preview.toConvert.length} file(s) to editable`,
    );
    for (const file of preview.toConvert.slice(0, 5)) {
      console.log(`    - ${file}`);
    }
    if (preview.toConvert.length > 5) {
      console.log(`    ... and ${preview.toConvert.length - 5} more`);
    }
  }

  if (preview.toDelete.length > 0) {
    console.log(`  ${prefix}delete ${preview.toDelete.length} file(s)`);
    for (const file of preview.toDelete.slice(0, 5)) {
      console.log(`    - ${file}`);
    }
    if (preview.toDelete.length > 5) {
      console.log(`    ... and ${preview.toDelete.length - 5} more`);
    }
  }

  if (preview.toDeleteDirs.length > 0) {
    console.log(
      `  ${prefix}delete ${preview.toDeleteDirs.length} director(y/ies)`,
    );
    for (const dir of preview.toDeleteDirs) {
      console.log(`    - ${dir}/`);
    }
  }

  if (preview.toRemoveFromGitignore.length > 0) {
    console.log(
      `  ${prefix}remove ${preview.toRemoveFromGitignore.length} gitignore entr(y/ies)`,
    );
  }

  if (preview.toKeep.length > 0) {
    console.log(`  ${prefix}keep ${preview.toKeep.length} file(s)`);
  }

  console.log("");
}

/**
 * Show results of the uninstall operation
 */
function showResults(
  result: {
    convertedFiles: string[];
    deletedFiles: string[];
    deletedDirectories: string[];
    removedGitignoreEntries: string[];
    backupTimestamp: string;
    warnings: string[];
  },
  nonInteractive: boolean,
): void {
  const log = nonInteractive ? console.log : clack.log.info;

  if (result.backupTimestamp) {
    log(`Backup created: ${result.backupTimestamp}`);
    log(
      `Restore with: aligntrue backup restore --timestamp ${result.backupTimestamp}`,
    );
  }

  if (result.convertedFiles.length > 0) {
    log(`Converted ${result.convertedFiles.length} file(s) to editable`);
  }

  if (result.deletedFiles.length > 0) {
    log(`Deleted ${result.deletedFiles.length} file(s)`);
  }

  if (result.deletedDirectories.length > 0) {
    log(`Deleted ${result.deletedDirectories.length} director(y/ies)`);
  }

  if (result.removedGitignoreEntries.length > 0) {
    log(
      `Removed ${result.removedGitignoreEntries.length} gitignore entr(y/ies)`,
    );
  }

  if (result.warnings.length > 0) {
    for (const warning of result.warnings) {
      if (nonInteractive) {
        console.warn(`Warning: ${warning}`);
      } else {
        clack.log.warn(warning);
      }
    }
  }
}

// Export for command registration
export { uninstall as uninstallCommand };
