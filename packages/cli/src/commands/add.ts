/**
 * Add command - Add rules, sources, or remotes
 *
 * Usage:
 *   aligntrue add <url>                     # One-time copy to .aligntrue/rules/
 *   aligntrue add source <url>              # Add as connected source (gets updates on sync)
 *   aligntrue add source <url> --personal   # Mark source as personal
 *   aligntrue add remote <url>              # Add as push destination
 *   aligntrue add remote <url> --personal   # Set as remotes.personal
 *   aligntrue add remote <url> --shared     # Set as remotes.shared
 */

import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import {
  patchConfig,
  saveConfig,
  parseAlignUrl,
  getAlignTruePaths,
  writeRuleFile,
  resolveConflict,
  isTeamModeActive,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { importRules } from "../utils/source-resolver.js";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
  formatCreatedFiles,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { loadConfigWithValidation } from "../utils/config-loader.js";
import { exitWithError } from "../utils/error-formatter.js";
import { CommonErrors as Errors } from "../utils/common-errors.js";
import { createManagedSpinner } from "../utils/spinner.js";
import {
  selectFilesToImport,
  type ImportFile,
} from "../utils/selective-import-ui.js";

/**
 * Argument definitions for add command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--ref",
    hasValue: true,
    description: "Git ref (branch/tag/commit) for git sources",
  },
  {
    flag: "--path",
    hasValue: true,
    description: "Path to rules file/directory within repository",
  },
  {
    flag: "--personal",
    hasValue: false,
    description:
      "Mark as personal (for source: personal rules; for remote: set as remotes.personal)",
  },
  {
    flag: "--shared",
    hasValue: false,
    description: "Set remote as remotes.shared (only for 'add remote')",
  },
  {
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Non-interactive mode (keep both on conflicts)",
  },
  {
    flag: "--no-sync",
    hasValue: false,
    description: "Skip auto-sync after import (default: sync automatically)",
  },
  {
    flag: "--config",
    alias: "-c",
    hasValue: true,
    description: "Custom config file path (default: .aligntrue/config.yaml)",
  },
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show this help message",
  },
];

/**
 * Detect if a URL requires SSH authentication (private source)
 * SSH URLs indicate authenticated/private access
 */
function isPrivateSource(url: string): boolean {
  // Git SSH URLs (git@github.com:user/repo)
  if (url.startsWith("git@")) {
    return true;
  }
  // SSH protocol URLs (ssh://git@github.com/user/repo)
  if (url.startsWith("ssh://")) {
    return true;
  }
  return false;
}

/**
 * Detect source type from URL
 */
function detectSourceType(url: string): "git" | "local" {
  // Local paths
  if (url.startsWith("./") || url.startsWith("../") || url.startsWith("/")) {
    return "local";
  }

  // Git SSH URLs
  if (url.startsWith("git@")) {
    return "git";
  }

  // SSH URLs
  if (url.startsWith("ssh://")) {
    return "git";
  }

  // Check if it ends with .git
  if (url.endsWith(".git")) {
    return "git";
  }

  // Check for known git hosting URLs with strict host matching
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (
      hostname === "github.com" ||
      hostname.endsWith(".github.com") ||
      hostname === "gitlab.com" ||
      hostname.endsWith(".gitlab.com") ||
      hostname === "bitbucket.org" ||
      hostname.endsWith(".bitbucket.org")
    ) {
      return "git";
    }

    // Plain HTTP/HTTPS URLs are not supported
    if (urlObj.protocol === "https:" || urlObj.protocol === "http:") {
      exitWithError({
        title: "Unsupported URL format",
        message: `Plain HTTP/HTTPS URLs are not supported for remote rules.\n  URL: ${url}`,
        hint: "Use a git repository instead (GitHub, GitLab, Bitbucket, or self-hosted).\n  Example: https://github.com/org/rules",
        code: "UNSUPPORTED_URL",
      });
    }
  } catch {
    // If URL parsing fails, might be a local path
    return "local";
  }

  // Default to local path
  return "local";
}

/**
 * Add command implementation
 */
