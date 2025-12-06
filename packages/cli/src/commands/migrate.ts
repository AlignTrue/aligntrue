/**
 * Migrate command - Migrate from other tools or upgrade config formats
 */

import * as clack from "@clack/prompts";
import {
  type AlignTrueConfig,
  type RulerConfig,
  getAlignTruePaths,
  isLegacyTeamConfig,
} from "@aligntrue/core";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  exitWithError,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { addToGitignore } from "../utils/gitignore-helpers.js";

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

  if (parsed.help) {
    showStandardHelp({
      name: "migrate",
      description: "Migrate from other tools or upgrade config formats",
      usage: "aligntrue migrate <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue migrate config",
        "aligntrue migrate config --dry-run",
        "aligntrue migrate ruler",
      ],
      notes: [
        "Subcommands:",
        "  config - Split legacy team config into personal/team files",
        "  ruler  - Migrate from Ruler to AlignTrue",
        "",
        "The 'config' migration is needed if you have mode: team in config.yaml",
        "from before the two-file config system was introduced.",
      ],
    });
    return;
  }

  if (parsed.positional.length === 0) {
    showStandardHelp({
      name: "migrate",
      description: "Migrate from other tools or upgrade config formats",
      usage: "aligntrue migrate <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue migrate config",
        "aligntrue migrate config --dry-run",
        "aligntrue migrate ruler",
      ],
      notes: [
        "Subcommands:",
        "  config - Split legacy team config into personal/team files",
        "  ruler  - Migrate from Ruler to AlignTrue",
        "",
        "The 'config' migration is needed if you have mode: team in config.yaml",
        "from before the two-file config system was introduced.",
      ],
    });
    exitWithError(2, "Missing subcommand for migrate", {
      hint: "Use one of: config, ruler",
      code: "MISSING_MIGRATE_SUBCOMMAND",
    });
  }

  const subcommand = parsed.positional[0];
  const cwd = process.cwd();

  switch (subcommand) {
    case "config":
      await migrateConfig(cwd, parsed.flags);
      break;
    case "ruler":
      await migrateRuler(cwd, parsed.flags);
      break;
    default:
      clack.log.error(`Unknown subcommand: ${subcommand}`);
      clack.log.info("Run 'aligntrue migrate --help' for usage");
      exitWithError(1, `Unknown subcommand: ${subcommand}`, {
        hint: "Run 'aligntrue migrate --help' for usage",
      });
  }
}

/**
 * Migrate legacy team config to two-file config system
 *
 * Splits config.yaml into:
 * - config.yaml (personal, gitignored)
 * - config.team.yaml (team, committed)
 */
