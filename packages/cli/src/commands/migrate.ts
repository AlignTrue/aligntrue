/**
 * Migrate command - Move rules between scopes and storage types
 */

import * as clack from "@clack/prompts";
import { join } from "path";
import { type AlignTrueConfig, type RulerConfig } from "@aligntrue/core";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { CommonErrors } from "../utils/common-errors.js";
import { exitWithError } from "../utils/error-formatter.js";

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

type MigrationFlags = Record<string, string | boolean | undefined>;

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
        "aligntrue migrate ruler",
      ],
      notes: [
        "Subcommands:",
        "  personal - Move all personal rules to remote storage",
        "  team - Move all team rules to remote storage",
        "  ruler - Migrate from Ruler to AlignTrue",
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
 * Migrate personal rules to remote storage
 */
async function migratePersonal(
  cwd: string,
  flags: MigrationFlags,
): Promise<void> {
  const dryRun = flags["dry-run"] as boolean;
  const yes = flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro("Migrate personal rules to remote storage");
  } else {
    console.log("Migrate personal rules to remote storage");
  }

  const { loadConfig } = await import("@aligntrue/core");
  const configPath = join(cwd, ".aligntrue", "config.yaml");
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
      exitWithError(CommonErrors.nonInteractiveConfirmation("--yes"), 1);
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
}

/**
 * Migrate team rules to remote storage
 */
async function migrateTeam(cwd: string, flags: MigrationFlags): Promise<void> {
  const dryRun = flags["dry-run"] as boolean;
  const yes = flags["yes"] as boolean;

  if (isTTY()) {
    clack.intro("Migrate team rules to remote storage");
  } else {
    console.log("Migrate team rules to remote storage");
  }

  const { loadConfig } = await import("@aligntrue/core");
  const configPath = join(cwd, ".aligntrue", "config.yaml");
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
      exitWithError(CommonErrors.nonInteractiveConfirmation("--yes"), 1);
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
}

/**
 * Migrate from Ruler to AlignTrue
 */
async function migrateRuler(cwd: string, flags: MigrationFlags): Promise<void> {
  const { renameSync, existsSync } = await import("fs");
  const { join } = await import("path");
  const {
    parseRulerToml,
    convertRulerConfig,
    copyRulerFilesToAlignTrue,
    copyAgentsMdIfNeeded,
    shouldIncludeAgentsMd,
    loadConfig,
    saveConfig,
    getAlignTruePaths,
  } = await import("@aligntrue/core");

  const dryRun = flags["dry-run"] || false;
  const yes = flags["yes"] || false;
  const interactive = !yes && isTTY();

  const rulerDir = join(cwd, ".ruler");
  const paths = getAlignTruePaths(cwd);
  const rulesDir = paths.rules;

  try {
    const { statSync } = await import("fs");
    if (!statSync(rulerDir).isDirectory()) {
      throw new Error(".ruler is not a directory");
    }
  } catch {
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
  try {
    rulerConfig = parseRulerToml(rulerTomlPath);
    clack.log.success("Found ruler.toml");
  } catch (error) {
    const isError = error instanceof Error;
    // Only warn if it's not a file-not-found error
    if (!(isError && "code" in error && error.code === "ENOENT")) {
      clack.log.warn(
        `Failed to parse ruler.toml: ${isError ? error.message : String(error)}`,
      );
    }
  }

  // 2. List markdown files that will be copied
  const { glob } = await import("glob");
  const mdFiles = glob.sync("**/*.md", {
    cwd: rulerDir,
    ignore: ["node_modules/**"],
  });

  clack.log.info(
    `Found ${mdFiles.length} markdown file${mdFiles.length !== 1 ? "s" : ""} in .ruler/`,
  );

  // 3. Show preview and confirm
  if (interactive) {
    const preview = mdFiles
      .slice(0, 5)
      .map((f: string) => `  - ${f}`)
      .join("\n");
    clack.log.info(
      `Files to copy to .aligntrue/rules/:\n${preview}${mdFiles.length > 5 ? "\n  ..." : ""}`,
    );

    const confirm = await clack.confirm({
      message: "Copy these files to .aligntrue/rules/?",
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

  // 4. Copy ruler files to .aligntrue/rules/
  const copiedFiles = await copyRulerFilesToAlignTrue(rulerDir, rulesDir);
  clack.log.success(
    `Copied ${copiedFiles.length} file${copiedFiles.length !== 1 ? "s" : ""} to .aligntrue/rules/`,
  );

  // 5. Check for AGENTS.md and ask user to include it if not generated by us
  if (shouldIncludeAgentsMd(cwd)) {
    if (interactive) {
      const includeAgents = await clack.confirm({
        message: "Include existing AGENTS.md in your rules?",
        initialValue: false,
      });

      if (includeAgents) {
        await copyAgentsMdIfNeeded(cwd, rulesDir);
        clack.log.success("Copied AGENTS.md to .aligntrue/rules/agents.md");
      }
    } else {
      // Non-interactive: skip by default (user can manually include)
      clack.log.info(
        "AGENTS.md found but not included (use --yes to skip this)",
      );
    }
  }

  // 6. Warn if .aligntrue/rules already had files
  if (existsSync(rulesDir)) {
    const { readdirSync } = await import("fs");
    const existingFiles = readdirSync(rulesDir).filter(
      (f) =>
        f.endsWith(".md") &&
        !copiedFiles.includes(f) &&
        f !== "agents.md" &&
        f !== "migrated-from-ruler.md",
    );
    if (existingFiles.length > 0) {
      clack.log.warn(
        `Note: .aligntrue/rules/ had existing files. Please review for duplicates.`,
      );
    }
  }

  // 7. Convert config
  if (rulerConfig) {
    const aligntrueConfig = convertRulerConfig(rulerConfig);
    const configPath = join(cwd, ".aligntrue", "config.yaml");

    // Merge with existing or create new
    let finalConfig: AlignTrueConfig;
    try {
      const existingConfig = await loadConfig(configPath);
      finalConfig = { ...existingConfig, ...aligntrueConfig };
    } catch {
      // Ignore errors (including not found), will create new config
      finalConfig = aligntrueConfig as AlignTrueConfig;
    }

    await saveConfig(finalConfig, configPath);
    clack.log.success("Converted ruler.toml → .aligntrue/config.yaml");
  }

  // 8. Prompt about .ruler directory
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

  clack.outro(
    'Migration complete! Run "aligntrue sync" to export your rules to configured agents.',
  );
}