export async function add(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (help) {
    showStandardHelp({
      name: "add",
      description: "Add rules, sources, or remotes",
      usage: "aligntrue add [source|remote] <url> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue add https://github.com/org/rules           # One-time copy",
        "aligntrue add source https://github.com/org/rules    # Add as source (updates on sync)",
        "aligntrue add source <url> --personal                # Personal source",
        "aligntrue add remote https://github.com/me/backup    # Add as push destination",
        "aligntrue add remote <url> --personal                # Set as remotes.personal",
        "aligntrue add remote <url> --shared                  # Set as remotes.shared",
      ],
      notes: [
        "- Default (no subcommand): copies rules to .aligntrue/rules/ (one-time import)",
        "- 'add source': adds to config sources (gets updates on sync)",
        "- 'add remote': adds to config remotes (pushes rules on sync)",
        "- To remove: 'aligntrue remove <url>'",
      ],
    });
    return;
  }

  // Check for subcommand (source or remote)
  const firstArg = positional[0];
  const subcommand =
    firstArg === "source" || firstArg === "remote" ? firstArg : null;
  const urlArg = subcommand ? positional[1] : positional[0];

  // Validate URL provided
  if (!urlArg) {
    if (subcommand) {
      exitWithError(
        Errors.missingArgument("url", `aligntrue add ${subcommand} <url>`),
      );
    } else {
      exitWithError(
        Errors.missingArgument(
          "url",
          "aligntrue add <url> or aligntrue add source/remote <url>",
        ),
      );
    }
  }

  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = (flags["config"] as string | undefined) || paths.config;
  const gitRef = flags["ref"] as string | undefined;
  const gitPath = flags["path"] as string | undefined;
  const personalFlag = (flags["personal"] as boolean | undefined) || false;
  const sharedFlag = (flags["shared"] as boolean | undefined) || false;
  const nonInteractive = (flags["yes"] as boolean | undefined) || !isTTY();
  const noSync = (flags["no-sync"] as boolean | undefined) || false;

  // Parse URL for any query parameters
  const { baseUrl } = parseAlignUrl(urlArg);

  // Detect source type and privacy
  const sourceType = detectSourceType(baseUrl);
  const privateSource = isPrivateSource(baseUrl);

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });

  if (subcommand === "source") {
    // Add as connected source
    await addSource({
      baseUrl,
      sourceType,
      gitRef,
      gitPath,
      configPath,
      privateSource,
      personal: personalFlag,
      spinner,
    });
  } else if (subcommand === "remote") {
    // Validate --shared and --personal are not both set
    if (sharedFlag && personalFlag) {
      exitWithError({
        title: "Invalid options",
        message: "Cannot use both --personal and --shared flags together",
        hint: "Choose one: --personal (for remotes.personal) or --shared (for remotes.shared)",
        code: "INVALID_OPTIONS",
      });
    }

    // Add as remote destination
    await addRemote({
      baseUrl,
      gitRef,
      configPath,
      scope: sharedFlag ? "shared" : personalFlag ? "personal" : undefined,
      spinner,
    });
  } else {
    // Default mode: copy rules to .aligntrue/rules/ (one-time import)
    await copyRulesToLocal({
      source: urlArg,
      gitRef,
      gitPath,
      cwd,
      paths,
      configPath,
      nonInteractive,
      noSync,
      privateSource,
      spinner,
    });
  }
}

/**
 * Determine which config file to write to based on team mode and flags
 */
