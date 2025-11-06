/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync, renameSync } from "fs";
import { dirname } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import {
  getAlignTruePaths,
  type AlignTrueConfig,
  importFromAgent,
} from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import { detectAgents } from "../utils/detect-agents.js";
import { STARTER_RULES_CANONICAL } from "../templates/starter-rules-canonical.js";
import {
  generateCursorStarter,
  getCursorStarterPath,
} from "../templates/cursor-starter.js";
import {
  generateAgentsMdStarter,
  getAgentsMdStarterPath,
} from "../templates/agents-md-starter.js";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  shouldUseInteractive,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { importAndMergeFromMultipleAgents } from "../utils/import-helper.js";
import { execSync } from "child_process";
import { DOCS_QUICKSTART } from "../constants.js";
import { basename } from "path";
import { AlignRule } from "@aligntrue/schema";

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
  {
    flag: "--import",
    hasValue: true,
    description: "Import from agent format (cursor, agents-md)",
  },
];

/**
 * Detect project ID intelligently from git repo or directory name
 *
 * Tries in order:
 * 1. Git remote URL (extracts repo name)
 * 2. Current directory name
 * 3. Fallback to "my-project"
 *
 * @returns Sanitized project ID
 */
function detectProjectId(): string {
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
        "aligntrue init --import cursor",
        "aligntrue init --yes --import agents-md",
        "aligntrue init --non-interactive --project-id my-app --exporters cursor,agents-md",
      ],
      notes: [
        "- Creates AGENTS.md (primary editing file) and .aligntrue/.rules.yaml (internal)",
        "- Detects existing agent files and offers import",
        "- Use --import <agent> to import from specific format",
        "- In non-interactive mode, detected agents are auto-enabled",
        "- If no agents detected, defaults to: cursor, agents-md",
        "- Workflow mode auto-configured based on init choice",
      ],
    });
    return;
  }

  // Extract flags
  const forceNonInteractive =
    (parsed.flags["non-interactive"] as boolean | undefined) ||
    (parsed.flags["yes"] as boolean | undefined) ||
    false;
  const useInteractive = shouldUseInteractive(forceNonInteractive);
  const nonInteractive = !useInteractive;

  const projectId = parsed.flags["project-id"] as string | undefined;
  const exportersArg = parsed.flags["exporters"] as string | undefined;
  const exporters = exportersArg
    ? exportersArg.split(",").map((e) => e.trim())
    : undefined;
  const importAgent = parsed.flags["import"] as string | undefined;

  if (!nonInteractive) {
    clack.intro("AlignTrue Init");
  } else {
    console.log("AlignTrue Init (non-interactive mode)");
  }

  const cwd = process.cwd();

  // Step 1: Detect project context
  const contextResult = detectContext(cwd);

  // Step 2: Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    const message = `✗ AlignTrue already initialized in this project

Looks like you're joining an existing team setup.

Next steps:
  1. Review rules: AGENTS.md or .aligntrue/.rules.yaml
  2. Run sync: aligntrue sync

