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
import { join, resolve, basename, relative } from "path";
import * as clack from "@clack/prompts";
import * as yaml from "yaml";
import { getAlignTruePaths, type AlignTrueConfig } from "@aligntrue/core";
import { detectContext } from "../utils/detect-context.js";
import { getAgentDisplayName } from "../utils/detect-agents.js";
import { generateAgentsMdStarter } from "../templates/agents-starter.js";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { shouldUseInteractive } from "../utils/tty-helper.js";
import { execSync } from "child_process";
import { DOCS_QUICKSTART } from "../constants.js";
import { parseNaturalMarkdown } from "@aligntrue/core/parsing/natural-markdown";
import type { Section } from "@aligntrue/core";
import {
  detectAgentFiles,
  isFormatImportable,
  type AgentFileCandidate,
  type AgentFileFormat,
} from "../utils/agent-file-discovery.js";
import {
  parseAgentsMd,
  parseCursorMdc,
  parseGenericMarkdown,
  type AlignPack,
} from "@aligntrue/schema";
import type {
  EditedFile,
  SectionConflict,
} from "@aligntrue/core/sync/multi-file-parser";
import {
  buildNextStepsMessage,
  type NextStepsSyncGuidance,
} from "../utils/next-steps.js";

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
    description: "Import from agent format (cursor, agents)",
  },
];

type ImportParser = "cursor" | "agents" | "generic";

const EDIT_SOURCE_PATTERNS: Record<string, string> = {
  cursor: ".cursor/rules/*.mdc",
  agents: "AGENTS.md",
  copilot: ".github/copilot-instructions.md",
  claude: "CLAUDE.md",
  crush: "CRUSH.md",
  warp: "WARP.md",
  gemini: "GEMINI.md",
  windsurf: "WINDSURF.md",
  aider: ".aider.conf.yml",
  opencode: "OPENCODE.md",
  roocode: "ROOCODE.md",
  zed: "ZED.md",
};

