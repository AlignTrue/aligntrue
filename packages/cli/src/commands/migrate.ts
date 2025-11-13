/**
 * Migrate command - Move rules between scopes and storage types
 */

import * as clack from "@clack/prompts";
import {
  BackupManager,
  type AlignTrueConfig,
  type RulerConfig,
} from "@aligntrue/core";
import { recordEvent } from "@aligntrue/core";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import type { ParsedIR } from "../types/ir.js";
import { isValidIR } from "../types/ir.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Skip confirmation prompts",
  },
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview changes without applying",
  },
];

export async function migrate(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "migrate",
      description: "Move rules between scopes and storage types",
      usage: "aligntrue migrate <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue migrate personal",
        "aligntrue migrate team",
        "aligntrue promote <section>",
        "aligntrue demote <section>",
        "aligntrue local <section>",
      ],
      notes: [
        "Subcommands:",
        "  personal - Move all personal rules to remote storage",
        "  team - Move all team rules to remote storage",
        "  ruler - Migrate from Ruler to AlignTrue",
        "",
        "Direct commands:",
        "  promote <section> - Promote personal rule to team",
        "  demote <section> - Demote team rule to personal",
        "  local <section> - Make rule local-only",
      ],
    });
    return;
  }

  const subcommand = parsed.positional[0];
  const cwd = process.cwd();

  switch (subcommand) {
    case "personal":
      await migratePersonal(cwd, parsed.flags);
      break;
    case "team":
      await migrateTeam(cwd, parsed.flags);
      break;
    case "ruler":
      await migrateRuler(cwd, parsed.flags);
      break;
    default:
      clack.log.error(`Unknown subcommand: ${subcommand}`);
      clack.log.info("Run 'aligntrue migrate --help' for usage");
      process.exit(1);
  }
}

/**
 * Promote command - Promote personal rule to team
 */
