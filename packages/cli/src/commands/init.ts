/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync, cpSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import {
  getAlignTruePaths,
  type AlignTrueConfig,
  writeRuleFile,
  type RuleFile,
  getBestFormat,
} from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import {
  parseCommonArgs,
  showStandardHelp,
  formatCreatedFiles,
  formatDiscoveredFiles,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { shouldUseInteractive } from "../utils/tty-helper.js";
import { createSpinner } from "../utils/spinner.js";

import {
  scanForExistingRulesWithOverlap,
  type DuplicateFile,
  type ScanResult,
} from "./init/rule-importer.js";
import { createStarterTemplates } from "./init/starter-templates.js";
import {
  detectRulerProject,
  promptRulerMigration,
} from "./init/ruler-detector.js";

/**
 * Infer agent type from file path
 * Used for display purposes after scanning.
 *
 * IMPORTANT: Check specific filenames BEFORE directory patterns.
 * This matches detectNestedAgentFiles behavior in @aligntrue/core.
 */
function inferAgentTypeFromPath(path: string): string {
  // Specific filenames first (higher specificity)
  if (path.endsWith("AGENTS.md")) return "agents";
  if (path.endsWith("CLAUDE.md")) return "claude";

  // Directory/extension patterns second
  if (path.includes(".cursor/rules") || path.endsWith(".mdc")) return "cursor";

  return "other";
}

/**
 * Format options for exporter selection
 * Shows formats (not individual agents) with "used by" descriptions
 */
interface FormatOption {
  exporter: string;
  format: string;
  usedBy: string;
  detectPatterns: string[];
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    exporter: "agents",
    format: "AGENTS.md",
    usedBy:
      "GitHub Copilot, OpenAI Codex, Aider, Roo Code, Jules, Amp, Open Code, and more",
    detectPatterns: ["AGENTS.md"],
  },
  {
    exporter: "cursor",
    format: ".cursor/rules/",
    usedBy: "Cursor",
    detectPatterns: [".cursor/rules/", ".cursor/"],
  },
  {
    exporter: "claude",
    format: "CLAUDE.md",
    usedBy: "Claude Code",
    detectPatterns: ["CLAUDE.md"],
  },
  {
    exporter: "windsurf",
    format: ".windsurf/rules/",
    usedBy: "Windsurf",
    detectPatterns: [".windsurf/rules/", ".windsurf/"],
  },
  {
    exporter: "cline",
    format: ".clinerules",
    usedBy: "Cline",
    detectPatterns: [".clinerules"],
  },
  {
    exporter: "zed",
    format: ".zed/rules.md",
    usedBy: "Zed",
    detectPatterns: [".zed/rules.md", ".zed/"],
  },
  {
    exporter: "amazonq",
    format: ".amazonq/rules/",
    usedBy: "Amazon Q",
    detectPatterns: [".amazonq/rules/", ".amazonq/"],
  },
  {
    exporter: "augmentcode",
    format: ".augment/rules/",
    usedBy: "Augment Code",
    detectPatterns: [".augment/rules/", ".augment/"],
  },
  {
    exporter: "crush",
    format: "CRUSH.md",
    usedBy: "Crush",
    detectPatterns: ["CRUSH.md"],
  },
  {
    exporter: "firebender",
    format: "firebender.json",
    usedBy: "Firebender",
    detectPatterns: ["firebender.json"],
  },
  {
    exporter: "firebase-studio",
    format: ".idx/airules.md",
    usedBy: "Firebase Studio",
    detectPatterns: [".idx/airules.md", ".idx/"],
  },
  {
    exporter: "gemini",
    format: "GEMINI.md",
    usedBy: "Google Gemini",
    detectPatterns: ["GEMINI.md"],
  },
  {
    exporter: "goose",
    format: ".goosehints",
    usedBy: "Goose",
    detectPatterns: [".goosehints"],
  },
  {
    exporter: "junie",
    format: ".junie/guidelines.md",
    usedBy: "Junie",
    detectPatterns: [".junie/guidelines.md", ".junie/"],
  },
  {
    exporter: "kilocode",
    format: ".kilocode/rules/",
    usedBy: "Kilo Code",
    detectPatterns: [".kilocode/rules/", ".kilocode/"],
  },
  {
    exporter: "kiro",
    format: ".kiro/steering/",
    usedBy: "Kiro",
    detectPatterns: [".kiro/steering/", ".kiro/"],
  },
  {
    exporter: "openhands",
    format: ".openhands/microagents/repo.md",
    usedBy: "Open Hands",
    detectPatterns: [".openhands/microagents/repo.md", ".openhands/"],
  },
  {
    exporter: "trae-ai",
    format: ".trae/rules/",
    usedBy: "Trae AI",
    detectPatterns: [".trae/rules/", ".trae/"],
  },
  {
    exporter: "warp",
    format: "WARP.md",
    usedBy: "Warp",
    detectPatterns: ["WARP.md"],
  },
];

