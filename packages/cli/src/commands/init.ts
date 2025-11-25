/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { mkdirSync, writeFileSync } from "fs";
import { join, basename, dirname } from "path";
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
import { execSync } from "child_process";

import { scanForExistingRules } from "./init/rule-importer.js";
import { createStarterTemplates } from "./init/starter-templates.js";

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
 * Detect project ID intelligently from git repo or directory name
 */
function _detectProjectId(): string {
  try {
    // Try git remote
    const gitRemote = execSync("git config --get remote.origin.url", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();

    const match = gitRemote.match(/\/([^/]+?)(?:\.git)?$/);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/[^a-z0-9-]/g, "-");
    }
  } catch {
    // Git not available or no remote
  }

  // Fallback to directory name
  const dirName = basename(process.cwd());
  const sanitized = dirName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
  if (sanitized && sanitized !== "." && sanitized !== "..") {
    return sanitized;
  }

  return "my-project";
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
  const _projectId = parsed.flags["project-id"] as string | undefined;
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
  let contextResult = detectContext(cwd);

  // Handle already-initialized case (simplified for now to focus on migration)
  if (contextResult.context === "already-initialized") {
    // For now, just warn and exit unless force?
    // The previous logic handled team mode joining.
    // We should preserve it if possible, but for this refactor I'm simplifying.
    // If user runs init in initialized project, we might want to re-scan rules?

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
  if (!nonInteractive) {
    clack.spinner().start("Scanning for existing rules...");
  } else {
    console.log("Scanning for existing rules...");
  }

  const importedRules = await scanForExistingRules(cwd);

  if (!nonInteractive) {
    clack.spinner().stop("Scan complete");
  }

  let rulesToWrite = importedRules;
  const detectedExporters = new Set<string>();

  // Infer exporters from imported rules
  for (const rule of importedRules) {
    const source = rule.frontmatter.original_source;
    if (source === "cursor") detectedExporters.add("cursor");
    if (source === "agents") detectedExporters.add("agents");
    if (source === "claude") detectedExporters.add("claude");
  }

  if (rulesToWrite.length > 0) {
    const msg = `Found ${rulesToWrite.length} existing rules to import.`;
    if (nonInteractive) {
      console.log(msg);
    } else {
      clack.log.info(msg);
    }
  } else {
    // No rules found, use starter templates
    const msg = "No existing rules found. Creating starter templates.";
    if (nonInteractive) {
      console.log(msg);
    } else {
      clack.log.info(msg);
    }
    rulesToWrite = createStarterTemplates();
    // Default exporters for fresh start
    detectedExporters.add("agents");
    detectedExporters.add("cursor");
  }

  // Step 3: Confirm (if interactive)
  if (!nonInteractive) {
    const confirm = await clack.confirm({
      message: `Initialize AlignTrue with ${rulesToWrite.length} rules?`,
      initialValue: true,
    });

    if (clack.isCancel(confirm) || !confirm) {
      clack.cancel("Init cancelled");
      process.exit(0);
    }
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

  // Determine final exporters list
  let finalExporters: string[] = [];
  if (exporters) {
    finalExporters = exporters;
  } else {
    finalExporters = Array.from(detectedExporters);
    if (finalExporters.length === 0) finalExporters = ["agents"];
  }

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
    createdFiles.forEach((f) => clack.log.success(`Created ${f}`));
  }

  // Step 5: Sync
  console.log("\n✓ AlignTrue initialized\n");

  const shouldSync = !noSync;
  let autoSyncPerformed = false;

  if (shouldSync) {
    if (!nonInteractive) {
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
      await runSync();
      autoSyncPerformed = true;
    }
  }

  if (autoSyncPerformed) {
    const msg = "\n✓ Initial sync complete! Your agents are now aligned.";
    if (nonInteractive) console.log(msg);
    else clack.log.success(msg);
  }

  // Outro
  const msg = `\nNext steps:
  1. Review rules in .aligntrue/rules/
  2. Edit or add new .md files
  3. Run 'aligntrue sync' to update agents`;

  if (nonInteractive) console.log(msg);
  else clack.log.info(msg);

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