export async function promote(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "promote",
      description: "Promote personal rule to team scope",
      usage: "aligntrue promote <section> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        'aligntrue promote "My Coding Preferences"',
        'aligntrue promote "Security" --yes',
      ],
      notes: [
        "This will:",
        "  • Change scope: personal → team",
        "  • Move to main repository",
        "  • Share with all team members",
        "  • Require team approval for future changes",
      ],
    });
    return;
  }

  const sectionHeading = parsed.positional[0]!;
  const cwd = process.cwd();
  const dryRun = parsed.flags["dry-run"] as boolean;
  const yes = parsed.flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro(`Promote "${sectionHeading}" to team rule`);
  } else {
    console.log(`Promote "${sectionHeading}" to team rule`);
  }

  // Create backup
  const spinner = isTTY() ? clack.spinner() : null;
  if (spinner) {
    spinner.start("Creating backup");
  } else {
    console.log("Creating backup...");
  }

  const backup = BackupManager.createBackup({
    cwd,
    created_by: "promote",
    action: `promote-${sectionHeading}`,
    notes: `Backup before promoting "${sectionHeading}" to team`,
  });

  if (spinner) {
    spinner.stop(
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  } else {
    console.log(`✓ Backup created: ${backup.timestamp}`);
    console.log(
      `  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  }

  // Confirm
  if (!yes && !dryRun) {
    if (!isTTY()) {
      console.error("\nError: Confirmation required in non-interactive mode");
      console.error("Use --yes to skip confirmation");
      process.exit(1);
    }

    const confirm = await clack.confirm({
      message: `This will share "${sectionHeading}" with all team members. Continue?`,
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Promotion cancelled");
      return;
    }
  }

  // Apply changes
  if (!dryRun) {
    if (spinner) {
      spinner.start("Promoting to team");
    } else {
      console.log("Promoting to team...");
    }
    // TODO: Implement actual promotion logic
    await promoteSection(sectionHeading, cwd);
    if (spinner) {
      spinner.stop("Promotion complete");
    } else {
      console.log("✓ Promotion complete");
    }
  } else {
    if (isTTY()) {
      clack.log.info("Dry run - no changes made");
    } else {
      console.log("Dry run - no changes made");
    }
  }

  if (isTTY()) {
    clack.outro(`✓ Promoted "${sectionHeading}" to team rule`);
  } else {
    console.log(`✓ Promoted "${sectionHeading}" to team rule`);
  }
  console.log("\n⚠ This will be shared with all team members");
  console.log("  Commit and push to share:");
  console.log("  git add .aligntrue/");
  console.log(`  git commit -m "feat: Promote ${sectionHeading} to team"`);
  console.log("  git push");

  recordEvent({ command_name: "promote", align_hashes_used: [] });
}

/**
 * Demote command - Demote team rule to personal
 */
export async function demote(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "demote",
      description: "Demote team rule to personal scope",
      usage: "aligntrue demote <section> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        'aligntrue demote "Testing Guidelines"',
        'aligntrue demote "Code Style" --yes',
      ],
      notes: [
        "This will:",
        "  • Change scope: team → personal",
        "  • Remove from main repository",
        "  • Keep as personal rule",
        "  • Won't affect other team members",
      ],
    });
    return;
  }

  const sectionHeading = parsed.positional[0]!;
  const cwd = process.cwd();
  const dryRun = parsed.flags["dry-run"] as boolean;
  const yes = parsed.flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro(`Demote "${sectionHeading}" to personal rule`);
  } else {
    console.log(`Demote "${sectionHeading}" to personal rule`);
  }

  // Create backup
  const spinner = isTTY() ? clack.spinner() : null;
  if (spinner) {
    spinner.start("Creating backup");
  } else {
    console.log("Creating backup...");
  }

  const backup = BackupManager.createBackup({
    cwd,
    created_by: "demote",
    action: `demote-${sectionHeading}`,
    notes: `Backup before demoting "${sectionHeading}" to personal`,
  });

  if (spinner) {
    spinner.stop(
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  } else {
    console.log(`✓ Backup created: ${backup.timestamp}`);
    console.log(
      `  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  }

  // Confirm
  if (!yes && !dryRun) {
    if (!isTTY()) {
      console.error("\nError: Confirmation required in non-interactive mode");
      console.error("Use --yes to skip confirmation");
      process.exit(1);
    }

    const confirm = await clack.confirm({
      message: `This will remove "${sectionHeading}" from team rules. Continue?`,
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Demotion cancelled");
      return;
    }
  }

  // Apply changes
  if (!dryRun) {
    if (spinner) {
      spinner.start("Demoting to personal");
    } else {
      console.log("Demoting to personal...");
    }
    // TODO: Implement actual demotion logic
    await demoteSection(sectionHeading, cwd);
    if (spinner) {
      spinner.stop("Demotion complete");
    } else {
      console.log("✓ Demotion complete");
    }
  } else {
    if (isTTY()) {
      clack.log.info("Dry run - no changes made");
    } else {
      console.log("Dry run - no changes made");
    }
  }

  if (isTTY()) {
    clack.outro(`✓ Demoted "${sectionHeading}" to personal rule`);
  } else {
    console.log(`✓ Demoted "${sectionHeading}" to personal rule`);
  }
  console.log("\nThis rule is now personal and won't affect team members.");

  recordEvent({ command_name: "demote", align_hashes_used: [] });
}

/**
 * Local command - Make rule local-only
 */
export async function local(args: string[]): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help || parsed.positional.length === 0) {
    showStandardHelp({
      name: "local",
      description: "Make rule local-only (never synced)",
      usage: "aligntrue local <section> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        'aligntrue local "Sensitive Preferences"',
        'aligntrue local "API Keys" --yes',
      ],
      notes: [
        "This will:",
        "  • Change storage: repo/remote → local",
        "  • Move to .aligntrue/.local/",
        "  • Never leave this machine",
        "  • Not backed up to any remote",
      ],
    });
    return;
  }

  const sectionHeading = parsed.positional[0]!;
  const cwd = process.cwd();
  const dryRun = parsed.flags["dry-run"] as boolean;
  const yes = parsed.flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro(`Make "${sectionHeading}" local-only`);
  } else {
    console.log(`Make "${sectionHeading}" local-only`);
  }

  // Create backup
  const spinner = isTTY() ? clack.spinner() : null;
  if (spinner) {
    spinner.start("Creating backup");
  } else {
    console.log("Creating backup...");
  }

  const backup = BackupManager.createBackup({
    cwd,
    created_by: "local",
    action: `local-${sectionHeading}`,
    notes: `Backup before making "${sectionHeading}" local-only`,
  });

  if (spinner) {
    spinner.stop(
      `Backup created: ${backup.timestamp}\n  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  } else {
    console.log(`✓ Backup created: ${backup.timestamp}`);
    console.log(
      `  Restore with: aligntrue backup restore --to ${backup.timestamp}`,
    );
  }

  // Confirm
  if (!yes && !dryRun) {
    if (!isTTY()) {
      console.error("\nError: Confirmation required in non-interactive mode");
      console.error("Use --yes to skip confirmation");
      process.exit(1);
    }

    const confirm = await clack.confirm({
      message: `This will make "${sectionHeading}" local-only (not backed up). Continue?`,
      initialValue: false,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Operation cancelled");
      return;
    }
  }

  // Apply changes
  if (!dryRun) {
    if (spinner) {
      spinner.start("Making local-only");
    } else {
      console.log("Making local-only...");
    }
    // TODO: Implement actual local conversion logic
    await makeLocal(sectionHeading, cwd);
    if (spinner) {
      spinner.stop("Conversion complete");
    } else {
      console.log("✓ Conversion complete");
    }
  } else {
    if (isTTY()) {
      clack.log.info("Dry run - no changes made");
    } else {
      console.log("Dry run - no changes made");
    }
  }

  if (isTTY()) {
    clack.outro(`✓ Made "${sectionHeading}" local-only`);
  } else {
    console.log(`✓ Made "${sectionHeading}" local-only`);
  }
  console.log("\n⚠ This rule will never leave this machine");
  console.log("  Not backed up to any remote");
  console.log("  Lost if machine dies");

  recordEvent({ command_name: "local", align_hashes_used: [] });
}

/**
 * Migrate personal rules to remote storage
 */
async function migratePersonal(
  cwd: string,
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const dryRun = flags["dry-run"] as boolean;
  const yes = flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro("Migrate personal rules to remote storage");
  } else {
    console.log("Migrate personal rules to remote storage");
  }

  const { loadConfig } = await import("@aligntrue/core");
  const configPath = require("path").join(cwd, ".aligntrue", "config.yaml");
  const config = await loadConfig(configPath);

  // Check if personal storage is already remote
  const typedConfig = config as unknown as AlignTrueConfig;
  const storage = typedConfig.storage || typedConfig.resources?.rules?.storage;
  if (storage?.["personal"]?.type === "remote") {
    if (isTTY()) {
      clack.log.success("Personal rules are already using remote storage");
    } else {
      console.log("✓ Personal rules are already using remote storage");
    }
    return;
  }

  if (isTTY()) {
    clack.log.info(
      "This will move all personal rules to your personal remote repository.",
    );
  } else {
    console.log(
      "This will move all personal rules to your personal remote repository.",
    );
  }

  if (!yes && !dryRun) {
    if (!isTTY()) {
      console.error("\nError: Confirmation required in non-interactive mode");
      console.error("Use --yes to skip confirmation");
      process.exit(1);
    }

    const confirm = await clack.confirm({
      message: "Continue with migration?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled");
      return;
    }
  }

  if (dryRun) {
    if (isTTY()) {
      clack.log.info("[DRY RUN] Would update personal storage to remote");
    } else {
      console.log("[DRY RUN] Would update personal storage to remote");
    }
    return;
  }

  // Run remote setup wizard
  const { runRemoteSetupWizard } = await import("../wizards/remote-setup.js");
  const result = await runRemoteSetupWizard("personal", cwd);

  if (!result.success || result.skipped) {
    if (isTTY()) {
      clack.cancel("Migration cancelled or skipped");
    } else {
      console.log("Migration cancelled or skipped");
    }
    return;
  }

  if (isTTY()) {
    clack.outro("Personal rules migrated to remote storage");
  } else {
    console.log("✓ Personal rules migrated to remote storage");
  }

  recordEvent({ command_name: "migrate-personal", align_hashes_used: [] });
}

/**
 * Migrate team rules to remote storage
 */
async function migrateTeam(
  cwd: string,
  flags: Record<string, string | boolean | undefined>,
): Promise<void> {
  const dryRun = flags["dry-run"] as boolean;
  const yes = flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro("Migrate team rules to remote storage");
  } else {
    console.log("Migrate team rules to remote storage");
  }

  const { loadConfig } = await import("@aligntrue/core");
  const configPath = require("path").join(cwd, ".aligntrue", "config.yaml");
  const config = await loadConfig(configPath);

  // Check if team storage is already remote
  const typedConfig = config as unknown as AlignTrueConfig;
  const storage = typedConfig.storage || typedConfig.resources?.rules?.storage;
  if (storage?.["team"]?.type === "remote") {
    if (isTTY()) {
      clack.log.success("Team rules are already using remote storage");
    } else {
      console.log("✓ Team rules are already using remote storage");
    }
    return;
  }

  if (isTTY()) {
    clack.log.info(
      "This will move all team rules to a team remote repository.",
    );
  } else {
    console.log("This will move all team rules to a team remote repository.");
  }

  if (!yes && !dryRun) {
    if (!isTTY()) {
      console.error("\nError: Confirmation required in non-interactive mode");
      console.error("Use --yes to skip confirmation");
      process.exit(1);
    }

    const confirm = await clack.confirm({
      message: "Continue with migration?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled");
      return;
    }
  }

  if (dryRun) {
    if (isTTY()) {
      clack.log.info("[DRY RUN] Would update team storage to remote");
    } else {
      console.log("[DRY RUN] Would update team storage to remote");
    }
    return;
  }

  // Run remote setup wizard
  const { runRemoteSetupWizard } = await import("../wizards/remote-setup.js");
  const result = await runRemoteSetupWizard("team", cwd);

  if (!result.success || result.skipped) {
    if (isTTY()) {
      clack.cancel("Migration cancelled or skipped");
    } else {
      console.log("Migration cancelled or skipped");
    }
    return;
  }

  if (isTTY()) {
    clack.outro("Team rules migrated to remote storage");
  } else {
    console.log("✓ Team rules migrated to remote storage");
  }

  recordEvent({ command_name: "migrate-team", align_hashes_used: [] });
}

/**
 * Promote section to team
 */
async function promoteSection(
  sectionHeading: string,
  cwd: string,
): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = require("fs");
  const { join } = require("path");
  const yaml = require("yaml");
  const { loadConfig } = await import("@aligntrue/core");

  // Load config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  const config = await loadConfig(configPath);

  // Load IR
  const irPath = join(cwd, ".aligntrue", ".rules.yaml");
  if (!existsSync(irPath)) {
    throw new Error("IR file not found. Run 'aligntrue init' first.");
  }

  const irContent = readFileSync(irPath, "utf-8");
  const ir = yaml.parse(irContent) as ParsedIR;

  if (!isValidIR(ir)) {
    throw new Error("Invalid IR format");
  }

  // Find section
  const section = ir.sections.find(
    (s) => s.heading.toLowerCase() === sectionHeading.toLowerCase(),
  );

  if (!section) {
    throw new Error(`Section not found: ${sectionHeading}`);
  }

  // Update config to use resources structure for scopes/storage
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
  if (!typedConfig.resources.rules.scopes) {
    typedConfig.resources.rules.scopes = {};
  }
  if (!typedConfig.resources.rules.scopes["team"]) {
    typedConfig.resources.rules.scopes["team"] = { sections: [] };
  }
  if (Array.isArray(typedConfig.resources.rules.scopes["team"]?.sections)) {
    if (
      !typedConfig.resources.rules.scopes["team"]!.sections.includes(
        section.heading,
      )
    ) {
      typedConfig.resources.rules.scopes["team"]!.sections.push(
        section.heading,
      );
    }
  }

  if (!typedConfig.resources.rules.storage) {
    typedConfig.resources.rules.storage = {};
  }
  typedConfig.resources.rules.storage["team"] = { type: "repo" };

  // Remove from personal scope if present
  if (Array.isArray(typedConfig.resources.rules.scopes["personal"]?.sections)) {
    typedConfig.resources.rules.scopes["personal"]!.sections =
      typedConfig.resources.rules.scopes["personal"]!.sections.filter(
        (s: string) => s.toLowerCase() !== section.heading.toLowerCase(),
      );
  }

  // Write updated config
  const configContent = yaml.stringify(config);
  writeFileSync(configPath, configContent, "utf-8");

  console.log(`✓ Promoted "${section.heading}" to team scope`);
}

/**
 * Demote section to personal
 */
async function demoteSection(
  sectionHeading: string,
  cwd: string,
): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = require("fs");
  const { join } = require("path");
  const yaml = require("yaml");
  const { loadConfig } = await import("@aligntrue/core");

  // Load config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  const config = await loadConfig(configPath);

  // Load IR
  const irPath = join(cwd, ".aligntrue", ".rules.yaml");
  if (!existsSync(irPath)) {
    throw new Error("IR file not found. Run 'aligntrue init' first.");
  }

  const irContent = readFileSync(irPath, "utf-8");
  const ir = yaml.parse(irContent) as ParsedIR;

  if (!isValidIR(ir)) {
    throw new Error("Invalid IR format");
  }

  // Find section
  const section = ir.sections.find(
    (s) => s.heading.toLowerCase() === sectionHeading.toLowerCase(),
  );

  if (!section) {
    throw new Error(`Section not found: ${sectionHeading}`);
  }

  // Update config to use resources structure for scopes/storage
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
  if (!typedConfig.resources.rules.scopes) {
    typedConfig.resources.rules.scopes = {};
  }
  if (!typedConfig.resources.rules.scopes["personal"]) {
    typedConfig.resources.rules.scopes["personal"] = { sections: [] };
  }
  if (Array.isArray(typedConfig.resources.rules.scopes["personal"]?.sections)) {
    if (
      !typedConfig.resources.rules.scopes["personal"]!.sections.includes(
        section.heading,
      )
    ) {
      typedConfig.resources.rules.scopes["personal"]!.sections.push(
        section.heading,
      );
    }
  }

  // Set storage based on existing personal storage config
  if (!typedConfig.resources.rules.storage) {
    typedConfig.resources.rules.storage = {};
  }
  if (!typedConfig.resources.rules.storage["personal"]) {
    typedConfig.resources.rules.storage["personal"] = { type: "local" };
  }

  // Remove from team scope if present
  if (Array.isArray(typedConfig.resources.rules.scopes["team"]?.sections)) {
    typedConfig.resources.rules.scopes["team"]!.sections =
      typedConfig.resources.rules.scopes["team"]!.sections.filter(
        (s: string) => s.toLowerCase() !== section.heading.toLowerCase(),
      );
  }

  // Write updated config
  const configContent = yaml.stringify(config);
  writeFileSync(configPath, configContent, "utf-8");

  console.log(`✓ Demoted "${section.heading}" to personal scope`);
}

/**
 * Make section local-only
 */
async function makeLocal(sectionHeading: string, cwd: string): Promise<void> {
  const { readFileSync, writeFileSync, existsSync } = require("fs");
  const { join } = require("path");
  const yaml = require("yaml");
  const { loadConfig } = await import("@aligntrue/core");

  // Load config
  const configPath = join(cwd, ".aligntrue", "config.yaml");
  const config = await loadConfig(configPath);

  // Load IR
  const irPath = join(cwd, ".aligntrue", ".rules.yaml");
  if (!existsSync(irPath)) {
    throw new Error("IR file not found. Run 'aligntrue init' first.");
  }

  const irContent = readFileSync(irPath, "utf-8");
  const ir = yaml.parse(irContent) as ParsedIR;

  if (!isValidIR(ir)) {
    throw new Error("Invalid IR format");
  }

  // Find section
  const section = ir.sections.find(
    (s) => s.heading.toLowerCase() === sectionHeading.toLowerCase(),
  );

  if (!section) {
    throw new Error(`Section not found: ${sectionHeading}`);
  }

  // Update config to add section to personal scope with local storage
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
  if (!typedConfig.resources.rules.scopes) {
    typedConfig.resources.rules.scopes = {};
  }
  if (!typedConfig.resources.rules.scopes["personal"]) {
    typedConfig.resources.rules.scopes["personal"] = { sections: [] };
  }
  if (Array.isArray(typedConfig.resources.rules.scopes["personal"]?.sections)) {
    if (
      !typedConfig.resources.rules.scopes["personal"]!.sections.includes(
        section.heading,
      )
    ) {
      typedConfig.resources.rules.scopes["personal"]!.sections.push(
        section.heading,
      );
    }
  }

  if (!typedConfig.resources.rules.storage) {
    typedConfig.resources.rules.storage = {};
  }
  typedConfig.resources.rules.storage["personal"] = { type: "local" };

  // Write updated config
  const configContent = yaml.stringify(config);
  writeFileSync(configPath, configContent, "utf-8");

  console.log(`✓ Made "${section.heading}" local-only`);
}

/**
 * Migrate from Ruler to AlignTrue
 */
async function migrateRuler(
  cwd: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flags: Record<string, any>,
): Promise<void> {
  const { existsSync, writeFileSync, renameSync } = await import("fs");
  const { join } = await import("path");
  const { glob } = await import("glob");
  const {
    parseRulerToml,
    convertRulerConfig,
    mergeRulerMarkdownFiles,
    loadConfig,
    saveConfig,
  } = await import("@aligntrue/core");

  const dryRun = flags["dry-run"] || false;
  const yes = flags["yes"] || false;
  const interactive = !yes && isTTY();

  const rulerDir = join(cwd, ".ruler");

  if (!existsSync(rulerDir)) {
    clack.log.error("No .ruler directory found. Is this a Ruler project?");
    clack.log.info(
      "The .ruler/ directory should contain your Ruler configuration.",
    );
    process.exit(1);
  }

  clack.intro("Migrating from Ruler to AlignTrue");

  // 1. Parse ruler.toml
  const rulerTomlPath = join(rulerDir, "ruler.toml");
  let rulerConfig: RulerConfig | undefined;
  if (existsSync(rulerTomlPath)) {
    try {
      rulerConfig = parseRulerToml(rulerTomlPath);
      clack.log.success("Found ruler.toml");
    } catch (error) {
      clack.log.warn(
        `Failed to parse ruler.toml: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // 2. Find all markdown files
  const mdFiles = glob.sync("**/*.md", {
    cwd: rulerDir,
    ignore: ["node_modules/**"],
  });
  clack.log.info(
    `Found ${mdFiles.length} markdown file${mdFiles.length !== 1 ? "s" : ""} in .ruler/`,
  );

  // 3. Show preview
  if (interactive) {
    const preview = mdFiles
      .slice(0, 5)
      .map((f: string) => `  - ${f}`)
      .join("\n");
    clack.log.info(
      `Files to merge:\n${preview}${mdFiles.length > 5 ? "\n  ..." : ""}`,
    );

    const confirm = await clack.confirm({
      message: "Merge all .ruler/*.md files into AGENTS.md?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled");
      process.exit(0);
    }
  }

  if (dryRun) {
    clack.log.info("Dry run - no changes made");
    clack.outro("Migration preview complete");
    return;
  }

  // 4. Merge markdown files
  const merged = await mergeRulerMarkdownFiles(rulerDir);
  const agentsMdPath = join(cwd, "AGENTS.md");

  // Check if AGENTS.md already exists
  if (existsSync(agentsMdPath)) {
    if (interactive) {
      const overwrite = await clack.confirm({
        message: "AGENTS.md already exists. Overwrite?",
        initialValue: false,
      });

      if (clack.isCancel(overwrite) || !overwrite) {
        clack.cancel("Migration cancelled");
        process.exit(0);
      }
    }
  }

  writeFileSync(agentsMdPath, merged, "utf-8");
  clack.log.success("Created AGENTS.md from .ruler/*.md files");

  // 5. Convert config
  if (rulerConfig) {
    const aligntrueConfig = convertRulerConfig(rulerConfig);
    const configPath = join(cwd, ".aligntrue", "config.yaml");

    // Merge with existing or create new
    let finalConfig: AlignTrueConfig;
    if (existsSync(configPath)) {
      try {
        const existingConfig = await loadConfig(configPath);
        finalConfig = { ...existingConfig, ...aligntrueConfig };
      } catch {
        // Ignore errors, will create new config
        finalConfig = aligntrueConfig as AlignTrueConfig;
      }
    } else {
      finalConfig = aligntrueConfig as AlignTrueConfig;
    }

    await saveConfig(finalConfig, configPath);
    clack.log.success("Converted ruler.toml → .aligntrue/config.yaml");
  }

  // 6. Prompt about .ruler directory
  if (interactive) {
    const keepRuler = await clack.confirm({
      message: "Keep .ruler/ directory for reference?",
      initialValue: true,
    });

    if (!clack.isCancel(keepRuler) && !keepRuler) {
      // Move to .ruler.backup
      const backupPath = join(cwd, ".ruler.backup");
      renameSync(rulerDir, backupPath);
      clack.log.info(`Moved .ruler/ → .ruler.backup/`);
    }
  }

  // Record telemetry
  recordEvent({
    command_name: "migrate-ruler",
    align_hashes_used: [],
  });

  clack.outro(
    'Migration complete! Run "aligntrue sync" to generate agent files.',
  );
}
