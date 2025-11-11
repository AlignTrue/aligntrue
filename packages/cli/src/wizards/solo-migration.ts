/**
 * Solo migration wizard
 * Guides users through team → solo mode conversion
 */

import * as clack from "@clack/prompts";
import { BackupManager } from "@aligntrue/core/backup/manager.js";
import type { AlignTrueConfig } from "@aligntrue/core";

export interface SoloMigrationResult {
  success: boolean;
  backup?: {
    timestamp: string;
    path: string;
  };
  teamSectionsAction: "keep" | "delete" | "separate";
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
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );

    // Step 2: Show current configuration
    const teamSections = getTeamSections(config);
    const personalRemote = getPersonalRemote(config);

    clack.log.info("Current team configuration:");
    if (teamSections.length > 0) {
      clack.log.info(
        `  • Team sections: ${teamSections.join(", ")} (${teamSections.length})`,
      );
    }
    if (personalRemote) {
      clack.log.info(`  • Personal remote: ${personalRemote}`);
    }
    console.log("");

    // Step 3: Ask what to do with team sections
    const teamAction = await clack.select({
      message: "What should happen to team sections?",
      options: [
        {
          value: "keep",
          label: "Keep as personal rules in main repo",
          hint: "All sections become scope: personal (recommended for solo projects)",
        },
        {
          value: "delete",
          label: "Delete team sections",
          hint: "Only keep personal rules",
        },
        {
          value: "separate",
          label: "Keep team sections separate",
          hint: "Team sections stay in team remote (advanced)",
        },
      ],
    });

    if (clack.isCancel(teamAction)) {
      clack.cancel("Migration cancelled");
      return { success: false };
    }

    // Step 4: Confirm
    const confirm = await clack.confirm({
      message: "Apply changes and disable team mode?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled. No changes made.");
      return { success: false };
    }

    // Step 5: Apply changes
    spinner.start("Applying changes");
    await applySoloMigration(teamAction as any, config, cwd);
    spinner.stop("Migration complete");

    // Step 6: Show summary
    clack.outro("Solo mode enabled!");
    console.log("\nYour project is now in solo mode.");
    if (teamAction === "keep") {
      console.log("All rules are now in main repository.");
    }

    return {
      success: true,
      backup: {
        timestamp: backup.timestamp,
        path: backup.path,
      },
      teamSectionsAction: teamAction as any,
    };
  } catch (error) {
    spinner.stop("Migration failed");
    throw error;
  }
}

/**
 * Get team sections from config
 * TODO: Implement actual logic
 */
function getTeamSections(config: AlignTrueConfig): string[] {
  // TODO: Parse from config.resources?.rules?.scopes?.team
  return [];
}

/**
 * Get personal remote URL from config
 * TODO: Implement actual logic
 */
function getPersonalRemote(config: AlignTrueConfig): string | null {
  // TODO: Parse from config.resources?.rules?.storage?.personal
  return null;
}

/**
 * Apply solo migration
 * TODO: Implement actual migration logic
 */
async function applySoloMigration(
  action: "keep" | "delete" | "separate",
  config: AlignTrueConfig,
  cwd: string,
): Promise<void> {
  // TODO: Implement
  // - keep: Convert team sections to personal, merge into main repo
  // - delete: Remove team sections from IR
  // - separate: Keep team sections in remote, personal in main repo
}