async function determineTargetConfig(options: {
  cwd: string;
  configPath: string;
  personal: boolean;
  shared: boolean;
  operationType: "source" | "remote";
}): Promise<{ targetPath: string; isPersonalConfig: boolean }> {
  const { cwd, configPath, personal, shared, operationType } = options;
  const paths = getAlignTruePaths(cwd);

  // If not in team mode, always use the main config
  if (!isTeamModeActive(cwd)) {
    return { targetPath: configPath, isPersonalConfig: true };
  }

  // In team mode with explicit flags
  if (personal) {
    return { targetPath: paths.config, isPersonalConfig: true };
  }
  if (shared) {
    return { targetPath: paths.teamConfig, isPersonalConfig: false };
  }

  // In team mode with no flag: prompt user
  if (isTTY()) {
    const choice = await clack.select({
      message: `Add ${operationType} to which config?`,
      options: [
        {
          value: "personal",
          label: "Personal config (gitignored, for your use only)",
          hint: "config.yaml",
        },
        {
          value: "team",
          label: "Team config (committed, shared with team)",
          hint: "config.team.yaml",
        },
      ],
      initialValue: operationType === "remote" ? "personal" : "team",
    });

    if (clack.isCancel(choice)) {
      clack.cancel("Operation cancelled");
      process.exit(0);
    }

    if (choice === "personal") {
      return { targetPath: paths.config, isPersonalConfig: true };
    } else {
      return { targetPath: paths.teamConfig, isPersonalConfig: false };
    }
  }

  // Non-interactive team mode without flags: error
  exitWithError({
    title: "Ambiguous target config",
    message: `In team mode, specify --personal or --shared flag for add ${operationType}`,
    hint: `Use: aligntrue add ${operationType} <url> --personal (or --shared)`,
    code: "AMBIGUOUS_CONFIG_TARGET",
  });

  // This line is unreachable but TypeScript needs it
  return { targetPath: configPath, isPersonalConfig: true };
}

/**
 * Add a source to config (gets updates on sync)
 */
