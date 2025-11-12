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
import { execSync } from "child_process";
import { DOCS_QUICKSTART } from "../constants.js";
import { basename } from "path";
import type { IRDocument } from "@aligntrue/markdown-parser";
// AlignRule removed - sections-only format now

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
    process.env["CI"] === "true" ||
    false;
  const useInteractive = shouldUseInteractive(forceNonInteractive);
  const nonInteractive = !useInteractive;

  const mode = parsed.flags["mode"] as string | undefined;
  const projectId = parsed.flags["project-id"] as string | undefined;
  const exportersArg = parsed.flags["exporters"] as string | undefined;
  const exporters = exportersArg
    ? exportersArg.split(",").map((e) => e.trim())
    : undefined;
  const importAgent = parsed.flags["import"] as string | undefined;

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
  const contextResult = detectContext(cwd);

  // Step 2: Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    // Detect if this is a team setup
    const paths = getAlignTruePaths(cwd);
    let isTeamMode = false;
    let teamConfig: Partial<AlignTrueConfig> | null = null;

    if (existsSync(paths.config)) {
      try {
        const configContent = require("fs").readFileSync(paths.config, "utf-8");
        teamConfig = yaml.parse(configContent);
        isTeamMode =
          teamConfig?.mode === "team" || teamConfig?.mode === "enterprise";
      } catch {
        // Ignore parse errors
      }
    }

    if (isTeamMode && !nonInteractive) {
      // Team mode onboarding flow
      clack.log.info("Detected team mode configuration");
      console.log("");

      // Show team configuration summary
      const typedTeamConfig = teamConfig as unknown as AlignTrueConfig;
      const teamSections =
        typedTeamConfig?.resources?.rules?.scopes?.["team"]?.sections || [];
      const teamSectionsDisplay = Array.isArray(teamSections)
        ? teamSections.join(", ")
        : teamSections === "*"
          ? "all sections"
          : "none";

      clack.log.info(`Team Configuration:
  Mode: ${teamConfig?.mode}
  Approval: ${teamConfig?.approval?.internal || "pr_approval"} (${teamConfig?.lockfile?.mode === "strict" ? "strict" : "relaxed"})
  Team sections: ${teamSectionsDisplay}
`);

      const choice = await clack.select({
        message: "How would you like to proceed?",
        options: [
          {
            value: "team-only",
            label: "Use team rules only",
            hint: "No personal rules",
          },
          {
            value: "personal-local",
            label: "Add personal rules (local only)",
            hint: "Private, not version controlled",
          },
          {
            value: "personal-remote",
            label: "Add personal rules (with remote)",
            hint: "Private, version controlled",
          },
          {
            value: "exit",
            label: "Exit (already configured)",
            hint: "No changes needed",
          },
        ],
      });

      if (clack.isCancel(choice) || choice === "exit") {
        clack.outro("No changes made. Run 'aligntrue sync' to get started.");
        process.exit(0);
      }

      // Handle personal rules setup
      if (choice === "personal-remote") {
        const { runRemoteSetupWizard } = await import(
          "../wizards/remote-setup.js"
        );
        await runRemoteSetupWizard("personal", cwd);
      } else if (choice === "personal-local") {
        // Update config to add personal local storage
        if (teamConfig) {
          if (!teamConfig.storage) {
            (teamConfig as unknown as AlignTrueConfig).storage = {};
          }
          if ((teamConfig as unknown as AlignTrueConfig).storage) {
            (teamConfig as unknown as AlignTrueConfig).storage!["personal"] = {
              type: "local",
            };

            // Write updated config
            writeFileSync(paths.config, yaml.stringify(teamConfig), "utf-8");
            clack.log.success("Personal local storage configured");
          }
        }
      }

      clack.outro(`Setup complete! Run 'aligntrue sync' to get started.

Next steps:
  1. Run sync: aligntrue sync
  2. Review generated files: AGENTS.md, .cursor/rules/
  3. Make changes and sync again

Learn more: ${DOCS_QUICKSTART}`);
      process.exit(0);
    }

    // Non-team mode or non-interactive
    const message = `✗ AlignTrue already initialized in this project

${isTeamMode ? "Looks like you're joining an existing team setup." : ""}

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
  // TODO: Implement import for sections-only format
  let importedRules: unknown[] | null = null;
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
        // Import disabled - not implemented for sections-only format
        clack.log.error(
          "Import not implemented. Author rules in AGENTS.md directly.",
        );
        clack.log.info("Continuing with fresh start template");
      } else if (choice === "import") {
        shouldImport = true;
        importedFromAgent = detectedAgent;
      }
      // choice === "fresh": do nothing, continue with template
    }
  }

  // Multi-agent merge disabled - not implemented for sections-only format
  if (shouldMergeMultiple) {
    if (!nonInteractive) {
      clack.log.error(
        "Merge not implemented. Author rules in AGENTS.md directly.",
      );
      clack.log.info("Continuing with fresh start template");
    } else {
      console.error(
        "Merge not implemented. Author rules in AGENTS.md directly.",
      );
      console.log("Continuing with fresh start template");
    }
    importedRules = null;
  } else if (shouldImport && importedFromAgent) {
    // Import disabled - not implemented for sections-only format
    if (!nonInteractive) {
      clack.log.error(
        "Import not implemented. Author rules in AGENTS.md directly.",
      );
      clack.log.info("Continuing with fresh start template");
    } else {
      console.error(
        "Import not implemented. Author rules in AGENTS.md directly.",
      );
      console.log("Continuing with fresh start template");
    }
    importedRules = null;
    importedFromAgent = null;
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

  // Set mode if provided
  if (mode === "team") {
    config.mode = "team";
    // Enable team mode features
    config.modules = {
      lockfile: true,
      bundle: true,
    };
  }

  // Configure sync settings based on whether we imported
  if (importedRules && importedFromAgent) {
    // Imported: set primary agent for reference
    // Let config defaults handle workflow_mode and auto_pull
    config.sync = {
      primary_agent: importedFromAgent,
    };
  } else {
    // Fresh start: let config defaults apply
    // Config will set appropriate edit_source based on enabled exporters
    // and appropriate auto_pull based on mode (solo vs team)
    config.sync = {};
  }

  // Write config atomically (temp + rename)
  const configTempPath = `${configPath}.tmp`;
  writeFileSync(configTempPath, yaml.stringify(config), "utf-8");
  renameSync(configTempPath, configPath);

  // Create native format template or IR fallback
  const createdFiles: string[] = [".aligntrue/config.yaml"];

  // Will hold AGENTS.md content if we create it
  let agentsMdContent: string | null = null;

  // Create AGENTS.md as primary user-editable file (if not imported)
  if (!importedRules) {
    agentsMdContent = generateAgentsMdStarter(projectIdValue);
    const agentsMdPath = `${cwd}/AGENTS.md`;
    const agentsMdTempPath = `${agentsMdPath}.tmp`;
    writeFileSync(agentsMdTempPath, agentsMdContent, "utf-8");
    renameSync(agentsMdTempPath, agentsMdPath);
    createdFiles.push("AGENTS.md");
  }

  // Parse AGENTS.md to create IR with sections (if we created it)
  let pack: IRDocument | undefined;
  if (agentsMdContent) {
    // Use natural markdown parser
    const { buildIRFromNaturalMarkdown } = await import(
      "@aligntrue/markdown-parser"
    );
    const parseResult = buildIRFromNaturalMarkdown(
      agentsMdContent,
      `${projectIdValue}-rules`,
    );

    if (parseResult.document) {
      pack = parseResult.document;
    } else {
      // Fallback to empty pack if parsing failed
      pack = {
        id: `${projectIdValue}-rules`,
        version: "1.0.0",
        spec_version: "1",
        sections: [],
      };
    }
  } else {
    // Fallback: should not reach here (import disabled), but ensure sections
    pack = {
      id: `${projectIdValue}-rules`,
      version: "1.0.0",
      spec_version: "1",
      sections: [],
    };
  }

  // Write pure YAML to .aligntrue/.rules.yaml (internal)
  const warningComment = `# WARNING: This file is auto-generated by AlignTrue
