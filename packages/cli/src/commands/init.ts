/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import {
  getAlignTruePaths,
  type AlignTrueConfig,
  writeRuleFile,
} from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { shouldUseInteractive } from "../utils/tty-helper.js";
import { createSpinner } from "../utils/spinner.js";

import { scanForExistingRules } from "./init/rule-importer.js";
import { createStarterTemplates } from "./init/starter-templates.js";
import {
  detectRulerProject,
  promptRulerMigration,
} from "./init/ruler-detector.js";

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
    flag: "--project-id",
    hasValue: true,
    description:
      "Project identifier (default: auto-detected from git/directory)",
  },
  {
    flag: "--exporters",
    hasValue: true,
    description: "Comma-separated list of exporters (default: auto-detect)",
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
        "aligntrue init --no-sync",
        "aligntrue init --non-interactive --project-id my-app --exporters cursor,agents",
      ],
      notes: [
        "- Automatically detects existing rules and imports them",
        "- Creates starter templates if no rules found",
        "- Creates .aligntrue/rules/ directory as the single source of truth",
        "- Workflow mode auto-configured based on init choice",
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
    const message = `✗ AlignTrue already initialized in this project
    
Next steps:
  1. Review rules in .aligntrue/rules/
  2. Run sync: aligntrue sync

Want to reinitialize? Remove .aligntrue/ first (warning: destructive)`;

    if (nonInteractive) {
      console.log(message);
    } else {
      clack.outro(message);
    }
    process.exit(0);
  }

  // Step 1b: Check for Ruler migration opportunity
  let rulerConfig: Partial<AlignTrueConfig> | undefined;
  if (detectRulerProject(cwd)) {
    rulerConfig = await promptRulerMigration(cwd);
  }

  // Step 2: Scan for existing rules
  const scanner = createSpinner({ disabled: nonInteractive });
  scanner.start("Scanning for existing rules...");

  const importedRules = await scanForExistingRules(cwd);

  scanner.stop("Scan complete");

  let rulesToWrite = importedRules;
  let isFreshStart = false;

  if (rulesToWrite.length > 0) {
    logMessage(
      `Found ${rulesToWrite.length} existing rules to import.`,
      "info",
      nonInteractive,
    );
  } else {
    // No rules found, will use starter templates
    isFreshStart = true;
    rulesToWrite = createStarterTemplates();
  }

  // Step 3: Confirm (if interactive)
  if (!nonInteractive) {
    // For fresh starts, combine the "no rules found" message with the confirm
    const confirmMessage = isFreshStart
      ? "No existing rules found. Create default starter rules? (you can add your own rules later)"
      : `Initialize AlignTrue with ${rulesToWrite.length} rules?`;

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

    // Build options for multi-select
    const formatChoices = FORMAT_OPTIONS.map((opt) => {
      const isDetected = detectedFormats.has(opt.exporter);
      return {
        value: opt.exporter,
        label: `${opt.format}`,
        hint: `${opt.usedBy}${isDetected ? " (detected)" : ""}`,
      };
    });

    // Pre-select detected formats only (no default selection)
    const initialValues = FORMAT_OPTIONS.filter((opt) =>
      detectedFormats.has(opt.exporter),
    ).map((opt) => opt.exporter);

    // Show tips before the prompt
    clack.log.info(
      "Agent exporter tips:\n  • Use space to select formats\n  • Add or change them later with 'aligntrue adapters'\n  • See full list: https://aligntrue.ai/agents\n  • See how to add new ones: https://aligntrue.ai/extend",
    );

    const selected = await clack.multiselect({
      message: "Which formats do you want to export to?",
      options: formatChoices,
      initialValues: initialValues,
      required: false,
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
        "No formats selected. You can add them later with 'aligntrue adapters enable <format>'.",
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
    const fullPath = join(rulesDir, rule.path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeRuleFile(fullPath, rule);
    createdFiles.push(join(".aligntrue/rules", rule.path));
  }

  // Use selected exporters, preferring ruler config if available
  const finalExporters =
    (rulerConfig?.exporters as string[] | undefined) || selectedExporters;

  // Generate config
  const config: Partial<AlignTrueConfig> = {
    sources: [
      {
        type: "local",
        path: ".aligntrue/rules",
      },
    ],
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
- **\`overwritten-rules/\`** - Automatic backups of files manually edited after export (gitignored, for your reference only)
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

  // Report creation
  if (nonInteractive) {
    console.log("\nCreated files:");
    createdFiles.forEach((f) => console.log(`  ✓ ${f}`));
  } else {
    createdFiles.forEach((f) =>
      logMessage(`Created ${f}`, "success", nonInteractive),
    );
  }

  // Step 5: Sync
  console.log("\n✓ AlignTrue initialized\n");

  const shouldSync = !noSync && finalExporters.length > 0;
  let autoSyncPerformed = false;

  if (finalExporters.length === 0) {
    // No exporters configured - skip sync and inform user
    logMessage(
      "No exporters configured. Add one with 'aligntrue adapters enable <format>'",
      "info",
      nonInteractive,
    );
  } else if (shouldSync) {
    // For fresh starts, auto-sync without prompting (we know exactly what will be synced)
    if (isFreshStart) {
      await runSync();
      autoSyncPerformed = true;
    } else if (!nonInteractive) {
      // For imported rules, ask user if they want to sync now
      const syncNow = await clack.confirm({
        message: "Run initial sync now?",
        initialValue: true,
      });
      if (clack.isCancel(syncNow) || !syncNow) {
        clack.log.info("Skipping sync. Run 'aligntrue sync' when ready.");
      } else {
        await runSync();
        autoSyncPerformed = true;
      }
    } else {
      // Non-interactive mode always syncs
      await runSync();
      autoSyncPerformed = true;
    }
  }

  if (autoSyncPerformed) {
    const msg = "\n✓ Initial sync complete! Your agents are now aligned.";
    logMessage(msg, "success", nonInteractive);
  }

  // Show multi-format message if any selected exporters support multiple formats
  const multiFormatAgents = [
    "cursor",
    "amazonq",
    "kilocode",
    "augmentcode",
    "kiro",
    "trae-ai",
  ];
  const hasMultiFormatAgents = finalExporters.some((e: string) =>
    multiFormatAgents.includes(e),
  );
  if (hasMultiFormatAgents) {
    logMessage(
      "\nSome agents support multiple export formats (multi-file, AGENTS.md, etc.).\n" +
        "Configure in .aligntrue/config.yaml. See docs at https://aligntrue.ai/formats",
      "info",
      nonInteractive,
    );
  }

  // Outro with helpful commands
  const outroLines = [
    "",
    isFreshStart
      ? "Your starter rules are ready. Add or update them any time in .aligntrue/rules/"
      : "Initialization complete. Review your rules in .aligntrue/rules/",
    "",
    "Helpful commands:",
    "  aligntrue sync        Sync rules to your agents",
    "  aligntrue adapters    Manage agent formats",
    "  aligntrue status      Check sync health",
    ...(mode !== "team"
      ? ["  aligntrue team enable Enable team mode for collaboration"]
      : []),
    "  aligntrue --help      See all commands",
  ];

  logMessage(outroLines.join("\n"), "info", nonInteractive);

  recordEvent({ command_name: "init", align_hashes_used: [] });
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
