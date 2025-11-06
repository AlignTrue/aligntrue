/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync, renameSync } from "fs";
import { dirname } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { getAlignTruePaths, type AlignTrueConfig } from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import { detectAgents } from "../utils/detect-agents.js";
import { getStarterTemplate } from "../templates/starter-rules.js";
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
import { executeImport } from "../utils/import-helper.js";
import { execSync } from "child_process";
import { DOCS_BASE_URL, DOCS_QUICKSTART } from "../constants.js";
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
        "- Creates .aligntrue/rules.md (source of truth)",
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
  1. Review rules: .aligntrue/rules.md
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

  // Determine if we should import
  if (importAgent) {
    // Explicit --import flag
    shouldImport = true;
    importedFromAgent = importAgent;
  } else if (
    contextResult.context === "import-cursor" ||
    contextResult.context === "import-cursorrules" ||
    contextResult.context === "import-agents" ||
    contextResult.context === "import-claude" ||
    contextResult.context === "import-crush" ||
    contextResult.context === "import-warp"
  ) {
    // Detected existing agent files - map context to agent name
    const contextToAgent: Record<string, string> = {
      "import-cursor": "cursor",
      "import-cursorrules": "cursorrules",
      "import-agents": "agents-md",
      "import-claude": "claude-md",
      "import-crush": "crush-md",
      "import-warp": "warp-md",
    };
    const detectedAgent = contextToAgent[contextResult.context];

    if (!detectedAgent) {
      // Safety check: context should always map to an agent
      clack.log.warn("Could not map context to agent");
      return;
    }

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
          const previewResult = await executeImport(detectedAgent, cwd, {
            showCoverage: true,
            writeToIR: false,
            interactive: true,
          });

          console.log("");
          const confirmImport = await clack.confirm({
            message: `Import ${previewResult.rules.length} rules?`,
            initialValue: true,
          });

          if (clack.isCancel(confirmImport) || !confirmImport) {
            clack.log.info("Continuing with fresh start template");
          } else {
            shouldImport = true;
            importedFromAgent = detectedAgent;
            importedRules = previewResult.rules;
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

  // Execute import if requested
  if (shouldImport && importedFromAgent) {
    try {
      const importResult = await executeImport(importedFromAgent, cwd, {
        showCoverage: !nonInteractive,
        writeToIR: false, // We'll write later with proper config
        interactive: !nonInteractive,
        projectId: projectId || detectProjectId(),
      });

      importedRules = importResult.rules;

      if (!nonInteractive) {
        console.log("");
        clack.log.success(
          `Imported ${importResult.rules.length} rules from ${importedFromAgent}`,
        );
        if (importResult.coverage) {
          clack.log.info(
            `Coverage: ${importResult.coverage.coveragePercentage}% (${importResult.coverage.confidence} confidence)`,
          );
        }
      } else {
        console.log(
          `Imported ${importResult.rules.length} rules from ${importedFromAgent}`,
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
    console.log("  - .aligntrue/rules.md (source of truth)");
    if (nativeTemplatePath && nativeTemplate) {
      console.log(
        `  - ${nativeTemplatePath} (5 starter rules in native format)`,
      );
    }
  } else {
    clack.log.info("\nWill create:");
    clack.log.info(`  - .aligntrue/config.yaml (minimal solo config)`);
    clack.log.info(`  - .aligntrue/rules.md (source of truth)`);

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
    // Fresh start: use ir_source workflow (edit rules.md, auto-sync disabled)
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

  // Create IR file (either from imported rules or template)
  const rulesPath = paths.rules;
  if (importedRules && importedRules.length > 0) {
    // Write imported rules to IR
    const pack = {
      id: projectIdValue,
      version: "1.0.0",
      spec_version: "1",
      rules: importedRules.map((rule: AlignRule) => {
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

    const yamlContent = yaml.stringify(pack, {
      lineWidth: 0,
      indent: 2,
    });

    const lines: string[] = [];
    lines.push("# AlignTrue Rules");
    lines.push("");
    lines.push(`Rules imported from ${importedFromAgent}.`);
    lines.push("");
    lines.push("```aligntrue");
    lines.push(yamlContent.trim());
    lines.push("```");
    lines.push("");
    lines.push("---");
    lines.push("");
    lines.push("## Next steps");
    lines.push("");
    lines.push("1. **Review imported rules** - Check the rules above");
    lines.push("2. **Customize for your project** - Edit as needed");
    lines.push("3. **Sync to agents** - Run `aligntrue sync`");
    lines.push("");
    lines.push(`Learn more: ${DOCS_BASE_URL}`);

    const content = lines.join("\n");
    const rulesTempPath = `${rulesPath}.tmp`;
    writeFileSync(rulesTempPath, content, "utf-8");
    renameSync(rulesTempPath, rulesPath);
    createdFiles.push(".aligntrue/rules.md");
  } else {
    // Use starter template
    const template = getStarterTemplate(projectIdValue);
    const rulesTempPath = `${rulesPath}.tmp`;
    writeFileSync(rulesTempPath, template, "utf-8");
    renameSync(rulesTempPath, rulesPath);
    createdFiles.push(".aligntrue/rules.md");
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
      message += `     → Syncs rules to other agents (AGENTS.md, etc.)\n`;
      message += `  2. Continue editing in ${importedFromAgent === "cursor" ? "Cursor" : importedFromAgent} or .aligntrue/rules.md\n`;
      message += `     → Auto-pull keeps everything in sync\n\n`;
      message += `💡 Workflow: native_format\n`;
      message += `   Edit in ${importedFromAgent === "cursor" ? "Cursor" : importedFromAgent}, AlignTrue syncs automatically`;
    } else {
      // Fresh start workflow message
      const _editPath = nativeTemplatePath || ".aligntrue/rules.md";
      message += `📝 Next steps:\n`;
      message += `  1. Review: .aligntrue/rules.md\n`;
      message += `  2. Customize for your project\n`;
      message += `  3. Run: aligntrue sync\n\n`;
      message += `💡 Workflow: ir_source\n`;
      message += `   Edit .aligntrue/rules.md as source of truth`;
    }

    message += `\n\nLearn more: ${DOCS_QUICKSTART}`;

    clack.outro(message);
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });
}
