/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname, relative } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import {
  getAlignTruePaths,
  type AlignTrueConfig,
  type AlignTrueMode,
  writeRuleFile,
  type RuleFile,
  computeRulePaths,
} from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import {
  parseCommonArgs,
  showStandardHelp,
  formatCreatedFiles,
  formatDiscoveredFiles,
  exitWithError,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { shouldUseInteractive } from "../utils/tty-helper.js";
import { createSpinner } from "../utils/spinner.js";
import { extractCatalogId, isCatalogId } from "../utils/catalog-resolver.js";

import {
  scanForExistingRulesWithOverlap,
  scanExistingAlignTrueRules,
} from "./init/rule-importer.js";
import { createStarterTemplates } from "./init/starter-templates.js";
import {
  detectRulerProject,
  promptRulerMigration,
} from "./init/ruler-detector.js";
import { addToGitignore } from "../utils/gitignore-helpers.js";
import { createEmptyLockfile } from "../utils/lockfile-helpers.js";
import { importFromCatalog } from "../utils/catalog-import.js";
import {
  COMMON_EXPORTERS,
  FORMAT_OPTIONS,
  detectFormats,
  inferAgentTypeFromPath,
  type FormatOption,
} from "./init/format-detection.js";
import { handleOverlapDetection } from "./init/overlap-handler.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--non-interactive",
    alias: "-n",
    hasValue: false,
    description: "Run without prompts (uses defaults)",
  },
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Same as --non-interactive",
  },
  {
    flag: "--no-sync",
    hasValue: false,
    description: "Skip automatic sync after initialization",
  },
  {
    flag: "--mode",
    hasValue: true,
    description: "Operating mode: solo (default) or team",
  },
  {
    flag: "--exporters",
    hasValue: true,
    description: "Comma-separated list of exporters (default: auto-detect)",
  },
  {
    flag: "--no-starters",
    hasValue: false,
    description: "Skip creating default starter rules when no rules are found",
  },
  {
    flag: "--ref",
    hasValue: true,
    description: "Git ref (branch/tag/commit) for git sources",
  },
];

/**
 * Output helper for dual interactive/non-interactive mode
 * Logs to console in non-interactive mode, uses clack in interactive mode
 */
function logMessage(
  message: string,
  type: "info" | "success" = "info",
  nonInteractive: boolean = false,
): void {
  if (nonInteractive) {
    console.log(message);
  } else {
    clack.log[type](message);
  }
}

