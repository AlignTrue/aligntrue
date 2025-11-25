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
    usedBy: "Copilot, Codex, Aider, Jules, and 10+ more",
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
    exporter: "cline",
    format: ".clinerules",
    usedBy: "Cline",
    detectPatterns: [".clinerules"],
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

    // Pre-select detected formats
    const initialValues = FORMAT_OPTIONS.filter((opt) =>
      detectedFormats.has(opt.exporter),
    ).map((opt) => opt.exporter);

    const selected = await clack.multiselect({
      message: "Which formats do you want to export to?",
      options: formatChoices,
      initialValues: initialValues.length > 0 ? initialValues : ["agents"],
      required: false,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Run 'aligntrue init' when you're ready to start.");
      process.exit(0);
    }

    selectedExporters = selected as string[];

    // Show note about other formats
    if (selectedExporters.length > 0) {
      clack.log.info(
        "Tip: See all available formats with 'aligntrue adapters list'",
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

  // Use selected exporters
  const finalExporters = selectedExporters;

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

  // Add README to rules dir
  const readmeContent = `# .aligntrue/rules/

This directory is the single source of truth for your agent rules.
Edit files here and run \`aligntrue sync\` to update your agents.

## Organization
- You can create subdirectories (e.g. \`frontend/\`)
- AlignTrue detects nested directories and mirrors them to agents
- Frontmatter controls export behavior (exclude_from, export_only_to)

## Format
Markdown files with YAML frontmatter:

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
`;
  writeFileSync(join(rulesDir, "README.md"), readmeContent, "utf-8");

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

  // Outro with helpful commands
  const outroLines = [
    "",
    isFreshStart
      ? "Your starter rules are ready. Add or update them any time in .aligntrue/rules/"
      : "Initialization complete. Review your rules in .aligntrue/rules/",
    "",
    "Helpful commands:",
    "  aligntrue sync       Sync rules to your agents",
    "  aligntrue adapters   Manage agent formats",
    "  aligntrue status     Check sync health",
    "  aligntrue --help     See all commands",
  ];

  logMessage(outroLines.join("\n"), "info", nonInteractive);

  recordEvent({ command_name: "init", align_hashes_used: [] });
}

async function runSync() {
  try {
    const syncModule = await import("./sync/index.js");
    const sync = syncModule.sync;
    await sync(["--quiet"]);
  } catch (error) {
    console.error(
      `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