/**
 * Detect project ID intelligently from git repo or directory name
 *
 * Tries in order:
 * 1. Git remote URL (extracts repo name)
 * 2. Current directory name
 * 3. Fallback to "my-project"
 *
 * Sanitization rules:
 * - Lowercase everything
 * - Replace spaces, underscores, emoji, and other non-alphanumerics with hyphens
 * - Result contains only `[a-z0-9-]`
 *
 * Examples:
 * - "My Project 🚀" -> "my-project"
 * - "awesome_app" -> "awesome-app"
 *
 * @returns Sanitized project ID safe for config usage
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

function parserForFormat(format: AgentFileFormat): ImportParser | null {
  switch (format) {
    case "cursor-mdc":
      return "cursor";
    case "agents":
      return "agents";
    case "generic-markdown":
      return "generic";
    default:
      return null;
  }
}

function getEditSourcePatternForAgent(
  candidate: AgentFileCandidate,
): string | null {
  const pattern = EDIT_SOURCE_PATTERNS[candidate.agent];
  if (pattern) {
    return pattern;
  }
  return candidate.relativePath || candidate.absolutePath;
}

function shouldOfferSync(options: {
  createdAgentsTemplate: boolean;
  importedAgentFileCount: number;
}): boolean {
  const totalEditableSources =
    options.importedAgentFileCount + (options.createdAgentsTemplate ? 1 : 0);
  return totalEditableSources > 1;
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
        "aligntrue init --yes --import agents",
        "aligntrue init --non-interactive --project-id my-app --exporters cursor,agents",
      ],
      notes: [
        "- Creates AGENTS.md (primary editing file) and .aligntrue/.rules.yaml (internal)",
        "- Detects existing agent files and offers import",
        "- Use --import <agent> to import from specific format",
        "- In non-interactive mode, detected agents are auto-enabled",
        "- If no agents detected, defaults to: cursor, agents",
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
  const paths = getAlignTruePaths(cwd);
  let contextResult = detectContext(cwd);
  // Step 2: Handle already-initialized case
  if (contextResult.context === "already-initialized") {
    // Detect if this is a team setup
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
        clack.outro(
          "No changes made. Edit AGENTS.md or your agent files and run 'aligntrue sync' to merge them.",
        );
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

Want to reinitialize? Remove .aligntrue/ first (warning: destructive)`;

    if (nonInteractive) {
      console.log(message);
    } else {
      clack.outro(message);
    }
    process.exit(0);
  }

  // Step 3: Check for legacy Ruler installs
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

  // Step 4: Detect existing agent files and plan imports
  const detectedAgentFiles = detectAgentFiles(cwd);
  const importFilter = importAgent
    ? importAgent
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : null;

  const importableCandidates = detectedAgentFiles.filter((candidate) => {
    if (!candidate.importable) {
      return false;
    }
    if (!importFilter) return true;
    return importFilter.includes(candidate.agent);
  });

  if (importFilter && importableCandidates.length === 0) {
    const message = `No agent files found for --import ${importAgent}.`;
    if (nonInteractive) {
      console.error(message);
    } else {
      clack.log.warn(message);
    }
  }

  const unsupportedCandidates = detectedAgentFiles.filter(
    (candidate) => !candidate.importable,
  );

  if (unsupportedCandidates.length > 0) {
    const logFn = nonInteractive ? console.warn : clack.log.warn;
    logFn(
      "\nDetected agent files we cannot import yet (they will remain untouched):",
    );
    unsupportedCandidates.forEach((candidate) => {
      logFn(
        `  • ${candidate.displayName}: ${candidate.relativePath} (manual migration required)`,
      );
    });
  }

  let selectedImportCandidates: AgentFileCandidate[] = [];
  let manualCandidate: AgentFileCandidate | null = null;
  let createAgentsTemplate = false;

  if (importableCandidates.length > 0) {
    if (nonInteractive) {
      selectedImportCandidates = importableCandidates;
      console.log(
        `Importing ${selectedImportCandidates.length} existing agent file${selectedImportCandidates.length === 1 ? "" : "s"}`,
      );
    } else {
      const options = importableCandidates.map((candidate) => ({
        value: candidate.absolutePath,
        label: candidate.displayName,
        hint: candidate.relativePath,
      }));

      const selection = await clack.multiselect({
        message: "Select agent files to import (all selected by default):",
        options,
        initialValues: options.map((option) => option.value),
        required: false,
      });

      if (clack.isCancel(selection)) {
        clack.cancel("Init cancelled");
        process.exit(0);
      }

      const selectedValues = new Set(selection as string[]);
      selectedImportCandidates = importableCandidates.filter((candidate) =>
        selectedValues.has(candidate.absolutePath),
      );

      if (selectedImportCandidates.length === 0) {
        const confirmFreshStart = await clack.confirm({
          message:
            "No agent files selected. Start with a fresh template instead?",
          initialValue: false,
        });

        if (clack.isCancel(confirmFreshStart)) {
          clack.cancel("Init cancelled");
          process.exit(0);
        }

        if (confirmFreshStart) {
          createAgentsTemplate = true;
        } else {
          clack.cancel("Init cancelled");
          process.exit(0);
        }
      }
    }
  } else {
    if (nonInteractive) {
      createAgentsTemplate = true;
      console.log(
        "No agent files detected. Creating AGENTS.md starter so you have an editable file.",
      );
    } else {
      const choice = await clack.select({
        message: "No agent files detected. How would you like to proceed?",
        options: [
          {
            value: "create-agents",
            label: "Create AGENTS.md starter (recommended)",
            hint: "Adds a starter markdown file for editing",
          },
          {
            value: "import-path",
            label: "Import from an existing file path",
            hint: "Provide a path to a markdown or Cursor file",
          },
          {
            value: "skip",
            label: "Skip for now",
            hint: "I'll add files later (not recommended)",
          },
        ],
      });

      if (clack.isCancel(choice)) {
        clack.cancel("Init cancelled");
        process.exit(0);
      }

      if (choice === "create-agents") {
        createAgentsTemplate = true;
      } else if (choice === "import-path") {
        manualCandidate = await promptForManualImport(cwd);
        if (manualCandidate) {
          selectedImportCandidates = [manualCandidate];
        } else {
          createAgentsTemplate = true;
        }
      } else {
        const confirmSkip = await clack.confirm({
          message:
            "Without an agent file, AlignTrue cannot sync anything. Continue anyway?",
          initialValue: false,
        });
        if (clack.isCancel(confirmSkip) || !confirmSkip) {
          clack.cancel("Init cancelled");
          process.exit(0);
        }
        clack.log.warn(
          "Continuing without an editable agent file. Add one before running sync.",
        );
      }
    }
  }

  const selectedAgentsSet = new Set<string>();
  selectedImportCandidates.forEach((candidate) =>
    selectedAgentsSet.add(candidate.agent),
  );

  if (manualCandidate) {
    selectedAgentsSet.add(manualCandidate.agent);
  }

  let selectedAgents: string[];
  if (exporters) {
    selectedAgents = exporters;
    const msg = `Using exporters from CLI: ${selectedAgents.join(", ")}`;
    if (nonInteractive) {
      console.log(msg);
    } else {
      clack.log.info(msg);
    }
  } else if (selectedAgentsSet.size > 0) {
    selectedAgents = Array.from(selectedAgentsSet);
  } else {
    selectedAgents = ["cursor", "agents"];
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

  // Step 8: Confirm file creation
  const aligntrueDir = paths.aligntrueDir;
  const configPath = paths.config;

  if (nonInteractive) {
    console.log("\nCreating files:");
    console.log("  - .aligntrue/config.yaml (minimal solo config)");
    console.log("  - .aligntrue/.rules.yaml (internal IR, auto-generated)");
    if (createAgentsTemplate) {
      console.log("  - AGENTS.md (starter template)");
    }
  } else {
    clack.log.info("\nWill create:");
    clack.log.info(`  - .aligntrue/config.yaml (minimal solo config)`);
    clack.log.info(`  - .aligntrue/.rules.yaml (internal IR, auto-generated)`);
    if (createAgentsTemplate) {
      clack.log.info(`  - AGENTS.md (starter template)`);
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
      selectedAgents.length > 0 ? selectedAgents : ["cursor", "agents"],
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

  const editSourceSet = new Set<string>();
  selectedAgents.forEach((agent) => {
    const pattern = EDIT_SOURCE_PATTERNS[agent];
    if (pattern) {
      editSourceSet.add(pattern);
    }
  });
  for (const candidate of selectedImportCandidates) {
    const pattern = getEditSourcePatternForAgent(candidate);
    if (pattern) {
      editSourceSet.add(pattern);
    }
  }
  if (createAgentsTemplate) {
    editSourceSet.add("AGENTS.md");
  }

  const editSourceValues = Array.from(editSourceSet);
  const editSource =
    editSourceValues.length === 0
      ? undefined
      : editSourceValues.length === 1
        ? editSourceValues[0]
        : editSourceValues;

  config.sync = {
    ...(editSource && { edit_source: editSource }),
  };

  // Write config atomically (temp + rename)
  const configTempPath = `${configPath}.tmp`;
  writeFileSync(configTempPath, yaml.stringify(config), "utf-8");
  renameSync(configTempPath, configPath);

  // Create native format template or IR fallback
  const createdFiles: string[] = [".aligntrue/config.yaml"];

  let agentsMdContent: string | null = null;

  if (createAgentsTemplate) {
    const templateContent = generateAgentsMdStarter(projectIdValue);
    agentsMdContent = templateContent;
    const agentsMdPath = `${cwd}/AGENTS.md`;
    const agentsMdTempPath = `${agentsMdPath}.tmp`;
    writeFileSync(agentsMdTempPath, templateContent, "utf-8");
    renameSync(agentsMdTempPath, agentsMdPath);
    createdFiles.push("AGENTS.md");
  }

  let packSections: Section[] = [];

  if (selectedImportCandidates.length > 0) {
    const mergeOutcome = await mergeAgentFileSections(
      selectedImportCandidates,
      `${projectIdValue}-rules`,
      nonInteractive,
    );
    packSections = mergeOutcome.sections;
    if (mergeOutcome.stats.length > 0) {
      const totalSections = mergeOutcome.stats.reduce(
        (sum, entry) => sum + entry.count,
        0,
      );
      const info = nonInteractive ? console.log : clack.log.success;
      info(
        `Imported ${totalSections} section${totalSections === 1 ? "" : "s"} from ${mergeOutcome.stats.length} file${mergeOutcome.stats.length === 1 ? "" : "s"}.`,
      );
    }

    if (mergeOutcome.conflicts.length > 0) {
      const warn = nonInteractive ? console.warn : clack.log.warn;
      warn(
        `Detected ${mergeOutcome.conflicts.length} conflicting section${mergeOutcome.conflicts.length === 1 ? "" : "s"} (newest edit wins).`,
      );
      mergeOutcome.conflicts.slice(0, 5).forEach((conflict) => {
        warn(
          `  • ${conflict.heading}: ${conflict.files
            .map((file) => file.path)
            .join(", ")}`,
        );
      });
      if (mergeOutcome.conflicts.length > 5) {
        warn("  … additional conflicts truncated for brevity");
      }
    }
  }

  if (packSections.length === 0 && agentsMdContent) {
    const parseResult = parseNaturalMarkdown(
      agentsMdContent,
      `${projectIdValue}-rules`,
    );
    packSections = parseResult.sections;
  }

  const pack: IRDocument = {
    id: `${projectIdValue}-rules`,
    version: "1.0.0",
    spec_version: "1",
    sections: packSections,
  };

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

  // Step 11: Offer first sync when it would be useful
  const syncWouldBeUseful = shouldOfferSync({
    createdAgentsTemplate: createAgentsTemplate,
    importedAgentFileCount: selectedImportCandidates.length,
  });
  let syncGuidance: NextStepsSyncGuidance = syncWouldBeUseful
    ? "standard"
    : "deferred";

  if (noSync) {
    if (nonInteractive) {
      console.log(
        "\nSkipped sync (--no-sync). Run 'aligntrue sync' when you are ready.",
      );
    } else {
      clack.log.info(
        "Skipped sync (--no-sync). Run 'aligntrue sync' when you are ready.",
      );
    }
  } else if (!syncWouldBeUseful) {
    const info = nonInteractive ? console.log : clack.log.info;
    info(
      "Ready to sync. Run 'aligntrue sync' to generate agent files, or edit your rules first.",
    );
  } else if (nonInteractive) {
    console.log("\nNext: aligntrue sync");
  } else {
    const shouldSyncNow = await clack.confirm({
      message: "Run 'aligntrue sync' now?",
      initialValue: true,
    });

    if (clack.isCancel(shouldSyncNow)) {
      clack.cancel("Init cancelled");
      process.exit(0);
    }

    if (shouldSyncNow) {
      try {
        const { sync } = await import("./sync/index.js");
        await sync([]);
      } catch (error) {
        clack.log.error(
          `Sync failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        clack.log.info(
          "Resolve the issue, then run 'aligntrue sync' manually.",
        );
      }
    } else {
      clack.log.info("Run 'aligntrue sync' when you're ready.");
    }
  }

  const nextStepsMessage = buildNextStepsMessage({
    mode: config.mode,
    syncGuidance,
  });

  if (nonInteractive) {
    console.log(`\n${nextStepsMessage}`);
    console.log(`\nLearn more: ${DOCS_QUICKSTART}`);
  } else {
    clack.log.info(`\n${nextStepsMessage}`);
    clack.log.info(`\nLearn more: ${DOCS_QUICKSTART}`);
  }

  // Record telemetry event
  recordEvent({ command_name: "init", align_hashes_used: [] });
}

async function mergeAgentFileSections(
  candidates: AgentFileCandidate[],
  packId: string,
  nonInteractive: boolean,
): Promise<{
  sections: Section[];
  conflicts: SectionConflict[];
  stats: Array<{ path: string; count: number }>;
}> {
  if (candidates.length === 0) {
    return { sections: [], conflicts: [], stats: [] };
  }

  const editedFiles: EditedFile[] = [];
  for (const candidate of candidates) {
    const edited = convertCandidateToEditedFile(candidate, nonInteractive);
    if (edited) {
      editedFiles.push(edited);
    }
  }

  if (editedFiles.length === 0) {
    return { sections: [], conflicts: [], stats: [] };
  }

  const { mergeFromMultipleFiles } = await import(
    "@aligntrue/core/sync/multi-file-parser"
  );

  const basePack: AlignPack = {
    id: packId,
    version: "1.0.0",
    spec_version: "1",
    sections: [],
  };

  const mergeResult = mergeFromMultipleFiles(editedFiles, basePack);
  const stats = editedFiles.map((file) => ({
    path: file.path,
    count: file.sections.length,
  }));

  return {
    sections: (mergeResult.mergedPack.sections || []) as Section[],
    conflicts: mergeResult.conflicts || [],
    stats,
  };
}

function convertCandidateToEditedFile(
  candidate: AgentFileCandidate,
  nonInteractive: boolean,
): EditedFile | null {
  const parser = parserForFormat(candidate.format);
  if (!parser) {
    return null;
  }

  try {
    const fileContent = readFileSync(candidate.absolutePath, "utf-8");
    let parsed: ReturnType<typeof parseAgentsMd>;

    if (parser === "cursor") {
      parsed = parseCursorMdc(fileContent);
    } else if (parser === "agents") {
      parsed = parseAgentsMd(fileContent);
    } else {
      parsed = parseGenericMarkdown(fileContent);
    }

    const stats = statSync(candidate.absolutePath);

    return {
      path: candidate.relativePath,
      absolutePath: candidate.absolutePath,
      format:
        parser === "cursor"
          ? "cursor-mdc"
          : parser === "agents"
            ? "agents"
            : "generic",
      sections: parsed.sections.map((section) => ({
        heading: section.heading,
        content: section.content,
        level: section.level,
        hash: section.hash,
      })),
      mtime: stats.mtime,
    };
  } catch (error) {
    const warn = nonInteractive ? console.warn : clack.log.warn;
    warn(
      `Failed to parse ${candidate.relativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

async function promptForManualImport(
  cwd: string,
): Promise<AgentFileCandidate | null> {
  const response = await clack.text({
    message: "Path to existing agent file:",
    placeholder: "docs/CLAUDE.md",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Path is required";
      }
    },
  });

  if (clack.isCancel(response)) {
    return null;
  }

  const requestedPath = response as string;
  const absolutePath = resolve(cwd, requestedPath);

  try {
    const stats = statSync(absolutePath);
    if (!stats.isFile()) {
      clack.log.warn(`Path is not a file: ${requestedPath}`);
      return null;
    }
  } catch {
    clack.log.warn(`File not found: ${requestedPath}`);
    return null;
  }

  const { agent, format } = inferAgentFromFilename(absolutePath);
  if (!isFormatImportable(format)) {
    clack.log.warn(
      `Cannot import ${requestedPath} automatically yet (unsupported format)`,
    );
    return null;
  }

  return {
    agent,
    displayName: getAgentDisplayName(agent),
    absolutePath,
    relativePath: relativePathSafe(cwd, absolutePath),
    format,
    importable: true,
    pathType: "file",
  };
}

function inferAgentFromFilename(filePath: string): {
  agent: string;
  format: AgentFileFormat;
} {
  const fileName = basename(filePath).toLowerCase();
  const mapping: Record<string, string> = {
    "agents.md": "agents",
    "claude.md": "claude",
    "crush.md": "crush",
    "warp.md": "warp",
    "gemini.md": "gemini",
    "windsurf.md": "windsurf",
    "aider.md": "aider",
    "opencode.md": "opencode",
    "roocode.md": "roocode",
    "zed.md": "zed",
  };

  if (fileName.endsWith(".mdc")) {
    return { agent: "cursor", format: "cursor-mdc" };
  }

  if (mapping[fileName]) {
    return { agent: mapping[fileName]!, format: "generic-markdown" };
  }

  return { agent: "agents", format: "generic-markdown" };
}

function relativePathSafe(root: string, fullPath: string): string {
  const rel = relative(root, fullPath);
  return rel === "" || rel.startsWith("..") ? fullPath : rel;
}