# DO NOT EDIT DIRECTLY - Edit AGENTS.md or agent files (.cursor/*.mdc, CLAUDE.md, etc.) instead
# Changes to this file will be overwritten on next sync
# See: https://aligntrue.ai/docs/concepts/sync-behavior

`;
  const yamlContent =
    warningComment +
    yaml.stringify(pack, {
      lineWidth: 0,
      indent: 2,
    });

  const rulesPath = paths.rules;
  const rulesTempPath = `${rulesPath}.tmp`;
  writeFileSync(rulesTempPath, yamlContent, "utf-8");
  renameSync(rulesTempPath, rulesPath);
  createdFiles.push(".aligntrue/.rules.yaml (internal)");

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

  // Step 10: Show configuration summary
  console.log("\n✓ AlignTrue initialized\n");
  console.log("Current configuration:");
  console.log(`  Mode: ${config.mode || "solo"}`);
  console.log(
    `  Two-way sync: ${config.sync?.two_way !== false ? "enabled" : "disabled"}`,
  );
  console.log(`  Merge strategy: last-write-wins (automatic)`);
  console.log(`  Exporters: ${config.exporters?.join(", ") || "none"}`);
  if (config.managed?.sections && config.managed.sections.length > 0) {
    console.log(`  Team-managed sections: ${config.managed.sections.length}`);
  }
  console.log("\nTo change settings:");
  console.log("  Edit: .aligntrue/config.yaml");
  console.log("  Or run: aligntrue config set <key> <value>");

  // Step 11: Show success message and next steps (workflow-specific)
  if (nonInteractive) {
    console.log("\nNext: aligntrue sync");
  } else {
    let message = "\nNext steps:\n";

    if (importedRules && importedFromAgent) {
      // Imported workflow message
      message += `  1. Run: aligntrue sync\n`;
      message += `     → Syncs rules to all agents (AGENTS.md, Cursor, etc.)\n`;
      message += `  2. Edit rules in any agent file - they stay synced\n`;
      message += `     → Edit AGENTS.md, .cursor/*.mdc, or other agent files\n\n`;
      message += `💡 Your imported rules are ready!\n`;
      message += `   AlignTrue keeps all agent files in sync automatically`;
    } else {
      // Fresh start workflow message
      message += `  1. Edit rules: AGENTS.md\n`;
      message += `  2. Sync to agents: aligntrue sync\n`;
      if (config.mode === "solo") {
        message += `  3. Enable team mode: aligntrue team enable\n`;
      }
      message += `\n💡 Edit rules in any agent file\n`;
      message += `   AGENTS.md, .cursor/*.mdc, etc. - AlignTrue keeps them synced`;
    }

    message += `\n\nLearn more: ${DOCS_QUICKSTART}`;

    clack.outro(message);
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });
}
