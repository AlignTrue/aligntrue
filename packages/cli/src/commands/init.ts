/**
 * Init command - Initialize AlignTrue in a project
 * Handles fresh starts, imports, and team joins with smart context detection
 */

import { existsSync, mkdirSync, writeFileSync, renameSync } from "fs";
import { dirname } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { getAlignTruePaths } from "@aligntrue/core";
import {
  detectContext,
  getContextDescription,
} from "../utils/detect-context.js";
import { detectAgents, getAgentDisplayName } from "../utils/detect-agents.js";
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
  type ArgDefinition,
} from "../utils/command-utilities.js";

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
    description: "Project identifier (default: my-project)",
  },
  {
    flag: "--exporters",
    hasValue: true,
    description: "Comma-separated list of exporters (default: auto-detect)",
  },
];

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
        "aligntrue init --non-interactive --project-id my-app --exporters cursor,agents-md",
        "aligntrue init -y --project-id ci-project",
      ],
      notes: [
        "- Creates .aligntrue/rules.md (source of truth)",
        "- Creates native agent format when detected (e.g., .cursor/rules/*.mdc)",
        "- In non-interactive mode, detected agents are auto-enabled",
        "- If no agents detected, defaults to: cursor, agents-md",
        "- Project ID defaults to: my-project",
      ],
    });
    return;
  }

  // Extract flags
  const nonInteractive =
    (parsed.flags["non-interactive"] as boolean | undefined) ||
    (parsed.flags["yes"] as boolean | undefined) ||
    false;
  const projectId = parsed.flags["project-id"] as string | undefined;
  const exportersArg = parsed.flags["exporters"] as string | undefined;
  const exporters = exportersArg
    ? exportersArg.split(",").map((e) => e.trim())
    : undefined;

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
  if (
    contextResult.context === "import-cursor" ||
    contextResult.context === "import-agents"
  ) {
    const logFn = nonInteractive ? console.log : clack.log.info;
    logFn(
      `\n${getContextDescription(contextResult.context)}: ${contextResult.existingFiles.join(", ")}`,
    );

    if (nonInteractive) {
      console.log("Non-interactive mode: continuing with fresh start template");
      console.log(
        "You can import existing rules later with: aligntrue sync --accept-agent <name>",
      );
    } else {
      // TODO: Implement import flow in Step 17
      // For now, suggest manual setup
      clack.log.warn("Import feature coming in Step 17");
      clack.log.info("For now, you can:");
      clack.log.info("  1. Continue with fresh start (creates template)");
      clack.log.info(
        "  2. Manually copy your rules to .aligntrue/rules.md after init",
      );

      const continueImport = await clack.confirm({
        message: "Continue with fresh start template?",
        initialValue: true,
      });

      if (clack.isCancel(continueImport) || !continueImport) {
        clack.cancel("Init cancelled");
        process.exit(0);
      }
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
    projectIdValue = "my-project";
    console.log("Using default project ID: my-project");
  } else {
    const projectIdResponse = await clack.text({
      message: "Project ID (for rules identifier):",
      placeholder: "my-project",
      initialValue: "my-project",
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

  // Generate minimal config (solo mode defaults)
  const config = {
    exporters:
      selectedAgents.length > 0 ? selectedAgents : ["cursor", "agents-md"],
  };

  // Write config atomically (temp + rename)
  const configTempPath = `${configPath}.tmp`;
  writeFileSync(configTempPath, yaml.stringify(config), "utf-8");
  renameSync(configTempPath, configPath);

  // Create native format template or IR fallback
  const createdFiles: string[] = [".aligntrue/config.yaml"];

  if (nativeTemplatePath && nativeTemplate) {
    // Create native format starter
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

    // ALSO create .aligntrue/rules.md as the source of truth
    const rulesPath = paths.rules;
    const template = getStarterTemplate(projectIdValue);
    const rulesTempPath = `${rulesPath}.tmp`;
    writeFileSync(rulesTempPath, template, "utf-8");
    renameSync(rulesTempPath, rulesPath);
    createdFiles.push(".aligntrue/rules.md");
  } else {
    // Fallback to IR format only
    const rulesPath = paths.rules;
    const template = getStarterTemplate(projectIdValue);

    // Write IR template atomically (temp + rename)
    const rulesTempPath = `${rulesPath}.tmp`;
    writeFileSync(rulesTempPath, template, "utf-8");
    renameSync(rulesTempPath, rulesPath);
    createdFiles.push(".aligntrue/rules.md");
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

  // Step 10: Prompt to run sync
  const editPath = nativeTemplatePath || ".aligntrue/rules.md";
  let runSync = true; // Default for non-interactive

  if (nonInteractive) {
    console.log("\nNon-interactive mode: running sync automatically");
  } else {
    const runSyncResponse = await clack.confirm({
      message: "Run sync now?",
      initialValue: true,
    });

    if (clack.isCancel(runSyncResponse)) {
      clack.outro(
        `\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`,
      );
      process.exit(0);
    }

    runSync = runSyncResponse as boolean;
  }

  if (runSync) {
    if (!nonInteractive) {
      clack.log.info("\nRunning sync...");
    }

    try {
      // Import and run sync command
      const { sync } = await import("./sync.js");
      await sync([]);
    } catch (error) {
      const errorMsg = `Sync failed: ${error instanceof Error ? error.message : String(error)}`;
      const nextSteps = `\n✗ Sync failed but files created successfully\n\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`;

      if (nonInteractive) {
        console.error(errorMsg);
        console.log(nextSteps);
      } else {
        clack.log.error(errorMsg);
        clack.outro(nextSteps);
      }
      process.exit(1);
    }
  } else {
    if (!nonInteractive) {
      clack.outro(
        `\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`,
      );
    } else {
      console.log(
        `\nNext steps:\n  1. Edit rules: ${editPath}\n  2. Run sync: aligntrue sync`,
      );
    }
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });

  // TODO: Add catalog source option when catalog is ready (Phase 2+)
  // Prompt: "Start with: [Template] [From catalog] [Import existing]"
  // If catalog: fetch base-global, base-testing, etc.
  // See: .internal_docs/refactor-plan.md Phase 2, catalog source provider
}