async function addSource(options: {
  baseUrl: string;
  sourceType: "git" | "local";
  gitRef?: string | undefined;
  gitPath?: string | undefined;
  configPath: string;
  privateSource: boolean;
  personal: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const {
    baseUrl,
    sourceType,
    gitRef,
    gitPath,
    configPath,
    privateSource,
    personal,
    spinner,
  } = options;

  const cwd = process.cwd();

  // Determine target config file
  const { targetPath, isPersonalConfig } = await determineTargetConfig({
    cwd,
    configPath,
    personal: personal || privateSource, // Private sources default to personal
    shared: false,
    operationType: "source",
  });

  spinner.start("Adding source...");

  try {
    // Load or create config
    let config: AlignTrueConfig;

    if (existsSync(targetPath)) {
      config = await loadConfigWithValidation(targetPath);
    } else {
      // Create minimal config
      config = {
        version: undefined,
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
    }

    // Initialize sources array if not exists
    if (!config.sources) {
      config.sources = [];
    }

    // Check if source already exists
    const existingSource = config.sources.find((s) => {
      if (s.type === "git" && sourceType === "git") {
        return s.url === baseUrl;
      }
      if (s.type === "local" && sourceType === "local") {
        return s.path === baseUrl;
      }
      return false;
    });

    if (existingSource) {
      spinner.stop("Source already exists", 1);

      if (isTTY()) {
        clack.log.warn(
          `This source is already in your configuration:\n  ${baseUrl}`,
        );
        clack.log.info(
          `To update it, edit ${targetPath} directly or remove and re-add.`,
        );
      } else {
        console.log(`\nWarning: This source already exists: ${baseUrl}`);
      }
      return;
    }

    // Build source configuration
    let newSource: {
      type: string;
      url?: string;
      path?: string;
      ref?: string;
      personal?: boolean;
      gitignore?: boolean;
    };

    if (sourceType === "git") {
      newSource = {
        type: "git",
        url: baseUrl,
      };
      if (gitRef) {
        newSource.ref = gitRef;
      }
      if (gitPath) {
        newSource.path = gitPath;
      }
      // Mark as personal if flag or SSH source (only in personal config)
      if ((personal || privateSource) && isPersonalConfig) {
        newSource.personal = true;
      }
      // Auto-set gitignore for SSH sources
      if (privateSource) {
        newSource.gitignore = true;
      }
    } else {
      newSource = {
        type: "local",
        path: baseUrl,
      };
      if (personal && isPersonalConfig) {
        newSource.personal = true;
      }
    }

    // Add to sources (preserving existing sources)
    const updatedSources = [...(config.sources || [])];
    updatedSources.push(
      newSource as NonNullable<AlignTrueConfig["sources"]>[number],
    );

    // Patch config - only update sources, preserve everything else
    await patchConfig({ sources: updatedSources }, targetPath);

    spinner.stop("Source added");

    // Show which config was updated
    const configType = isPersonalConfig ? "personal" : "team";
    if (isTTY()) {
      clack.log.success(`Added to ${configType} config: ${targetPath}`);
    }

    // Show notes
    if (privateSource && isTTY()) {
      clack.log.info(
        "Private source detected (SSH authentication)\n" +
          "  Source marked as personal. Rules will be auto-gitignored on sync.",
      );
    } else if (personal && isTTY()) {
      clack.log.info(
        "Source marked as personal (scope: personal for all rules from this source)",
      );
    }

    // Consolidated outro
    const sourceDesc =
      sourceType === "git"
        ? `${baseUrl}${gitRef ? ` (${gitRef})` : ""}`
        : baseUrl;

    const outroMessage = `Added source: ${sourceDesc}\nRun 'aligntrue sync' to pull rules.`;

    if (isTTY()) {
      clack.outro(outroMessage);
    } else {
      console.log("\n" + outroMessage);
    }
  } catch (error) {
    spinner.stop("Failed to add source", 1);

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Add source failed",
      message: `Failed to add source: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL format and try again.",
      code: "ADD_SOURCE_FAILED",
    });
  }
}

/**
 * Add a remote to config (pushes rules on sync)
 */
async function addRemote(options: {
  baseUrl: string;
  gitRef?: string | undefined;
  configPath: string;
  scope?: "personal" | "shared" | undefined;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const { baseUrl, gitRef, configPath, scope, spinner } = options;

  const cwd = process.cwd();

  // Determine target config file based on scope
  // - personal remotes go to personal config
  // - shared remotes go to team config
  const { targetPath } = await determineTargetConfig({
    cwd,
    configPath,
    personal: scope === "personal" || scope === undefined, // Default to personal for remotes
    shared: scope === "shared",
    operationType: "remote",
  });

  // Determine which remote slot to use
  const remoteKey = scope || "personal"; // Default to personal if no scope specified

  spinner.start("Adding remote...");

  try {
    // Load or create config
    let config: AlignTrueConfig;

    if (existsSync(targetPath)) {
      config = await loadConfigWithValidation(targetPath);
    } else {
      // Create minimal config
      config = {
        version: undefined,
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
    }

    // Initialize remotes if not exists
    if (!config.remotes) {
      config.remotes = {};
    }

    // Build remote URL with optional branch
    const remoteUrl = gitRef ? `${baseUrl}#${gitRef}` : baseUrl;

    // Check if this remote slot is already configured
    // Only personal and shared slots are valid for this command (not custom)
    const existingRemote = config.remotes[remoteKey as "personal" | "shared"];
    if (existingRemote && !Array.isArray(existingRemote)) {
      const existingUrl =
        typeof existingRemote === "string"
          ? existingRemote
          : existingRemote.url;

      if (existingUrl === remoteUrl || existingUrl === baseUrl) {
        spinner.stop("Remote already configured", 1);

        if (isTTY()) {
          clack.log.warn(
            `remotes.${remoteKey} is already configured:\n  ${existingUrl}`,
          );
          clack.log.info(
            `To update it, edit ${targetPath} directly or remove and re-add.`,
          );
        } else {
          console.log(
            `\nWarning: remotes.${remoteKey} already configured: ${existingUrl}`,
          );
        }
        return;
      }

      // Different URL - warn about overwrite
      spinner.stop("Remote slot in use");

      if (isTTY()) {
        clack.log.warn(
          `remotes.${remoteKey} is already configured with a different URL:\n` +
            `  Current: ${existingUrl}\n` +
            `  New: ${baseUrl}`,
        );

        const confirm = await clack.confirm({
          message: `Replace existing remotes.${remoteKey}?`,
          initialValue: false,
        });

        if (clack.isCancel(confirm) || !confirm) {
          clack.cancel("Remote not added");
          return;
        }

        spinner.start("Updating remote...");
      } else {
        console.log(
          `\nWarning: Replacing existing remotes.${remoteKey}: ${existingUrl}`,
        );
      }
    }

    // Build the remote value
    const remoteValue = gitRef ? { url: baseUrl, branch: gitRef } : baseUrl;

    // Patch config - only update the specific remote key, preserve everything else
    await patchConfig(
      {
        remotes: {
          ...config.remotes,
          [remoteKey]: remoteValue,
        },
      },
      targetPath,
    );

    spinner.stop("Remote added");

    // Show which config was updated
    const configType = remoteKey === "personal" ? "personal" : "team";
    if (isTTY()) {
      clack.log.success(`Added to ${configType} config: ${targetPath}`);
    }

    // Show explanation of how it works
    if (isTTY()) {
      clack.log.info(
        `Rules with scope: ${remoteKey} will be pushed to this remote on sync.\n` +
          `Add 'scope: ${remoteKey}' to rule frontmatter to route rules here.`,
      );
    }

    // Consolidated outro
    const outroMessage = `Added remotes.${remoteKey}: ${baseUrl}${gitRef ? ` (branch: ${gitRef})` : ""}\nRun 'aligntrue sync' to push rules.`;

    if (isTTY()) {
      clack.outro(outroMessage);
    } else {
      console.log("\n" + outroMessage);
    }
  } catch (error) {
    spinner.stop("Failed to add remote", 1);

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Add remote failed",
      message: `Failed to add remote: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL format and try again.",
      code: "ADD_REMOTE_FAILED",
    });
  }
}

/**
 * Copy rules to .aligntrue/rules/ (one-time import)
 */
async function copyRulesToLocal(options: {
  source: string;
  gitRef?: string | undefined;
  gitPath?: string | undefined;
  cwd: string;
  paths: ReturnType<typeof getAlignTruePaths>;
  configPath: string;
  nonInteractive: boolean;
  noSync: boolean;
  privateSource: boolean;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const {
    source,
    gitRef,
    cwd,
    paths,
    configPath,
    nonInteractive,
    noSync,
    privateSource,
    spinner,
  } = options;

  spinner.start(`Importing rules from ${source}...`);

  try {
    // Ensure .aligntrue/rules exists
    const rulesDir = join(paths.aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });

    // Ensure config exists
    if (!existsSync(configPath)) {
      // Create minimal config (full save for new file)
      // Note: version and mode will be set by defaults when loaded
      const config = {
        sources: [{ type: "local" as const, path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      mkdirSync(dirname(configPath), { recursive: true });
      await saveConfig(config as AlignTrueConfig, configPath);
    }

    // Import rules
    const result = await importRules({
      source,
      ref: gitRef,
      cwd,
      targetDir: rulesDir,
    });

    if (result.error) {
      spinner.stopSilent(); // Silent stop - exitWithError will show the error
      exitWithError({
        title: "Import failed",
        message: result.error,
        code: "IMPORT_FAILED",
      });
      return;
    }

    if (result.rules.length === 0) {
      spinner.stop("No rules found", 1);
      if (isTTY()) {
        clack.log.warn(`No markdown rules found at ${source}`);
      } else {
        console.log(`\nWarning: No markdown rules found at ${source}`);
      }
      return;
    }

    // Selective import UI - let user choose which rules to import
    // Build file list from rules for selection
    const filesForSelection: ImportFile[] = [];
    const ruleToFileMap = new Map<string, number>();

    result.rules.forEach((rule, index) => {
      const filePath = rule.relativePath || rule.filename;
      // Avoid duplicates (in case multiple rules come from same file)
      if (!filesForSelection.find((f) => f.relativePath === filePath)) {
        filesForSelection.push({
          path: filePath, // Use relativePath since we don't have absolute in this context
          relativePath: filePath,
        });
      }
      ruleToFileMap.set(filePath, index);
    });

    // Show selective import UI if interactive
    let selectedRules = [...result.rules];
    if (!nonInteractive && filesForSelection.length > 0) {
      spinner.stop(`Found ${result.rules.length} rules from ${source}`);
      const selectionResult = await selectFilesToImport(filesForSelection, {
        nonInteractive: false,
      });

      if (selectionResult.skipped || selectionResult.selectedFileCount === 0) {
        clack.cancel("Import cancelled");
        return;
      }

      // Filter rules to only those from selected files
      const selectedFilePaths = new Set(
        selectionResult.selectedFiles.map((f) => f.relativePath),
      );
      selectedRules = result.rules.filter((rule) => {
        const filePath = rule.relativePath || rule.filename;
        return selectedFilePaths.has(filePath);
      });

      spinner.start("Writing selected rules...");
    }

    // Handle conflicts
    const rulesToWrite = [...selectedRules];

    if (result.conflicts.length > 0) {
      spinner.stop(`Found ${selectedRules.length} rules (conflicts detected)`);

      for (const conflict of result.conflicts) {
        let resolution: "replace" | "keep-both" | "skip";

        if (nonInteractive) {
          // Non-interactive: keep both
          resolution = "keep-both";
        } else {
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

          resolution = choice as "replace" | "keep-both" | "skip";
        }

        const resolved = resolveConflict(conflict, resolution, cwd);

        // Update the rule's filename if needed
        const ruleIndex = rulesToWrite.findIndex(
          (r) => r.filename === conflict.filename,
        );
        if (ruleIndex !== -1) {
          if (resolved.resolution === "skip") {
            rulesToWrite.splice(ruleIndex, 1);
          } else {
            const rule = rulesToWrite[ruleIndex]!;
            rule.filename = resolved.finalFilename;
            rule.path = resolved.finalFilename;

            if (resolved.backupPath && isTTY()) {
              clack.log.info(
                `Backed up existing rule to ${resolved.backupPath}`,
              );
            }
          }
        }
      }

      spinner.start("Writing rules...");
    }

    // Write rules to .aligntrue/rules/
    const createdFiles: string[] = [];
    for (const rule of rulesToWrite) {
      const fullPath = join(rulesDir, rule.relativePath || rule.filename);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeRuleFile(fullPath, rule);
      createdFiles.push(rule.relativePath || rule.filename);
    }

    spinner.stop(`Imported ${createdFiles.length} rules from ${source}`);

    // Show grouped file list
    const fullPaths = createdFiles.map((f) => `.aligntrue/rules/${f}`);
    formatCreatedFiles(fullPaths, { nonInteractive: !isTTY() });

    // Handle gitignored source: auto-gitignore the source files
    if (privateSource) {
      if (isTTY()) {
        clack.log.warn(
          "Gitignored source detected (SSH authentication)\n" +
            "  Rules added to .gitignore automatically.",
        );
      } else {
        console.log("\nGitignored source detected - rules added to .gitignore");
      }

      // Add source files to gitignore
      try {
        const { GitIntegration } = await import("@aligntrue/core");
        const gitIntegration = new GitIntegration();
        await gitIntegration.addGitignoreRulesToGitignore(cwd, fullPaths);
      } catch {
        // Silent failure on gitignore update - not critical
        if (isTTY()) {
          clack.log.warn(
            "Failed to auto-update .gitignore. Update manually if needed.",
          );
        }
      }
    }

    // Auto-sync to export rules to agents (unless --no-sync)
    let syncPerformed = false;
    if (!noSync) {
      try {
        if (isTTY()) {
          clack.log.step("Syncing rules to agents...");
        }
        const { sync } = await import("./sync/index.js");
        await sync(["--quiet"]);
        syncPerformed = true;
        if (isTTY()) {
          clack.log.success("Synced to agents");
        }
      } catch {
        // Sync failure is not critical - rules are still imported
        if (isTTY()) {
          clack.log.warn("Auto-sync failed. Run 'aligntrue sync' manually.");
        }
      }
    }

    // Build consolidated tips section
    const tips: string[] = [];

    if (privateSource) {
      tips.push("To commit these rules: remove from .gitignore");
    } else {
      tips.push("To keep private: add '.aligntrue/rules/' to .gitignore");
    }

    tips.push("To remove: delete the files and run 'aligntrue sync'");
    tips.push("To add as connected source: use 'aligntrue add source <url>'");

    if (!syncPerformed) {
      tips.push("To apply to agents: run 'aligntrue sync'");
    }

    // Show tips
    if (isTTY()) {
      clack.note(tips.map((t) => `• ${t}`).join("\n"), "Tips");
      clack.outro("Done");
    } else {
      console.log("\nTips:");
      tips.forEach((t) => console.log(`  • ${t}`));
    }
  } catch (error) {
    spinner.stopSilent(); // Silent stop - exitWithError will show the error

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Import failed",
      message: `Failed to import rules: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL/path format and try again.",
      code: "IMPORT_FAILED",
    });
  }
}