Already have local rules to merge? Run: aligntrue import
Want to reinitialize? Remove .aligntrue/ first (warning: destructive)`;

    if (nonInteractive) {
      console.log(message);
    } else {
      clack.outro(message);
    }
    process.exit(0);
  }

  // Step 3: Detect agents
  let spinner: ReturnType<typeof clack.spinner> | null = null;

  if (!nonInteractive) {
    spinner = clack.spinner();
    spinner.start("Detecting AI coding agents");
  }

  const agentResult = detectAgents(cwd);

  if (!nonInteractive && spinner) {
    spinner.stop("Agent detection complete");
  }

  if (agentResult.detected.length > 0) {
    const displayNames = agentResult.detected
      .map((name) => agentResult.displayNames.get(name) || name)
      .join(", ");

    if (nonInteractive) {
      console.log(`Detected agents: ${displayNames}`);
    } else {
      clack.log.success(`Detected: ${displayNames}`);
    }
  } else {
    if (nonInteractive) {
      console.log("No agents detected, using defaults: cursor, agents-md");
    } else {
      clack.log.info("No agents detected (you can still initialize)");
    }
  }

  // Step 4: Handle import flows
  let importedRules: AlignRule[] | null = null;
  let importedFromAgent: string | null = null;
  let shouldImport = false;
  let shouldMergeMultiple = false;

  // Determine if we should import
  if (importAgent) {
    // Explicit --import flag
    shouldImport = true;
    importedFromAgent = importAgent;
  } else if (contextResult.allDetectedAgents.length > 1) {
    // Multiple agents detected - offer merge
    if (nonInteractive) {
      console.log(
        `\nDetected rules in ${contextResult.allDetectedAgents.length} agents:`,
      );
      for (const { agent, files } of contextResult.allDetectedAgents) {
        console.log(`  • ${agent}: ${files.join(", ")}`);
      }
      console.log("Non-interactive mode: continuing with fresh start template");
      console.log("Tip: Use --import <agent> to import from a specific agent");
    } else {
      console.log("");
      clack.log.info("Found rules in multiple agents:");
      for (const { agent, files } of contextResult.allDetectedAgents) {
        console.log(`  • ${agent}: ${files.join(", ")}`);
      }
      console.log("");

      const choice = await clack.select({
        message: "What would you like to do?",
        options: [
          {
            value: "merge",
            label: "Import and merge all (recommended)",
            hint: "Keeps all rules, renames duplicates",
          },
          {
            value: "choose",
            label: "Choose one agent as source",
            hint: "Others will be overwritten",
          },
          {
            value: "fresh",
            label: "Start fresh (ignore existing rules)",
            hint: "Create new template",
          },
        ],
      });

      if (clack.isCancel(choice)) {
        clack.cancel("Init cancelled");
        process.exit(0);
      }

      if (choice === "merge") {
        shouldMergeMultiple = true;
      } else if (choice === "choose") {
        // Let user pick one agent
        const agentChoice = await clack.select({
          message: "Which agent should be the source?",
          options: contextResult.allDetectedAgents.map(({ agent, files }) => ({
            value: agent,
            label: agent,
            hint: files.join(", "),
          })),
        });

        if (clack.isCancel(agentChoice)) {
          clack.cancel("Init cancelled");
          process.exit(0);
        }

        shouldImport = true;
        importedFromAgent = agentChoice as string;
      }
      // choice === "fresh": do nothing
    }
  } else if (
    contextResult.allDetectedAgents.length === 1 &&
    contextResult.allDetectedAgents[0]
  ) {
    // Single agent detected
    const detectedAgent = contextResult.allDetectedAgents[0].agent;

    if (nonInteractive) {
      // Non-interactive without --import flag: skip import (safe default)
      console.log(
        `\nDetected: ${contextResult.existingFiles.join(", ")} (${contextResult.context})`,
      );
      console.log("Non-interactive mode: continuing with fresh start template");
      console.log(
        `Tip: Use --import ${detectedAgent} to import existing rules`,
      );
    } else {
      // Interactive: offer import as primary option
      console.log("");
      clack.log.info(
        `Found existing rules: ${contextResult.existingFiles.join(", ")}`,
      );
      console.log("");

      const choice = await clack.select({
        message: "What would you like to do?",
        options: [
          {
            value: "import",
            label: "Import these rules (recommended)",
            hint: "Convert to AlignTrue format",
          },
          {
            value: "preview",
            label: "Preview import coverage first",
            hint: "See what will be imported",
          },
          {
            value: "fresh",
            label: "Start fresh (ignore existing rules)",
            hint: "Create new template",
          },
        ],
      });

      if (clack.isCancel(choice)) {
        clack.cancel("Init cancelled");
        process.exit(0);
      }

      if (choice === "preview") {
        // Show coverage report, then ask again
        try {
          const previewRules = await importFromAgent(detectedAgent, cwd);

          console.log("");
          clack.log.info(
            `Found ${previewRules.length} rules in ${detectedAgent}`,
          );

          const confirmImport = await clack.confirm({
            message: `Import ${previewRules.length} rules?`,
            initialValue: true,
          });

          if (clack.isCancel(confirmImport) || !confirmImport) {
            clack.log.info("Continuing with fresh start template");
          } else {
            shouldImport = true;
            importedFromAgent = detectedAgent;
            importedRules = previewRules;
          }
        } catch (_error) {
          clack.log.error(
            `Preview failed: ${_error instanceof Error ? _error.message : String(_error)}`,
          );
          clack.log.info("Continuing with fresh start template");
        }
      } else if (choice === "import") {
        shouldImport = true;
        importedFromAgent = detectedAgent;
      }
      // choice === "fresh": do nothing, continue with template
    }
  }

  // Execute multi-agent merge if requested
  if (shouldMergeMultiple) {
    try {
      console.log("");
      clack.log.step("Importing and merging rules from all agents...");

      const mergeResult = await importAndMergeFromMultipleAgents(
        contextResult.allDetectedAgents,
        cwd,
      );

      importedRules = mergeResult.rules;

      console.log("");
      clack.log.success(
        `Merged ${mergeResult.stats.totalRules} rules from ${contextResult.allDetectedAgents.length} agents`,
      );
      console.log(`  • ${mergeResult.stats.uniqueRules} unique rules`);

      if (mergeResult.duplicates.length > 0) {
        console.log(
          `  • ${mergeResult.duplicates.length} duplicates renamed\n`,
        );
        clack.log.warn("Duplicate rules found (kept both versions):");
        for (const dup of mergeResult.duplicates) {
          console.log(`  - ${dup.originalId} → ${dup.renamedId}`);
        }
        console.log(
          "\nNote: We match duplicates by rule ID only, not by content.",
        );
        console.log("Review your rules and remove duplicates you don't need.");
        console.log(
          "Edit in any agent file (AGENTS.md, .cursor/*.mdc, etc.) - they stay synced.",
        );
      }
    } catch (_error) {
      clack.log.error(
        `Merge failed: ${_error instanceof Error ? _error.message : String(_error)}`,
      );
      clack.log.info("Continuing with fresh start template");
      importedRules = null;
    }
  } else if (shouldImport && importedFromAgent) {
    // Execute single-agent import if requested
    try {
      importedRules = await importFromAgent(importedFromAgent, cwd);

      if (!nonInteractive) {
        console.log("");
        clack.log.success(
          `Imported ${importedRules.length} rules from ${importedFromAgent}`,
        );
      } else {
        console.log(
          `Imported ${importedRules.length} rules from ${importedFromAgent}`,
        );
      }
    } catch (_error) {
      if (!nonInteractive) {
        clack.log.error(
          `Import failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
        clack.log.info("Continuing with fresh start template");
      } else {
        console.error(
          `Import failed: ${_error instanceof Error ? _error.message : String(_error)}`,
        );
        console.log("Continuing with fresh start template");
      }
      importedRules = null;
      importedFromAgent = null;
    }
  }

  // Step 5: Select agents to enable
  let selectedAgents: string[];

  if (exporters) {
    // CLI args override detection
    selectedAgents = exporters;
    const msg = `Using exporters from CLI: ${selectedAgents.join(", ")}`;
    if (nonInteractive) {
      console.log(msg);
    } else {
      clack.log.info(msg);
    }
  } else if (nonInteractive) {
    // Non-interactive: use detected or defaults
    if (agentResult.detected.length > 0) {
      selectedAgents = agentResult.detected;
      console.log(`Will enable: ${agentResult.detected.join(", ")}`);
    } else {
      selectedAgents = ["cursor", "agents-md"];
      console.log("Will enable: cursor, agents-md (defaults)");
    }
  } else if (agentResult.detected.length === 0) {
    // No agents detected - use defaults
    clack.log.info("\nUsing default exporters: cursor, agents-md");
    selectedAgents = ["cursor", "agents-md"];
  } else if (agentResult.detected.length <= 3) {
    // ≤3 detected: enable all automatically
    selectedAgents = agentResult.detected;
    const displayNames = selectedAgents
      .map((name) => agentResult.displayNames.get(name) || name)
      .join(", ");
    clack.log.success(`Will enable: ${displayNames}`);
  } else {
    // >3 detected: prompt to select
    const options = agentResult.detected.map((name) => ({
      value: name,
      label: agentResult.displayNames.get(name) || name,
    }));

    const selected = await clack.multiselect({
      message: "Select agents to enable:",
      options,
      initialValues: agentResult.detected,
      required: false,
    });

    if (clack.isCancel(selected)) {
      clack.cancel("Init cancelled");
      process.exit(0);
    }

    selectedAgents = selected as string[];
  }

  // Step 6: Get project ID for template
  let projectIdValue: string;

  if (projectId) {
    projectIdValue = projectId;
    const msg = `Using project ID: ${projectIdValue}`;
    if (nonInteractive) {
      console.log(msg);
    } else {
      clack.log.info(msg);
    }
  } else if (nonInteractive) {
    projectIdValue = detectProjectId();
    console.log(`Using detected project ID: ${projectIdValue}`);
  } else {
    const detectedId = detectProjectId();
    const projectIdResponse = await clack.text({
      message: "Project ID (for rules identifier):",
      placeholder: detectedId,
      initialValue: detectedId,
      validate: (value) => {
        if (!value || value.trim().length === 0) {
          return "Project ID is required";
        }
        if (!/^[a-z0-9-]+$/.test(value)) {
          return "Use lowercase letters, numbers, and hyphens only";
        }
      },
    });

    if (clack.isCancel(projectIdResponse)) {
      clack.cancel("Init cancelled");
      process.exit(0);
    }

    projectIdValue = projectIdResponse as string;
  }

  // Step 7: Determine primary agent and template format
  const primaryAgent = selectedAgents[0] || "cursor";
  const useNativeFormat = [
    "cursor",
    "copilot",
    "claude-code",
    "aider",
    "agents-md",
  ].includes(primaryAgent);

  let nativeTemplatePath: string | null = null;
  let nativeTemplate: string | null = null;

  if (useNativeFormat) {
    if (primaryAgent === "cursor") {
      nativeTemplatePath = getCursorStarterPath();
      nativeTemplate = generateCursorStarter();
    } else {
      // For all other agents, use AGENTS.md format
      nativeTemplatePath = getAgentsMdStarterPath();
      nativeTemplate = generateAgentsMdStarter();
    }
  }

  // Step 8: Confirm file creation
  const paths = getAlignTruePaths(cwd);
  const aligntrueDir = paths.aligntrueDir;
  const configPath = paths.config;

  if (nonInteractive) {
    console.log("\nCreating files:");
    console.log("  - .aligntrue/config.yaml (minimal solo config)");
    console.log("  - .aligntrue/.rules.yaml (internal IR, auto-generated)");
    console.log("  - AGENTS.md (primary editing file)");
    if (nativeTemplatePath && nativeTemplate) {
      console.log(
        `  - ${nativeTemplatePath} (5 starter rules in native format)`,
      );
    }
  } else {
    clack.log.info("\nWill create:");
    clack.log.info(`  - .aligntrue/config.yaml (minimal solo config)`);
    clack.log.info(`  - .aligntrue/.rules.yaml (internal IR, auto-generated)`);
    clack.log.info(`  - AGENTS.md (primary editing file)`);

    if (nativeTemplatePath && nativeTemplate) {
      clack.log.info(
        `  - ${nativeTemplatePath} (5 starter rules in native format)`,
      );
    }

    const confirmCreate = await clack.confirm({
      message: "Continue?",
      initialValue: true,
    });

    if (clack.isCancel(confirmCreate) || !confirmCreate) {
      clack.cancel("Init cancelled");
      process.exit(0);
    }
  }

  // Step 9: Create files
  if (!nonInteractive && spinner) {
    spinner.start("Creating files");
  }

  // Create .aligntrue/ directory
  if (!existsSync(aligntrueDir)) {
    mkdirSync(aligntrueDir, { recursive: true });
  }

  // Generate config with workflow mode based on init choice
  const config: Partial<AlignTrueConfig> = {
    exporters:
      selectedAgents.length > 0 ? selectedAgents : ["cursor", "agents-md"],
  };

  // Configure workflow mode based on whether we imported
  if (importedRules && importedFromAgent) {
    // Imported: use native_format workflow (edit agent files, auto-sync enabled)
    config.sync = {
      workflow_mode: "native_format",
      auto_pull: true,
      primary_agent: importedFromAgent,
    };
  } else {
    // Fresh start: use ir_source workflow (IR as source of truth)
    config.sync = {
      workflow_mode: "ir_source",
      auto_pull: false,
    };
  }

  // Write config atomically (temp + rename)
  const configTempPath = `${configPath}.tmp`;
  writeFileSync(configTempPath, yaml.stringify(config), "utf-8");
  renameSync(configTempPath, configPath);

  // Create native format template or IR fallback
  const createdFiles: string[] = [".aligntrue/config.yaml"];

  // Create IR file (.aligntrue/.rules.yaml) - internal, auto-generated
  const rulesPath = paths.rules;
  const pack = {
    id: `${projectIdValue}-rules`,
    version: "1.0.0",
    spec_version: "1",
    rules: (importedRules || STARTER_RULES_CANONICAL).map((rule: AlignRule) => {
      const ruleData: Partial<AlignRule> = {
        id: rule.id,
        severity: rule.severity,
        applies_to: rule.applies_to,
      };

      if (rule.guidance) ruleData["guidance"] = rule.guidance;
      if (rule.tags && rule.tags.length > 0) ruleData["tags"] = rule.tags;
      if (rule.mode) ruleData["mode"] = rule.mode;
      if (rule.title) ruleData["title"] = rule.title;
      if (rule.description) ruleData["description"] = rule.description;
      if (rule.vendor) ruleData["vendor"] = rule.vendor;
      if (rule.check) ruleData["check"] = rule.check;
      if (rule.autofix) ruleData["autofix"] = rule.autofix;

      return ruleData;
    }),
  };

  // Write pure YAML to .aligntrue/.rules.yaml (internal)
  const yamlContent = yaml.stringify(pack, {
    lineWidth: 0,
    indent: 2,
  });

  const rulesTempPath = `${rulesPath}.tmp`;
  writeFileSync(rulesTempPath, yamlContent, "utf-8");
  renameSync(rulesTempPath, rulesPath);
  createdFiles.push(".aligntrue/.rules.yaml (internal)");

  // Create AGENTS.md as primary user-editable file (if not imported)
  if (!importedRules) {
    const agentsMdContent = generateAgentsMdStarter();
    const agentsMdPath = `${cwd}/AGENTS.md`;
    const agentsMdTempPath = `${agentsMdPath}.tmp`;
    writeFileSync(agentsMdTempPath, agentsMdContent, "utf-8");
    renameSync(agentsMdTempPath, agentsMdPath);
    createdFiles.push("AGENTS.md");
  }

  // Create native format template if applicable (and not imported)
  if (nativeTemplatePath && nativeTemplate && !importedRules) {
    const nativeFullPath = `${cwd}/${nativeTemplatePath}`;
    const nativeDir = dirname(nativeFullPath);

    if (!existsSync(nativeDir)) {
      mkdirSync(nativeDir, { recursive: true });
    }

    // Write native template atomically (temp + rename)
    const nativeTempPath = `${nativeFullPath}.tmp`;
    writeFileSync(nativeTempPath, nativeTemplate, "utf-8");
    renameSync(nativeTempPath, nativeFullPath);
    createdFiles.push(nativeTemplatePath);
  }

  if (!nonInteractive && spinner) {
    spinner.stop("Files created");
  }

  if (nonInteractive) {
    console.log("\nCreated files:");
    createdFiles.forEach((file) => {
      console.log(`  ✓ ${file}`);
    });
  } else {
    createdFiles.forEach((file) => {
      clack.log.success(`✓ Created ${file}`);
    });
  }

  // Step 10: Show success message and next steps (workflow-specific)
  if (nonInteractive) {
    console.log("\nSuccess! Next: aligntrue sync");
  } else {
    let message = "Success! AlignTrue is initialized.\n\n";

    if (importedRules && importedFromAgent) {
      // Imported workflow message
      message += `📝 Next steps:\n`;
      message += `  1. Run: aligntrue sync\n`;
      message += `     → Syncs rules to all agents (AGENTS.md, Cursor, etc.)\n`;
      message += `  2. Edit rules in any agent file - they stay synced\n`;
      message += `     → Edit AGENTS.md, .cursor/*.mdc, or other agent files\n\n`;
      message += `💡 Your imported rules are ready!\n`;
      message += `   AlignTrue keeps all agent files in sync automatically`;
    } else {
      // Fresh start workflow message
      message += `📝 Next steps:\n`;
      message += `  1. Review: AGENTS.md (your starter rules)\n`;
      message += `  2. Customize for your project\n`;
      message += `  3. Run: aligntrue sync\n`;
      message += `     → Syncs to all your agents\n\n`;
      message += `💡 Edit rules in any agent file\n`;
      message += `   AGENTS.md, .cursor/*.mdc, etc. - AlignTrue keeps them synced`;
    }

    message += `\n\nLearn more: ${DOCS_QUICKSTART}`;

    clack.outro(message);
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });
}