function isEexistError(error: unknown): error is NodeJS.ErrnoException {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

function writeConfigFileSafely(
  targetPath: string,
  contents: string,
  options: { cwd: string; description: string },
): void {
  try {
    writeFileSync(targetPath, contents, { encoding: "utf-8", flag: "wx" });
  } catch (error) {
    if (isEexistError(error)) {
      const relPath = relative(options.cwd, targetPath);
      exitWithError(1, `${options.description} already exists at ${relPath}.`, {
        hint: "Remove or rename the existing file, then rerun: aligntrue init --yes",
      });
    }
    throw error;
  }
}

/**
 * Init command implementation
 */
export async function init(args: string[] = []): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "init",
      description: "Initialize AlignTrue in a project",
      usage: "aligntrue init [options] [url-or-id]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue init",
        "aligntrue init --yes",
        "aligntrue init https://github.com/org/rules",
        "aligntrue init abc123defgh",
        "aligntrue init --non-interactive --exporters cursor,agents",
      ],
      notes: [
        "- Without URL/ID: auto-detects existing rules and imports them",
        "- With URL/ID: imports from git or catalog (skips auto-detect)",
        "- To keep sources connected for updates, use 'aligntrue add link <url>'",
        "- Creates .aligntrue/rules/ directory as the single source of truth",
      ],
    });
    return;
  }

  // Extract flags
  const forceNonInteractive =
    (parsed.flags["non-interactive"] as boolean | undefined) ||
    (parsed.flags["yes"] as boolean | undefined) ||
    process.env["CI"] === "true" ||
    false;
  const useInteractive = shouldUseInteractive(forceNonInteractive);
  const nonInteractive = !useInteractive;

  const mode = parsed.flags["mode"] as AlignTrueMode | undefined;
  const exportersArg = parsed.flags["exporters"] as string | undefined;
  const exporters = exportersArg
    ? exportersArg.split(",").map((e) => e.trim())
    : undefined;
  const noSync = (parsed.flags["no-sync"] as boolean | undefined) || false;
  const positionalArg = parsed.positional[0];
  const sourceArg = positionalArg ? (positionalArg as string) : undefined;
  const refArg = parsed.flags["ref"] as string | undefined;
  const skipStarters =
    (parsed.flags["no-starters"] as boolean | undefined) || false;

  // Validate mode if provided
  if (mode && mode !== "solo" && mode !== "team") {
    console.error(`Error: Invalid mode "${mode}". Must be "solo" or "team".`);
    exitWithError(2, `Invalid mode "${mode}". Must be "solo" or "team".`);
  }

  if (!nonInteractive) {
    clack.intro("AlignTrue Init");
  } else {
    console.log("AlignTrue Init (non-interactive mode)");
  }

  const cwd = process.cwd();

  // Step 1: Detect project context
  const paths = getAlignTruePaths(cwd);
  const contextResult = detectContext(cwd);
  const aligntrueDir = paths.aligntrueDir;
  const configPath = paths.config;
  const teamConfigPath = paths.teamConfig;
  const rulesDir = join(aligntrueDir, "rules");
  const hasConfig = existsSync(configPath) || existsSync(teamConfigPath);
  const hasLockArtifacts =
    existsSync(join(cwd, ".aligntrue", "lock.json")) ||
    existsSync(join(cwd, ".aligntrue", "bundle.yaml")) ||
    existsSync(join(cwd, ".aligntrue.lock.json")) ||
    existsSync(join(cwd, ".aligntrue.bundle.yaml"));

  if (!hasConfig && hasLockArtifacts) {
    exitWithError(
      1,
      "Found partial AlignTrue setup (lockfile without config).",
      {
        hint: "Restore the missing config or remove .aligntrue artifacts, then rerun: aligntrue init --yes",
      },
    );
  }

  // Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    const hasRulesDir = existsSync(rulesDir);
    if (hasConfig && hasRulesDir) {
      const message =
        "AlignTrue already initialized in this project.\n" +
        "Your rules are in .aligntrue/rules/ - run 'aligntrue sync' to update agents.\n" +
        "To switch modes: 'aligntrue team enable' or 'aligntrue team disable'";

      if (nonInteractive) {
        console.log(message);
      } else {
        clack.outro(message);
      }
      process.exit(0);
      return;
    }
  }

  // Step 1b: Check for Ruler migration opportunity (skip if explicit source provided)
  let rulerConfig: Partial<AlignTrueConfig> | undefined;
  if (!sourceArg && detectRulerProject(cwd)) {
    rulerConfig = await promptRulerMigration(cwd);
  }

  const finalMode: AlignTrueMode = mode ?? rulerConfig?.mode ?? "solo";

  // Step 2: Get rules - either from provided source/ID or by scanning
  const scanner = createSpinner({ disabled: nonInteractive });
  let rulesToWrite: RuleFile[] = [];
  let isFreshStart = false;
  let isFromExternalSource = false;
  let rulesAlreadyExist = false;

  if (sourceArg) {
    const rulesDir = join(paths.aligntrueDir, "rules");

    if (isCatalogId(sourceArg)) {
      const catalogId = extractCatalogId(sourceArg);
      const resolvedId = catalogId || sourceArg;
      scanner.start(`Importing from catalog ${resolvedId}...`);

      const importResult = await importFromCatalog(resolvedId, rulesDir, cwd);

      if (importResult.warnings.length > 0) {
        const warningLines = importResult.warnings.map(
          (w) => `  • ${w.id}: ${w.reason || "skipped"}`,
        );
        if (nonInteractive) {
          console.warn(
            `Warnings while importing from catalog:\n${warningLines.join("\n")}`,
          );
        } else {
          clack.log.warn(
            `Warnings while importing from catalog:\n${warningLines.join("\n")}`,
          );
        }
      }

      rulesToWrite = importResult.rules;
      isFromExternalSource = true;

      scanner.stop(
        `Imported ${rulesToWrite.length} rule${rulesToWrite.length === 1 ? "" : "s"} from catalog`,
      );

      if (rulesToWrite.length === 0) {
        logMessage(
          `No rules imported for catalog ID ${resolvedId}`,
          "info",
          nonInteractive,
        );
        if (skipStarters) {
          isFreshStart = false;
          rulesToWrite = [];
        } else {
          isFreshStart = true;
          rulesToWrite = createStarterTemplates();
        }
      }
    } else {
      // Import from git or local path (skip auto-detect)
      scanner.start(`Importing rules from ${sourceArg}...`);

      const { resolveConflict } = await import("@aligntrue/core");
      const { importRules } = await import("../utils/source-resolver.js");

      const result = await importRules({
        source: sourceArg,
        ref: refArg,
        cwd,
        targetDir: rulesDir,
      });

      if (result.error) {
        scanner.stop("Import failed");

        const { formatError } = await import("../utils/error-formatter.js");
        const error: import("../utils/error-formatter.js").CLIError = {
          title: "Import failed",
          message: result.error,
          code: "ERR_IMPORT_FAILED",
        };
        formatError(error);
        exitWithError(1, `Import failed: ${result.error}`);
      }

      // Handle conflicts
      if (result.conflicts.length > 0 && !nonInteractive) {
        scanner.stop(`Found ${result.rules.length} rules (conflicts detected)`);

        for (const conflict of result.conflicts) {
          const choice = await clack.select({
            message: `Rule "${conflict.filename}" already exists. What do you want to do?`,
            options: [
              {
                value: "replace",
                label: "Replace - Overwrite existing (backup saved)",
              },
              {
                value: "keep-both",
                label: "Keep both - Save incoming as new file",
              },
              { value: "skip", label: "Skip - Don't import this rule" },
            ],
          });

          if (clack.isCancel(choice)) {
            clack.cancel("Import cancelled");
            process.exit(0);
            return;
          }

          const resolution = resolveConflict(
            conflict,
            choice as "replace" | "keep-both" | "skip",
            cwd,
          );

          // Update the rule's filename if needed
          const rule = result.rules.find(
            (r) => (r.relativePath || r.filename) === conflict.filename,
          );
          if (rule && resolution.resolution !== "skip") {
            const baseDir = rule.relativePath ? dirname(rule.relativePath) : "";
            const resolvedName = resolution.finalFilename;
            const finalRelative =
              /[\\/]/.test(resolvedName) || !baseDir || baseDir === "."
                ? resolvedName
                : join(baseDir, resolvedName);
            const updatedPaths = computeRulePaths(
              join(rulesDir, finalRelative),
              {
                cwd,
                rulesDir,
              },
            );
            rule.filename = updatedPaths.filename;
            rule.relativePath = updatedPaths.relativePath;
            rule.path = updatedPaths.path;
            if (resolution.backupPath) {
              logMessage(
                `Backed up existing rule to ${resolution.backupPath}`,
                "info",
                nonInteractive,
              );
            }
          } else if (resolution.resolution === "skip") {
            // Remove skipped rule from the list
            const index = result.rules.findIndex(
              (r) => (r.relativePath || r.filename) === conflict.filename,
            );
            if (index !== -1) {
              result.rules.splice(index, 1);
            }
          }
        }
      } else if (result.conflicts.length > 0) {
        // Non-interactive: keep both by default
        scanner.stop(`Found ${result.rules.length} rules`);
        for (const conflict of result.conflicts) {
          const resolution = resolveConflict(conflict, "keep-both", cwd);
          const rule = result.rules.find(
            (r) => (r.relativePath || r.filename) === conflict.filename,
          );
          if (rule) {
            const baseDir = rule.relativePath ? dirname(rule.relativePath) : "";
            const resolvedName = resolution.finalFilename;
            const finalRelative =
              /[\\/]/.test(resolvedName) || !baseDir || baseDir === "."
                ? resolvedName
                : join(baseDir, resolvedName);
            const updatedPaths = computeRulePaths(
              join(rulesDir, finalRelative),
              {
                cwd,
                rulesDir,
              },
            );
            rule.filename = updatedPaths.filename;
            rule.relativePath = updatedPaths.relativePath;
            rule.path = updatedPaths.path;
          }
        }
      } else {
        scanner.stop(`Found ${result.rules.length} rules`);
      }

      rulesToWrite = result.rules;
      isFromExternalSource = true;

      if (rulesToWrite.length === 0) {
        logMessage(`No rules found at ${sourceArg}`, "info", nonInteractive);
        if (skipStarters) {
          isFreshStart = false;
          rulesToWrite = [];
        } else {
          isFreshStart = true;
          rulesToWrite = createStarterTemplates();
        }
      }
    }
  } else if (contextResult.context === "partial-rules-only") {
    const existingRules = await scanExistingAlignTrueRules(cwd);

    if (existingRules.length === 0) {
      // Fall back to stale handling if we couldn't read any rules
      isFreshStart = !skipStarters;
      rulesToWrite = skipStarters ? [] : createStarterTemplates();
    } else {
      const discoveryFiles = existingRules.map((r) => ({
        path: r.path,
        relativePath: r.path,
        type: "align-md",
      }));
      const discoveryMsg = formatDiscoveredFiles(discoveryFiles, {
        groupBy: "type",
      });
      logMessage(discoveryMsg, "info", nonInteractive);

      rulesToWrite = existingRules;
      rulesAlreadyExist = true;
    }
  } else if (contextResult.context === "partial-stale") {
    // Treat as a fresh start but keep existing directory
    if (skipStarters) {
      isFreshStart = false;
      rulesToWrite = [];
    } else {
      isFreshStart = true;
      rulesToWrite = createStarterTemplates();
    }
  } else {
    // Auto-detect existing rules with overlap detection
    scanner.start("Scanning for existing rules...");

    // Scan for agent files and parse them as rules
    const scanResult = await scanForExistingRulesWithOverlap(cwd);

    scanner.stop("Scan complete");

    if (scanResult.rules.length > 0) {
      // Show what was found with folder context
      // Infer type from path since we no longer store it in frontmatter
      const discoveryFiles = scanResult.rules.map((r) => ({
        path: r.path,
        relativePath: r.path,
        type: inferAgentTypeFromPath(r.path),
      }));
      const discoveryMsg = formatDiscoveredFiles(discoveryFiles, {
        groupBy: "type",
      });
      logMessage(discoveryMsg, "info", nonInteractive);

      // Handle overlap detection result
      if (scanResult.hasOverlap && scanResult.duplicates.length > 0) {
        // Show overlap detection result
        const overlapResult = await handleOverlapDetection(
          scanResult,
          cwd,
          nonInteractive,
        );
        rulesToWrite = overlapResult.rules;
        // Duplicates will be backed up after directory creation
      } else {
        rulesToWrite = scanResult.rules;
      }
    } else {
      // No rules found, will use starter templates
      if (skipStarters) {
        isFreshStart = false;
        rulesToWrite = [];
      } else {
        isFreshStart = true;
        rulesToWrite = createStarterTemplates();
      }
    }
  }

  // Step 3: Confirm (if interactive) - single consolidated prompt
  if (!nonInteractive) {
    const confirmMessage = isFreshStart
      ? "No existing rules found. Create default starter rules? (you can add your own rules later)"
      : isFromExternalSource
        ? `Create AlignTrue configuration with these ${rulesToWrite.length} rules?`
        : `Initialize AlignTrue with these ${rulesToWrite.length} rules?`;

    const confirm = await clack.confirm({
      message: confirmMessage,
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Run 'aligntrue init' when you're ready to start.");
      process.exit(0);
      return;
    }
  }

  // Step 3b: Format selection (if interactive and no --exporters flag)
  let selectedExporters: string[] = [];

  if (exporters) {
    // User provided --exporters flag, use those
    selectedExporters = exporters;
  } else if (!nonInteractive) {
    // Interactive mode: show format selection
    const detectedFormats = detectFormats(cwd);

    // Show only common exporters + any detected ones not in common list
    const commonSet = new Set(COMMON_EXPORTERS);
    const optionsToShow = FORMAT_OPTIONS.filter(
      (opt: FormatOption) =>
        commonSet.has(opt.exporter) || detectedFormats.has(opt.exporter),
    );

    // Build options for multi-select
    const formatChoices = optionsToShow.map((opt: FormatOption) => {
      const isDetected = detectedFormats.has(opt.exporter);
      return {
        value: opt.exporter,
        label: `${opt.format}`,
        hint: `${opt.usedBy}${isDetected ? " (detected)" : ""}`,
      };
    });

    // Pre-select detected formats only (no default selection)
    const initialValues = optionsToShow
      .filter((opt: FormatOption) => detectedFormats.has(opt.exporter))
      .map((opt: FormatOption) => opt.exporter);

    // Calculate how many more exporters are available
    const totalExporters = FORMAT_OPTIONS.length;
    const shownExporters = optionsToShow.length;
    const moreCount = totalExporters - shownExporters;

    // Show tips before the prompt
    clack.log.info(
      `Select formats to start with${moreCount > 0 ? ` (add ${moreCount}+ more with 'aligntrue exporters')` : ""}\n  • Use space to select formats\n  • See full list: https://aligntrue.ai/agents\n  • See how to add new ones: https://aligntrue.ai/extend`,
    );

    const selected = await clack.multiselect({
      message: "Which formats do you want to export to?",
      options: formatChoices,
      initialValues: initialValues,
      required: false,
      maxItems: 10,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Run 'aligntrue init' when you're ready to start.");
      process.exit(0);
      return;
    }

    selectedExporters = selected as string[];

    // Show smart continue message based on selection
    if (selectedExporters.length > 0) {
      clack.log.info(
        `✓ Enabling ${selectedExporters.length} agent format${selectedExporters.length > 1 ? "s" : ""}`,
      );
    } else {
      clack.log.info(
        "No formats selected. You can add them later with 'aligntrue exporters enable <format>'.",
      );
    }
  } else {
    // Non-interactive mode: use detected or default to agents
    const detectedFormats = detectFormats(cwd);
    selectedExporters =
      detectedFormats.size > 0 ? Array.from(detectedFormats) : ["agents"];
  }

  // Step 4: Create files
  mkdirSync(aligntrueDir, { recursive: true });

  // Create rules directory and write rules
  mkdirSync(rulesDir, { recursive: true });

  const createdFiles: string[] = [];

  const shouldWriteRules = !rulesAlreadyExist;
  if (shouldWriteRules) {
    for (const rule of rulesToWrite) {
      const rulePath = rule.relativePath || rule.filename;
      const fullPath = join(rulesDir, rulePath);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeRuleFile(fullPath, rule);
      createdFiles.push(join(".aligntrue/rules", rulePath));
    }
  }

  // Use selected exporters, preferring ruler config if available
  const finalExporters =
    (rulerConfig?.exporters as string[] | undefined) || selectedExporters;

  // Generate config with sources
  const sources: NonNullable<AlignTrueConfig["sources"]> = [
    {
      type: "local",
      path: ".aligntrue/rules",
    },
  ];

  // Generate config (personal defaults)
  const config: Partial<AlignTrueConfig> = {
    mode: finalMode,
    sources,
    exporters: finalExporters,
  };

  // Merge ruler config settings if available
  if (rulerConfig) {
    if (rulerConfig.git) {
      config.git = rulerConfig.git;
    }
  }

  // Team mode: write split configs (team + personal)
  if (finalMode === "team") {
    const teamConfigPath = paths.teamConfig;

    const teamConfig: Partial<AlignTrueConfig> = {
      mode: "team",
      modules: {
        lockfile: true,
      },
      sources,
    };

    // Personal config keeps exporters/git/etc. but drops team-only fields
    const personalConfig: Partial<AlignTrueConfig> = { ...config };
    delete personalConfig.sources;
    delete personalConfig.mode;
    delete personalConfig.modules;

    // Write team + personal configs
    mkdirSync(dirname(teamConfigPath), { recursive: true });
    writeConfigFileSafely(teamConfigPath, yaml.stringify(teamConfig), {
      cwd,
      description: "Team config",
    });
    createdFiles.push(".aligntrue/config.team.yaml");

    writeConfigFileSafely(configPath, yaml.stringify(personalConfig), {
      cwd,
      description: "Personal config",
    });
    createdFiles.push(".aligntrue/config.yaml");

    // Gitignore personal config
    await addToGitignore("config.yaml", "AlignTrue personal config", cwd);

    // Create empty lockfile immediately for team mode
    const lockfileResult = await createEmptyLockfile(cwd, "team");
    if (!lockfileResult.success && lockfileResult.error) {
      if (!nonInteractive) {
        clack.log.warn(
          `Could not create lockfile: ${lockfileResult.error}. It will be created on first sync.`,
        );
      } else {
        console.warn(
          `Could not create lockfile: ${lockfileResult.error}. It will be created on first sync.`,
        );
      }
    }
  } else {
    // Solo mode: single config.yaml
    mkdirSync(dirname(configPath), { recursive: true });
    writeConfigFileSafely(configPath, yaml.stringify(config), {
      cwd,
      description: "Config",
    });
    createdFiles.push(".aligntrue/config.yaml");
  }

  // Add README to .aligntrue directory
  const aligntrueReadmeContent = `# .aligntrue

This directory contains your AlignTrue configuration and rules.

## Directory structure

- **\`rules/\`** - THE ONLY DIRECTORY YOU SHOULD EDIT. This is your single source of truth for all agent rules.
- **\`config.yaml\`** - Configuration file (created during init, can be edited for settings)
- **\`.backups/\`** - Automatic backups of configurations and individual files (gitignored, for your reference only)
  - \`snapshots/\` - Full directory snapshots before destructive operations
  - \`files/\` - Individual file backups when files are replaced
- **\`.cache/\`** - Generated cache for performance (gitignored)

## Editing rules

All your rules belong in \`rules/\` as markdown files:

\`\`\`markdown
---
title: "My Rule"
description: "Description"
scope: "packages/app"
cursor:
  when: "alwaysOn"
---

# My Rule Content
...
\`\`\`

After editing, run:
\`\`\`bash
aligntrue sync
\`\`\`

## Safe by default

- AlignTrue never edits agent-specific folders like \`.cursor/plans/\`, \`.cursor/memories/\`, etc.
- Only configuration files defined in \`.aligntrue/\` and exported agent files are touched.
- Backups are automatically created before overwriting any manually edited files.

## Organization

- You can create subdirectories in \`rules/\` (e.g. \`rules/frontend/\`, \`rules/api/\`)
- AlignTrue detects nested directories and mirrors them to agents
- Frontmatter options like \`exclude_from\` and \`export_only_to\` control which exporters receive each rule

## More information

- View exported files in your root directory (e.g., \`AGENTS.md\`, \`.cursor/rules/\`)
- Check \`config.yaml\` for settings (exporters, sources, git integration)
- Run \`aligntrue --help\` for CLI commands
`;
  writeFileSync(
    join(aligntrueDir, "README.md"),
    aligntrueReadmeContent,
    "utf-8",
  );
  createdFiles.push(".aligntrue/README.md");

  // Add .gitignore to .aligntrue directory to ignore local state files
  const aligntrueGitignoreContent = `# Generated state files (local state, not part of source control)
.source-rule-hashes.json
.rules.yaml
.last-sync

# User-specific runtime state (not for source control)
privacy-consent.json
.drift-log.json

# Backup directory (created during sync operations)
.backups/

# Cache directory
.cache/
`;
  writeFileSync(
    join(aligntrueDir, ".gitignore"),
    aligntrueGitignoreContent,
    "utf-8",
  );
  createdFiles.push(".aligntrue/.gitignore");

  // Report creation
  formatCreatedFiles(createdFiles, { nonInteractive });

  // Step 5: Sync
  const shouldSync = !noSync && finalExporters.length > 0;
  let autoSyncPerformed = false;

  if (finalExporters.length === 0) {
    // No exporters configured - skip sync
  } else if (shouldSync) {
    // Auto-sync after init - user already selected exporters, so sync is expected
    await runSync();
    autoSyncPerformed = true;
  }

  // Build consolidated outro message
  const completionStatus = autoSyncPerformed
    ? "AlignTrue initialized and synced"
    : "AlignTrue initialized";

  const outroLines = [
    completionStatus,
    "",
    ...(isFromExternalSource ? [`Rules imported from ${sourceArg}.`] : []),
    "Your rules are in .aligntrue/rules/ - edit them any time.",
    "Customize config in .aligntrue/config.yaml",
    "Agent files are gitignored by default (change with git.mode in config).",
    "",
    "Helpful commands:",
    "  aligntrue sync        Sync rules to your agents",
    "  aligntrue add <url>   Add rules from git repo or path",
    "  aligntrue exporters    Manage agent formats",
    "  aligntrue status      Check sync health",
    ...(mode !== "team"
      ? ["  aligntrue team enable Enable team mode for collaboration"]
      : []),
    "  aligntrue --help      See all commands",
    "",
    "Learn more: https://aligntrue.ai/docs",
  ];

  if (!nonInteractive) {
    clack.outro(outroLines.join("\n"));
  } else {
    console.log("\n" + outroLines.join("\n"));
  }
}

async function runSync() {
  try {
    const syncModule = await import("./sync/index.js");
    const sync = syncModule.sync;
    await sync(["--quiet", "--skip-not-found-warning"]);
  } catch (error) {
    console.error(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
