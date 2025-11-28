/**
 * Team migration wizard
 * Guides users through solo → team mode conversion
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { stringify as stringifyYaml } from "yaml";
import * as clack from "@clack/prompts";
import { BackupManager, type AlignTrueConfig } from "@aligntrue/core";
import type { ParsedIR } from "../types/ir.js";
import { isValidIR } from "../types/ir.js";
import { createManagedSpinner, stopSpinnerSilently } from "../utils/spinner.js";

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
  const spinner = createManagedSpinner();
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
    // Feature in development
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

      if (!isMigrationAction(action)) {
        throw new Error("Unsupported migration action selected");
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
            // Remote setup wizard in development
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
        actions.push({ section: section.heading, action });
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
    // Migration logic in development
    spinner.start("Applying changes");
    await applyMigrationActions(actions, config, cwd);
    // Stop silently without rendering an empty step, outro follows
    stopSpinnerSilently(spinner);

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
    spinner.stop("Backup failed", 1);
    throw error;
  }
}

/**
 * Detect personal rules currently in repo
 */
function detectPersonalRulesInRepo(
  config: AlignTrueConfig,
  cwd: string,
): Array<{ heading: string; scope: string; storage: string }> {
  const results: Array<{ heading: string; scope: string; storage: string }> =
    [];
  const irPath = join(cwd, ".aligntrue", "rules");

  try {
    // Check rules directory - load all markdown files
    const { loadRulesDirectory } = require("@aligntrue/core");
    const rules = loadRulesDirectory(irPath, cwd, { recursive: true });

    // Convert to sections format
    const sections = rules.map(
      (rule: {
        frontmatter: { title?: string; scope?: string };
        filename: string;
        content: string;
        hash: string;
      }) => ({
        heading: rule.frontmatter.title || rule.filename.replace(/\.md$/, ""),
        content: rule.content,
        scope: rule.frontmatter.scope,
      }),
    );

    if (!sections || sections.length === 0) {
      return results;
    }

    const ir = { sections };

    // Check config for scope definitions
    const typedConfig = config as unknown as AlignTrueConfig;
    const scopes =
      typedConfig.resources?.rules?.scopes || (config.scopes ? {} : undefined);
    const storage = typedConfig.resources?.rules?.storage || config.storage;

    if (!scopes || !storage) {
      return results;
    }

    // Find sections that are personal scope with repo storage
    for (const section of ir.sections) {
      // Check if section matches personal scope
      const personalConfig = scopes["personal"];
      if (!personalConfig) continue;

      const matchesPersonal =
        personalConfig.sections === "*" ||
        (Array.isArray(personalConfig.sections) &&
          personalConfig.sections.some(
            (s: string) => s.toLowerCase() === section.heading.toLowerCase(),
          ));

      if (matchesPersonal) {
        const personalStorage = storage["personal"];
        if (personalStorage && personalStorage.type === "repo") {
          results.push({
            heading: section.heading,
            scope: "personal",
            storage: "repo",
          });
        }
      }
    }

    return results;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
      console.warn("Failed to detect personal rules:", err);
    }
    return results;
  }
}

function isMigrationAction(
  value: unknown,
): value is "promote" | "move" | "local" {
  return value === "promote" || value === "move" || value === "local";
}

/**
 * Apply migration actions
 */
async function applyMigrationActions(
  actions: MigrationResult["actions"],
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
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        "Rules directory (.aligntrue/rules/) not found. Please run 'aligntrue init' first.",
      );
    }
    throw error;
  }

  if (!isValidIR(ir)) {
    throw new Error("Invalid IR format");
  }

  // Apply each action
  for (const action of actions) {
    const section = ir.sections.find(
      (s) => s.heading.toLowerCase() === action.section.toLowerCase(),
    );

    if (!section) {
      console.warn(`Section not found: ${action.section}`);
      continue;
    }

    // Use resources structure for scopes/storage
    const typedConfig = config as unknown as AlignTrueConfig;
    if (!typedConfig.resources) {
      typedConfig.resources = {
        rules: { scopes: {}, storage: {} },
        mcps: { scopes: {}, storage: {} },
        skills: { scopes: {}, storage: {} },
      };
    }
    if (!typedConfig.resources.rules) {
      typedConfig.resources.rules = { scopes: {}, storage: {} };
    }

    switch (action.action) {
      case "promote":
        // Change to team scope, keep in repo
        if (!typedConfig.resources.rules.scopes)
          typedConfig.resources.rules.scopes = {};
        if (!typedConfig.resources.rules.scopes["team"]) {
          typedConfig.resources.rules.scopes["team"] = { sections: [] };
        }
        if (
          Array.isArray(typedConfig.resources.rules.scopes["team"]?.sections)
        ) {
          typedConfig.resources.rules.scopes["team"]!.sections.push(
            action.section,
          );
        }
        if (!typedConfig.resources.rules.storage)
          typedConfig.resources.rules.storage = {};
        typedConfig.resources.rules.storage["team"] = { type: "repo" };
        break;

      case "move":
        // Change to personal scope with remote storage
        if (!typedConfig.resources.rules.scopes)
          typedConfig.resources.rules.scopes = {};
        if (!typedConfig.resources.rules.scopes["personal"]) {
          typedConfig.resources.rules.scopes["personal"] = { sections: [] };
        }
        if (
          Array.isArray(
            typedConfig.resources.rules.scopes["personal"]?.sections,
          )
        ) {
          typedConfig.resources.rules.scopes["personal"]!.sections.push(
            action.section,
          );
        }
        // Remote URL should already be configured from wizard
        break;

      case "local":
        // Change to personal scope with local storage
        if (!typedConfig.resources.rules.scopes)
          typedConfig.resources.rules.scopes = {};
        if (!typedConfig.resources.rules.scopes["personal"]) {
          typedConfig.resources.rules.scopes["personal"] = { sections: [] };
        }
        if (
          Array.isArray(
            typedConfig.resources.rules.scopes["personal"]?.sections,
          )
        ) {
          typedConfig.resources.rules.scopes["personal"]!.sections.push(
            action.section,
          );
        }
        if (!typedConfig.resources.rules.storage)
          typedConfig.resources.rules.storage = {};
        typedConfig.resources.rules.storage["personal"] = { type: "local" };
        break;
    }
  }

  // Write updated IR
  const updatedIr = stringifyYaml(ir);
  writeFileSync(irPath, updatedIr, "utf-8");

  // Write updated config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  const configContent = stringifyYaml(config);
  writeFileSync(configPath, configContent, "utf-8");
}