/**
 * Most common exporters shown in init
 * Users can add 14+ more with 'aligntrue exporters'
 */
const COMMON_EXPORTERS = ["agents", "cursor", "claude", "windsurf", "cline"];

/**
 * Detect which formats are present in the workspace
 */
function detectFormats(cwd: string): Set<string> {
  const detected = new Set<string>();
  for (const option of FORMAT_OPTIONS) {
    for (const pattern of option.detectPatterns) {
      if (existsSync(join(cwd, pattern))) {
        detected.add(option.exporter);
        break;
      }
    }
  }
  return detected;
}

/**
 * Result of handling overlap detection
 */
interface OverlapHandlingResult {
  /** Rules to import */
  rules: RuleFile[];
  /** Whether user chose to import all files separately */
  importAll: boolean;
}

/**
 * Handle overlap detection during init
 *
 * Shows the user what was detected, explains the recommendation,
 * and in interactive mode lets them choose how to proceed.
 */
async function handleOverlapDetection(
  scanResult: ScanResult,
  cwd: string,
  nonInteractive: boolean,
): Promise<OverlapHandlingResult> {
  const { rules, duplicates, similarityGroups } = scanResult;

  // Format the similarity message
  const dupMessages: string[] = [];
  for (const group of similarityGroups) {
    const canonicalType = group.canonical.type;
    for (const dup of group.duplicates) {
      const percent = Math.round(dup.similarity * 100);
      dupMessages.push(
        `  ${dup.file.path} is ~${percent}% similar to ${canonicalType} rules`,
      );
    }
  }

  // Find the best format from ALL rules being imported
  // (both unique files and canonical files from similarity groups)
  // This ensures Cursor (priority 1) is recommended over AGENTS (priority 10)
  // even when only AGENTS/CLAUDE form a similarity group
  const allTypes = rules.map((r) => inferAgentTypeFromPath(r.path));
  const bestFormat = getBestFormat(
    allTypes,
    similarityGroups[0]?.canonical.type || "multi-file",
  );

  const overlapMessage =
    `Overlap detected:\n` +
    dupMessages.join("\n") +
    `\n\nRecommendation: Use ${bestFormat} format as your source (most structured).` +
    `\nSimilar files will be backed up to .aligntrue/.backups/init-duplicates/`;

  if (nonInteractive) {
    // In non-interactive mode, use smart default and explain
    console.log(overlapMessage);
    console.log(
      `\nUsing recommended import strategy (multi-file format preferred).`,
    );

    // Backup duplicates
    await backupDuplicateFiles(duplicates, cwd);

    return { rules, importAll: false };
  }

  // Interactive mode: let user choose
  clack.log.info(overlapMessage);

  const choice = await clack.select({
    message: "How would you like to import these?",
    options: [
      {
        value: "recommended",
        label: "Use recommended format as source",
        hint: "Multi-file format preferred, similar files backed up",
      },
      {
        value: "all",
        label: "Import all files separately",
        hint: "Keep all files as individual rules (may have duplicates)",
      },
    ],
  });

  if (clack.isCancel(choice)) {
    clack.cancel("Run 'aligntrue init' when you're ready to start.");
    process.exit(0);
  }

  if (choice === "all") {
    // User wants all files - combine rules with duplicates converted to rules
    const { scanForExistingRulesWithOverlap: rescan } = await import(
      "./init/rule-importer.js"
    );
    const allResult = await rescan(cwd, { detectOverlap: false });
    clack.log.info("Importing all files as separate rules.");
    return { rules: allResult.rules, importAll: true };
  }

  // Use recommended approach - backup duplicates
  await backupDuplicateFiles(duplicates, cwd);
  clack.log.success(
    `Backed up ${duplicates.length} similar file${duplicates.length !== 1 ? "s" : ""} to .aligntrue/.backups/init-duplicates/`,
  );

  return { rules, importAll: false };
}