async function migrateConfig(
  cwd: string,
  flags: MigrationFlags,
): Promise<void> {
  const { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } =
    await import("fs");
  const { dirname } = await import("path");
  const { parse: parseYaml, stringify: stringifyYaml } = await import("yaml");

  const dryRun = flags["dry-run"] || false;
  const yes = flags["yes"] || false;
  const interactive = !yes && isTTY();

  const paths = getAlignTruePaths(cwd);

  // Check if legacy team config exists
  if (!isLegacyTeamConfig(cwd)) {
    if (existsSync(paths.teamConfig)) {
      clack.log.info(
        "No migration needed. Already using two-file config system.",
      );
      clack.log.info(`  Team config: ${paths.teamConfig}`);
      clack.log.info(`  Personal config: ${paths.config}`);
    } else {
      clack.log.info("No migration needed. Not in team mode.");
      clack.log.info("Run 'aligntrue team enable' to enable team mode.");
    }
    return;
  }

  clack.intro("Migrating to two-file config system");

  // Load existing config
  const configContent = readFileSync(paths.config, "utf-8");
  const config = parseYaml(configContent) as Record<string, unknown>;

  // Separate team-only fields from personal/shared fields
  const teamOnlyFields = ["mode", "modules", "lockfile"];
  const teamConfig: Record<string, unknown> = {};
  const personalConfig: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (teamOnlyFields.includes(key)) {
      teamConfig[key] = value;
    } else if (key === "sources" || key === "exporters") {
      // These move to team config by default
      teamConfig[key] = value;
    } else if (key === "remotes") {
      // Split remotes: personal goes to personal config, shared goes to team
      const remotes = value as Record<string, unknown>;
      if (remotes["personal"]) {
        personalConfig["remotes"] = { personal: remotes["personal"] };
      }
      if (remotes["shared"] || remotes["custom"]) {
        const teamRemotes: Record<string, unknown> = {};
        if (remotes["shared"]) {
          teamRemotes["shared"] = remotes["shared"];
        }
        if (remotes["custom"]) {
          teamRemotes["custom"] = remotes["custom"];
        }
        teamConfig["remotes"] = teamRemotes;
      }
    } else {
      // Other fields go to personal config (can override team)
      personalConfig[key] = value;
    }
  }

  // Show what will happen
  clack.log.info("Migration plan:");
  clack.log.info(`\n  Team config (${paths.teamConfig}):`);
  clack.log.info(`    - mode: ${teamConfig["mode"]}`);
  clack.log.info(`    - modules: ${JSON.stringify(teamConfig["modules"])}`);
  if (teamConfig["sources"]) {
    const sources = teamConfig["sources"] as unknown[];
    clack.log.info(`    - sources: ${sources.length} source(s)`);
  }
  if (teamConfig["exporters"]) {
    const exporters = teamConfig["exporters"] as unknown[];
    clack.log.info(
      `    - exporters: ${Array.isArray(exporters) ? exporters.length : Object.keys(exporters).length} exporter(s)`,
    );
  }

  clack.log.info(`\n  Personal config (${paths.config}):`);
  const personalKeys = Object.keys(personalConfig);
  if (personalKeys.length === 0) {
    clack.log.info("    (empty - ready for your personal settings)");
  } else {
    personalKeys.forEach((key) => {
      clack.log.info(`    - ${key}`);
    });
  }

  clack.log.info("\n  Additional changes:");
  clack.log.info("    - Add config.yaml to .gitignore");

  // Confirm
  if (interactive) {
    const confirm = await clack.confirm({
      message: "Apply this migration?",
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Migration cancelled");
      return;
    }
  }

  if (dryRun) {
    clack.log.info("Dry run - no changes made");
    clack.outro("Migration preview complete");
    return;
  }

  // Create backup
  const { BackupManager } = await import("@aligntrue/core");
  const backup = BackupManager.createBackup({
    cwd,
    created_by: "migrate-config",
    notes: "Before two-file config migration",
    action: "migrate-config",
    mode: "team",
  });
  clack.log.success(`Backup created: ${backup.timestamp}`);

  // Write team config
  const teamYaml = stringifyYaml(teamConfig);
  mkdirSync(dirname(paths.teamConfig), { recursive: true });
  writeFileSync(paths.teamConfig, teamYaml, "utf-8");
  clack.log.success(`Created ${paths.teamConfig}`);

  // Write personal config (or keep minimal if empty)
  if (Object.keys(personalConfig).length === 0) {
    personalConfig["version"] = config["version"] || "1";
  }
  const personalYaml = stringifyYaml(personalConfig);
  const tempPath = `${paths.config}.tmp`;
  writeFileSync(tempPath, personalYaml, "utf-8");
  renameSync(tempPath, paths.config);
  clack.log.success(`Updated ${paths.config}`);

  // Add config.yaml to .gitignore
  await addToGitignore("config.yaml", "AlignTrue personal config", cwd);
  clack.log.success("Added config.yaml to .gitignore");

  // Outro
  const outroLines = [
    "Migration complete!",
    "",
    `Team config: ${paths.teamConfig} (commit this)`,
    `Personal config: ${paths.config} (gitignored)`,
    "",
    "Your team members should run 'aligntrue sync' after pulling.",
    `Backup available: aligntrue backup restore --timestamp ${backup.timestamp}`,
  ];

  clack.outro(outroLines.join("\n"));
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
    exitWithError(1, "No .ruler directory found. Is this a Ruler project?", {
      hint: "Ensure .ruler/ exists and contains your Ruler configuration",
    });
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
