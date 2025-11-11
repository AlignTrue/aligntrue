/**
 * Team migration wizard
 * Guides users through solo → team mode conversion
 */

import * as clack from "@clack/prompts";
import { BackupManager } from "@aligntrue/core/backup/manager.js";
import type { AlignTrueConfig } from "@aligntrue/core";

export interface MigrationResult {
  success: boolean;
  backup?: {
    timestamp: string;
    path: string;
  };
  actions: Array<{
    section: string;
    action: "promote" | "move" | "local";
    destination?: string;
  }>;
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
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );

    // Step 2: Detect personal rules in repo
    // TODO: Implement detection of personal rules
    const personalRulesInRepo = detectPersonalRulesInRepo(config, cwd);

    if (personalRulesInRepo.length === 0) {
      clack.outro("No personal rules found in repository. Team mode ready!");
      return {
        success: true,
        backup: {
          timestamp: backup.timestamp,
          path: backup.path,
        },
        actions: [],
      };
    }

    // Step 3: Show what was found
    clack.log.info(
      `Found ${personalRulesInRepo.length} personal rule${personalRulesInRepo.length !== 1 ? "s" : ""} currently in main repository.`,
    );
    clack.log.info("In team mode, personal rules cannot be in shared repo.\n");

    // Step 4: Process each section
    const actions: MigrationResult["actions"] = [];

    for (const section of personalRulesInRepo) {
      const action = await clack.select({
        message: `Section: "${section.heading}"\nWhat should we do with this section?`,
        options: [
          {
            value: "promote",
            label: "Promote to team rule",
            hint: "Becomes scope: team, shared with all team members",
          },
          {
            value: "move",
            label: "Move to personal remote (recommended)",
            hint: "Stays scope: personal, syncs across your machines",
          },
          {
            value: "local",
            label: "Keep local only",
            hint: "Stays scope: personal, never leaves this machine",
          },
        ],
      });

      if (clack.isCancel(action)) {
        clack.cancel("Migration cancelled");
        return { success: false, actions: [] };
      }

      let destination: string | undefined;

      if (action === "move") {
        // Prompt for personal repo URL
        const hasPersonalRepo = await clack.confirm({
          message: "Do you have a personal repository configured?",
          initialValue: false,
        });

        if (clack.isCancel(hasPersonalRepo)) {
          clack.cancel("Migration cancelled");
          return { success: false, actions: [] };
        }

        if (!hasPersonalRepo) {
          const setupNow = await clack.select({
            message: "Personal repository setup",
            options: [
              {
                value: "setup",
                label: "Set up now (guided)",
                hint: "We'll help you create and configure a personal repo",
              },
              {
                value: "later",
                label: "Set up later (stay local for now)",
                hint: "Personal rules will stay local until you configure remote",
              },
              {
                value: "skip",
                label: "Skip this section",
                hint: "Come back to it later",
              },
            ],
          });

          if (clack.isCancel(setupNow)) {
            clack.cancel("Migration cancelled");
            return { success: false, actions: [] };
          }

          if (setupNow === "setup") {
            // TODO: Launch remote setup wizard
            clack.log.info(
              "Remote setup wizard not yet implemented. Defaulting to local for now.",
            );
            actions.push({ section: section.heading, action: "local" });
          } else if (setupNow === "later") {
            actions.push({ section: section.heading, action: "local" });
          } else {
            // Skip this section
            continue;
          }
        } else {
          // Use existing personal repo
          destination = "personal-remote";
          actions.push({
            section: section.heading,
            action: "move",
            destination,
          });
        }
      } else {
        actions.push({ section: section.heading, action: action as any });
      }
    }

    // Step 5: Confirm and apply changes
    const confirm = await clack.confirm({
      message: `Apply ${actions.length} change${actions.length !== 1 ? "s" : ""}?`,
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled. No changes made.");
      return { success: false, actions: [] };
    }

    // Step 6: Apply changes
    // TODO: Implement actual migration logic
    spinner.start("Applying changes");
    await applyMigrationActions(actions, config, cwd);
    spinner.stop("Migration complete");

    // Step 7: Show summary
    clack.outro("Team mode enabled!");
    console.log("\nNext steps:");
    console.log("  1. Define team rules (edit .aligntrue/config.yaml)");
    console.log("  2. Run: aligntrue sync");
    console.log("  3. Commit team configuration");

    return {
      success: true,
      backup: {
        timestamp: backup.timestamp,
        path: backup.path,
      },
      actions,
    };
  } catch (error) {
    spinner.stop("Backup failed");
    throw error;
  }
}

/**
 * Detect personal rules currently in repo
 * TODO: Implement actual detection logic
 */
function detectPersonalRulesInRepo(
  config: AlignTrueConfig,
  cwd: string,
): Array<{ heading: string; scope: string; storage: string }> {
  // For now, return empty array
  // In real implementation, parse IR and check for personal + repo
  return [];
}

/**
 * Apply migration actions
 * TODO: Implement actual migration logic
 */
async function applyMigrationActions(
  actions: MigrationResult["actions"],
  config: AlignTrueConfig,
  cwd: string,
): Promise<void> {
  // TODO: Implement
  // For each action:
  // - promote: Change scope to team, keep in repo
  // - move: Change storage to remote, move to personal repo
  // - local: Change storage to local, move to .aligntrue/.local/
}
