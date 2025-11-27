/**
 * Solo migration wizard
 * Guides users through team → solo mode conversion
 */

import * as clack from "@clack/prompts";
import { writeFileSync } from "fs";
import { join } from "path";
import * as yaml from "yaml";
import { BackupManager, type AlignTrueConfig } from "@aligntrue/core";
import type { ParsedIR } from "../types/ir.js";
import { isValidIR } from "../types/ir.js";
import { createSpinner, stopSpinnerSilently } from "../utils/spinner.js";

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
  const spinner = createSpinner();
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
      return { success: false, teamSectionsAction: "keep" };
    }

    if (!isSoloMigrationAction(teamAction)) {
      throw new Error("Unexpected solo migration action");
    }

    // Step 4: Confirm
    const confirm = await clack.confirm({
      message: "Apply changes and disable team mode?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled. No changes made.");
      return { success: false, teamSectionsAction: teamAction };
    }

    // Step 5: Apply changes
    spinner.start("Applying changes");
    await applySoloMigration(teamAction, config, cwd);
    // Stop silently without rendering an empty step, outro follows
    stopSpinnerSilently(spinner);

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
      teamSectionsAction: teamAction,
    };
  } catch (error) {
    spinner.stop("Migration failed", 1);
    throw error;
  }
}

/**
 * Get team sections from config
 */
function getTeamSections(config: AlignTrueConfig): string[] {
  const typedConfig = config as unknown as AlignTrueConfig;
  const scopes =
    typedConfig.resources?.rules?.scopes || (config.scopes ? {} : undefined);
  if (!scopes || !scopes["team"]) {
    return [];
  }

  const teamConfig = scopes["team"];
  if (teamConfig.sections === "*") {
    return ["*"];
  }

  if (Array.isArray(teamConfig.sections)) {
    return teamConfig.sections;
  }

  return [];
}

/**
 * Get personal remote URL from config
 */
function getPersonalRemote(config: AlignTrueConfig): string | null {
  const typedConfig = config as unknown as AlignTrueConfig;
  const storage = typedConfig.resources?.rules?.storage || config.storage;
  if (!storage || !storage["personal"]) {
    return null;
  }

  const personalStorage = storage["personal"];
  if (personalStorage.type === "remote" && personalStorage.url) {
    return personalStorage.url;
  }

  return null;
}

/**
 * Apply solo migration
 */
async function applySoloMigration(
  action: "keep" | "delete" | "separate",
  config: AlignTrueConfig,
  cwd: string,
): Promise<void> {
  // Load IR from rules directory
  const irPath = join(cwd, ".aligntrue", "rules");
  let ir: ParsedIR;
  try {
    const { loadRulesDirectory } = require("@aligntrue/core");
    const rules = loadRulesDirectory(irPath, cwd, { recursive: true });

    // Convert to ParsedIR format
    ir = {
      version: "1",
      sections: rules.map(
        (rule: {
          frontmatter: { title?: string; scope?: string };
          filename: string;
          content: string;
          hash: string;
        }) => ({
          heading: rule.frontmatter.title || rule.filename.replace(/\.md$/, ""),
          content: rule.content,
          scope: rule.frontmatter.scope,
          fingerprint: rule.hash.slice(0, 16),
        }),
      ),
    } as ParsedIR;
  } catch (error: unknown) {
    const isError = error instanceof Error;
    if (isError && "code" in error && error.code === "ENOENT") {
      // If rules directory doesn't exist, we can still proceed with config changes
      // but we should initialize an empty IR structure.
      ir = { version: "1", sections: [] };
    } else {
      throw error;
    }
  }
  if (!isValidIR(ir)) {
    throw new Error("Invalid IR format");
  }

  const teamSections = getTeamSections(config);

  switch (action) {
    case "keep":
      // Convert team sections to personal, keep in main repo
      config.mode = "solo";
      delete config.scopes;
      delete config.storage;
      delete config.resources;
      break;

    case "delete":
      // Remove team sections from IR
      if (teamSections.includes("*")) {
        // Remove all sections
        ir.sections = [];
      } else {
        // Remove specific sections
        ir.sections = ir.sections.filter(
          (s) =>
            !teamSections.some(
              (t) => t.toLowerCase() === s.heading.toLowerCase(),
            ),
        );
      }
      config.mode = "solo";
      delete config.scopes;
      delete config.storage;
      delete config.resources;
      break;

    case "separate":
      // Keep team sections in remote, personal in main repo
      // This requires setting up custom scopes
      const typedConfig = config as unknown as AlignTrueConfig;
      typedConfig.mode = "solo";
      // Note: scopes is array-based in new config, not object-based
      // For now, just clear resources to reset to solo defaults
      delete typedConfig.resources;
      if (!typedConfig.storage) {
        typedConfig.storage = {};
      }
      typedConfig.storage["personal"] = {
        type: "remote",
        url: getPersonalRemote(config) || "",
      };
      typedConfig.storage["team"] = { type: "repo" };
      break;
  }

  // Write updated IR
  const updatedIr = yaml.stringify(ir);
  writeFileSync(irPath, updatedIr, "utf-8");

  // Write updated config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  const configContent = yaml.stringify(config);
  writeFileSync(configPath, configContent, "utf-8");
}

function isSoloMigrationAction(
  value: unknown,
): value is "keep" | "delete" | "separate" {
  return value === "keep" || value === "delete" || value === "separate";
}
