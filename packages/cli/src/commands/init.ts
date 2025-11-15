/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import {
  mkdirSync,
  writeFileSync,
  renameSync,
  readFileSync,
  statSync,
} from "fs";
import { dirname, join } from "path";
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
import { parseNaturalMarkdown } from "@aligntrue/core/parsing/natural-markdown";
import type { Section } from "@aligntrue/core";

// IRDocument type for internal use
interface IRDocument {
  id: string;
  version: string;
  spec_version: string;
  sections: Section[];
  [key: string]: unknown;
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
        "aligntrue init --no-sync",
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
  const contextResult = detectContext(cwd);

  // Step 2: Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    // Detect if this is a team setup
    const paths = getAlignTruePaths(cwd);
    let isTeamMode = false;
    let teamConfig: Partial<AlignTrueConfig> | null = null;

    // Check for lockfile presence (indicates team mode)
    const lockfilePath = join(cwd, ".aligntrue.lock.json");
    let lockfileExists = false;
    try {
      statSync(lockfilePath);
      lockfileExists = true;
    } catch {
      // Lockfile doesn't exist
    }

    try {
      const configContent = readFileSync(paths.config, "utf-8");
      teamConfig = yaml.parse(configContent);
      isTeamMode =
        teamConfig?.mode === "team" || teamConfig?.mode === "enterprise";
    } catch {
      // Ignore errors (file not found, parse errors, etc.)
    }

    // If lockfile exists but config doesn't indicate team mode, assume team mode
    // This handles the case where someone runs init in an existing team repo
    if (lockfileExists && !isTeamMode) {
      isTeamMode = true;
      // If config was parsed but mode wasn't team, update it
      if (teamConfig && !teamConfig.mode) {
        teamConfig.mode = "team";
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
  Lockfile: ${teamConfig?.lockfile?.mode === "strict" ? "strict" : "relaxed"}
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

  // Step 3.5: Check for Ruler installation
  const rulerDir = join(cwd, ".ruler");
  let rulerDirExists = false;
  try {
    rulerDirExists = statSync(rulerDir).isDirectory();
  } catch (error) {
    const isError = error instanceof Error;
    if (isError && "code" in error && error.code === "ENOENT") {
      rulerDirExists = false;
    } else {
      // re-throw other errors
      throw error;
    }
  }
  if (rulerDirExists) {
    if (nonInteractive) {
      console.log("\nDetected Ruler configuration in .ruler/");
      console.log('Run "aligntrue migrate ruler" to import Ruler settings.');
    } else {
      clack.log.warn("Detected Ruler configuration in .ruler/");

      const shouldMigrate = await clack.confirm({
        message: "Import Ruler settings into AlignTrue?",
        initialValue: true,
      });

      if (!clack.isCancel(shouldMigrate) && shouldMigrate) {
        // Run migration
        const { migrate } = await import("./migrate.js");
        await migrate(["ruler", "--yes"]);
        return; // Migration handles full init
      }
    }
  }

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
  // Import feature not implemented - using sections-only format
  let shouldImport = false;
  let shouldMergeMultiple = false;

  // Determine if we should import
  if (importAgent) {
    // Explicit --import flag
    shouldImport = true;
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
  } else if (shouldImport) {
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
  mkdirSync(aligntrueDir, { recursive: true });

  // Generate config with workflow mode based on init choice
  const config: Partial<AlignTrueConfig> = {
    sources: [
      {
        type: "local",
        path: ".aligntrue/.rules.yaml",
      },
    ],
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

  // Build inclusive edit_source based on selected exporters
  const exporterToPattern: Record<string, string> = {
    cursor: ".cursor/rules/*.mdc",
    "agents-md": "AGENTS.md",
    copilot: ".github/copilot-instructions.md",
    "claude-code": "CLAUDE.md",
    aider: ".aider.conf.yml",
  };

  const editSourcePatterns: string[] = [];
  for (const exporter of selectedAgents) {
    const pattern = exporterToPattern[exporter];
    if (pattern) {
      editSourcePatterns.push(pattern);
    }
  }

  // Configure sync settings
  const editSource =
    editSourcePatterns.length > 1 ? editSourcePatterns : editSourcePatterns[0];

  // Set inclusive edit_source based on enabled exporters
  config.sync = {
    ...(editSource && { edit_source: editSource }),
  };

  // Write config atomically (temp + rename)
  const configTempPath = `${configPath}.tmp`;
  writeFileSync(configTempPath, yaml.stringify(config), "utf-8");
  renameSync(configTempPath, configPath);

  // Create native format template or IR fallback
  const createdFiles: string[] = [".aligntrue/config.yaml"];

  // Create AGENTS.md as primary user-editable file
  const agentsMdContent = generateAgentsMdStarter(projectIdValue);
  const agentsMdPath = `${cwd}/AGENTS.md`;
  const agentsMdTempPath = `${agentsMdPath}.tmp`;
  writeFileSync(agentsMdTempPath, agentsMdContent, "utf-8");
  renameSync(agentsMdTempPath, agentsMdPath);
  createdFiles.push("AGENTS.md");

  // Parse AGENTS.md to create IR with sections
  const parseResult = parseNaturalMarkdown(
    agentsMdContent,
    `${projectIdValue}-rules`,
  );

  let pack: IRDocument;
  if (parseResult.sections.length > 0) {
    pack = {
      id: parseResult.metadata.id || `${projectIdValue}-rules`,
      version: parseResult.metadata.version || "1.0.0",
      spec_version: "1",
      sections: parseResult.sections,
    };
  } else {
    // Fallback to empty pack if parsing failed
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

  // Create native format template if applicable
  if (nativeTemplatePath && nativeTemplate) {
    const nativeFullPath = `${cwd}/${nativeTemplatePath}`;
    const nativeDir = dirname(nativeFullPath);

    mkdirSync(nativeDir, { recursive: true });

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

  // Show editable files based on edit_source
  const editSourceDisplay = Array.isArray(config.sync?.edit_source)
    ? config.sync.edit_source.join(", ")
    : config.sync?.edit_source;
  console.log(`  You can edit: ${editSourceDisplay}`);

  if (config.managed?.sections && config.managed.sections.length > 0) {
    console.log(`  Team-managed sections: ${config.managed.sections.length}`);
  }
  console.log("\nTo change settings:");
  console.log("  Edit: .aligntrue/config.yaml");
  console.log("  Or run: aligntrue config set <key> <value>");

  // Step 11: Show success message and next steps (workflow-specific)
  if (noSync) {
    // User explicitly skipped sync
    if (nonInteractive) {
      console.log(
        "\nSkipped sync (--no-sync). Run 'aligntrue sync' when ready.",
      );
    } else {
      const message = `\n✓ Initialization complete\n\nNext: Run 'aligntrue sync' to sync rules to agents\n\nLearn more: ${DOCS_QUICKSTART}`;
      clack.outro(message);
    }
  } else if (nonInteractive) {
    console.log("\nNext: aligntrue sync");
  } else {
    let message = "\nNext steps:\n";

    // Fresh start workflow message
    message += `  1. Edit rules: AGENTS.md\n`;
    message += `  2. Sync to agents: aligntrue sync\n`;
    if (config.mode === "solo") {
      message += `  3. Enable team mode: aligntrue team enable\n`;
    }

    message += `\n💡 Edit rules in any agent file\n`;
    message += `   AGENTS.md, .cursor/*.mdc, etc. - AlignTrue keeps them synced`;

    message += `\n\nLearn more: ${DOCS_QUICKSTART}`;

    clack.outro(message);
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });
}
