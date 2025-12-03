/**
 * Team migration wizard
 * Guides users through solo → team mode conversion
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { stringify as stringifyYaml } from "yaml";
import * as clack from "@clack/prompts";
import { BackupManager, type AlignTrueConfig } from "@aligntrue/core";

export interface MigrationResult {
  success: boolean;
  backup?: {
    timestamp: string;
    path: string;
  };
}

/**
 * Run team migration wizard
 */
export async function runTeamMigrationWizard(
  config: AlignTrueConfig,
  cwd: string = process.cwd(),
): Promise<MigrationResult> {
  clack.intro("Converting to Team Mode");

  // Step 1: Create backup
  const spinner = clack.spinner();
  spinner.start("Creating backup");

  try {
    const backup = BackupManager.createBackup({
      cwd,
      created_by: "team-enable",
      action: "team-enable-migration",
      mode: config.mode,
      notes: "Backup before converting to team mode",
    });

    spinner.stop(
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --timestamp ${backup.timestamp}`,
    );

    // Step 2: Confirm mode change
    const confirm = await clack.confirm({
      message:
        "Enable team mode? This enables lockfile generation for reproducibility.",
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
      mode: "team",
      modules: {
        ...config.modules,
        lockfile: true,
      },
    };

    const configPath = join(cwd, ".aligntrue", "config.yaml");
    const configContent = stringifyYaml(updatedConfig);
    writeFileSync(configPath, configContent, "utf-8");

    spinner.stop("Configuration updated");

    // Step 4: Show summary
    clack.outro(
      "Team mode enabled!\n" +
        "  • Lockfile will track rule changes\n" +
        "  • Use `scope: personal` in frontmatter to bypass lockfile for personal rules\n" +
        "  • Run 'aligntrue sync' to generate team files",
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
