/**
 * Solo migration wizard
 * Guides users through team → solo mode conversion
 */

import * as clack from "@clack/prompts";
import { writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import { BackupManager, type AlignTrueConfig } from "@aligntrue/core";

export interface SoloMigrationResult {
  success: boolean;
  backup?: {
    timestamp: string;
    path: string;
  };
}

/**
 * Run solo migration wizard
 */
export async function runSoloMigrationWizard(
  config: AlignTrueConfig,
  cwd: string = process.cwd(),
): Promise<SoloMigrationResult> {
  clack.intro("Disabling Team Mode");

  // Step 1: Create backup
  const spinner = clack.spinner();
  spinner.start("Creating backup");

  try {
    const backup = BackupManager.createBackup({
      cwd,
      created_by: "team-disable",
      action: "team-disable",
      mode: config.mode,
      notes: "Backup before converting to solo mode",
    });

    spinner.stop(
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --timestamp ${backup.timestamp}`,
    );

    // Step 2: Confirm mode change
    const confirm = await clack.confirm({
      message: "Disable team mode? This will disable lockfile generation.",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled. No changes made.");
      return { success: false };
    }

    // Step 3: Update config
    spinner.start("Updating configuration");

    const updatedConfig: AlignTrueConfig = {
      ...config,
      mode: "solo",
      modules: {
        ...config.modules,
        lockfile: false,
      },
    };

    const configPath = join(cwd, ".aligntrue", "config.yaml");
    const configContent = yaml.stringify(updatedConfig);
    writeFileSync(configPath, configContent, "utf-8");

    spinner.stop("Configuration updated");

    // Step 4: Show summary
    clack.outro(
      "Solo mode enabled!\n" +
        "  • Lockfile generation disabled\n" +
        "  • Rules are no longer tracked for drift\n" +
        "  • Run 'aligntrue sync' to update exports",
    );

    return {
      success: true,
      backup: {
        timestamp: backup.timestamp,
        path: backup.path,
      },
    };
  } catch (error) {
    spinner.stop("Migration failed");
    throw error;
  }
}