/**
 * Backup duplicate files to .aligntrue/.backups/init-duplicates/
 */
async function backupDuplicateFiles(
  duplicates: DuplicateFile[],
  cwd: string,
): Promise<void> {
  if (duplicates.length === 0) return;

  const paths = getAlignTruePaths(cwd);
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\./g, "-")
    .replace(/Z$/, "");
  const backupDir = join(
    paths.aligntrueDir,
    ".backups",
    "init-duplicates",
    timestamp,
  );

  mkdirSync(backupDir, { recursive: true });

  // Copy each duplicate file
  for (const dup of duplicates) {
    const srcPath = dup.file.path;
    const destPath = join(backupDir, dup.file.relativePath);
    mkdirSync(dirname(destPath), { recursive: true });
    cpSync(srcPath, destPath);
  }

  // Write manifest
  const manifest = {
    version: "1",
    timestamp: new Date().toISOString(),
    reason: "init-overlap-detection",
    duplicates: duplicates.map((d) => ({
      path: d.file.relativePath,
      type: d.file.type,
      similarity: d.similarity,
      canonicalPath: d.canonicalPath,
    })),
  };

  writeFileSync(
    join(backupDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}

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
    flag: "--source",
    hasValue: true,
    description: "Import rules from URL or path (skips auto-detect)",
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

/**
 * Init command implementation
 */
export async function init(args: string[] = []): Promise<void> {
  const parsed = parseCommonArgs(args, ARG_DEFINITIONS);

  if (parsed.help) {
    showStandardHelp({
      name: "init",
      description: "Initialize AlignTrue in a project",
      usage: "aligntrue init [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue init",
        "aligntrue init --yes",
        "aligntrue init --source https://github.com/org/rules",
        "aligntrue init --source ./path/to/rules",
        "aligntrue init --non-interactive --exporters cursor,agents",
      ],
      notes: [
        "- Without --source: auto-detects existing rules and imports them",
        "- With --source: imports from URL/path (skips auto-detect)",
        "- To keep sources connected for updates, use 'aligntrue add source <url>'",
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

  const mode = parsed.flags["mode"] as string | undefined;
  const exportersArg = parsed.flags["exporters"] as string | undefined;
  const exporters = exportersArg
    ? exportersArg.split(",").map((e) => e.trim())
    : undefined;
  const noSync = (parsed.flags["no-sync"] as boolean | undefined) || false;
  const sourceArg = parsed.flags["source"] as string | undefined;
  const refArg = parsed.flags["ref"] as string | undefined;

  // Validate mode if provided
  if (mode && mode !== "solo" && mode !== "team") {
    console.error(`Error: Invalid mode "${mode}". Must be "solo" or "team".`);
    process.exit(2);
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

  // Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    const message =
      "AlignTrue already initialized in this project.\n" +
      "Your rules are in .aligntrue/rules/ - run 'aligntrue sync' to update agents.";

    if (nonInteractive) {
      console.log(message);
    } else {
      clack.outro(message);
    }
    process.exit(0);
  }

  // Step 1b: Check for Ruler migration opportunity (skip if --source provided)
  let rulerConfig: Partial<AlignTrueConfig> | undefined;
  if (!sourceArg && detectRulerProject(cwd)) {
    rulerConfig = await promptRulerMigration(cwd);
  }

  // Step 2: Get rules - either from --source or by scanning
  const scanner = createSpinner({ disabled: nonInteractive });
  let rulesToWrite: RuleFile[] = [];
  let isFreshStart = false;
  let isFromExternalSource = false;

  if (sourceArg) {
    // Import from specified source (skip auto-detect)
    scanner.start(`Importing rules from ${sourceArg}...`);

    const { resolveConflict } = await import("@aligntrue/core");
    const { importRules } = await import("../utils/source-resolver.js");
    const rulesDir = join(paths.aligntrueDir, "rules");

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
      process.exit(1);
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
        }

        const resolution = resolveConflict(
          conflict,
          choice as "replace" | "keep-both" | "skip",
          cwd,
        );

        // Update the rule's filename if needed
        const rule = result.rules.find((r) => r.filename === conflict.filename);
        if (rule && resolution.resolution !== "skip") {
          rule.filename = resolution.finalFilename;
          rule.path = resolution.finalFilename;
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
            (r) => r.filename === conflict.filename,
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
        const rule = result.rules.find((r) => r.filename === conflict.filename);
        if (rule) {
          rule.filename = resolution.finalFilename;
          rule.path = resolution.finalFilename;
        }
      }
    } else {
      scanner.stop(`Found ${result.rules.length} rules`);
    }

    rulesToWrite = result.rules;
    isFromExternalSource = true;

    if (rulesToWrite.length === 0) {
      logMessage(`No rules found at ${sourceArg}`, "info", nonInteractive);
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
      isFreshStart = true;
      rulesToWrite = createStarterTemplates();
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
      (opt) => commonSet.has(opt.exporter) || detectedFormats.has(opt.exporter),
    );

    // Build options for multi-select
    const formatChoices = optionsToShow.map((opt) => {
      const isDetected = detectedFormats.has(opt.exporter);
      return {
        value: opt.exporter,
        label: `${opt.format}`,
        hint: `${opt.usedBy}${isDetected ? " (detected)" : ""}`,
      };
    });

    // Pre-select detected formats only (no default selection)
    const initialValues = optionsToShow
      .filter((opt) => detectedFormats.has(opt.exporter))
      .map((opt) => opt.exporter);

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
  const aligntrueDir = paths.aligntrueDir;
  const configPath = paths.config;

  mkdirSync(aligntrueDir, { recursive: true });

  // Create rules directory and write rules
  const rulesDir = join(aligntrueDir, "rules");
  mkdirSync(rulesDir, { recursive: true });

  const createdFiles: string[] = [];

  for (const rule of rulesToWrite) {
    const rulePath = rule.relativePath || rule.filename;
    const fullPath = join(rulesDir, rulePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeRuleFile(fullPath, rule);
    createdFiles.push(join(".aligntrue/rules", rulePath));
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

  // Generate config
  const config: Partial<AlignTrueConfig> = {
    sources,
    exporters: finalExporters,
  };

  // Merge ruler config settings if available
  if (rulerConfig) {
    if (rulerConfig.git) {
      config.git = rulerConfig.git;
    }
    if (rulerConfig.mode) {
      config.mode = rulerConfig.mode;
    }
  }

  if (mode === "team") {
    config.mode = "team";
    config.modules = {
      lockfile: true,
      bundle: true,
    };
  }

  // Write config
  writeFileSync(configPath, yaml.stringify(config), "utf-8");
  createdFiles.push(".aligntrue/config.yaml");

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
.agent-export-hashes.json
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
