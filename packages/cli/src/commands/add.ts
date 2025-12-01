/**
 * Add command - Add rules from a URL or path
 *
 * Default behavior: Copy rules to .aligntrue/rules/ (one-time import)
 * With --link: Add as connected source in config (gets updates on sync)
 *
 * Usage:
 *   aligntrue add https://github.com/org/rules              # Copy rules locally
 *   aligntrue add https://github.com/org/rules --link       # Keep connected for updates
 *   aligntrue add ./path/to/rules                           # Copy from local path
 *   aligntrue add https://github.com/org/rules --ref v1.0.0 # Specific version
 */

import { existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import * as clack from "@clack/prompts";
import {
  saveConfig,
  parseAlignUrl,
  getAlignTruePaths,
  writeRuleFile,
  resolveConflict,
  type AlignTrueConfig,
} from "@aligntrue/core";
import { importRules } from "../utils/source-resolver.js";
import { recordEvent } from "@aligntrue/core/telemetry/collector.js";
import { isTTY } from "../utils/tty-helper.js";
import {
  parseCommonArgs,
  showStandardHelp,
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
    flag: "--link",
    hasValue: false,
    description: "Keep source connected for ongoing updates (adds to config)",
  },
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
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Non-interactive mode (keep both on conflicts)",
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
      description: "Add rules from a git repo or path",
      usage: "aligntrue add <git-url|path> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue add https://github.com/org/rules           # Copy rules locally",
        "aligntrue add https://github.com/org/rules --link    # Keep connected for updates",
        "aligntrue add https://github.com/org/rules --ref v1  # Pin to version",
        "aligntrue add ./path/to/rules                        # Copy from local path",
      ],
      notes: [
        "- Default: copies rules to .aligntrue/rules/ (one-time import)",
        "- With --link: adds source to config for ongoing updates",
        "- To remove copied rules: delete files and run 'aligntrue sync'",
        "- To remove linked source: use 'aligntrue remove <url>'",
      ],
    });
    return;
  }

  // Validate URL provided
  if (positional.length === 0) {
    exitWithError(
      Errors.missingArgument("url", "aligntrue add <git-url|path>"),
    );
  }

  const rawUrl = positional[0]!;
  const cwd = process.cwd();
  const paths = getAlignTruePaths(cwd);
  const configPath = (flags["--config"] as string | undefined) || paths.config;
  const gitRef = flags["--ref"] as string | undefined;
  const gitPath = flags["--path"] as string | undefined;
  const linkFlag = (flags["--link"] as boolean | undefined) || false;
  const nonInteractive = (flags["--yes"] as boolean | undefined) || !isTTY();

  // Parse URL for any query parameters
  const { baseUrl } = parseAlignUrl(rawUrl);

  // Detect source type
  const sourceType = detectSourceType(baseUrl);

  // Record telemetry
  await recordEvent({
    command_name: "add",
    align_hashes_used: [],
  });

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });

  if (linkFlag) {
    // --link mode: add to config (existing behavior)
    await addLinkedSource({
      baseUrl,
      sourceType,
      gitRef,
      gitPath,
      configPath,
      spinner,
    });
  } else {
    // Default mode: copy rules to .aligntrue/rules/
    await copyRulesToLocal({
      source: rawUrl,
      gitRef,
      gitPath,
      cwd,
      paths,
      configPath,
      nonInteractive,
      spinner,
    });
  }
}

/**
 * Add a linked source to config (gets updates on sync)
 */
async function addLinkedSource(options: {
  baseUrl: string;
  sourceType: "git" | "url" | "local";
  gitRef?: string | undefined;
  gitPath?: string | undefined;
  configPath: string;
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const { baseUrl, sourceType, gitRef, gitPath, configPath, spinner } = options;

  spinner.start("Adding linked source...");

  try {
    // Load or create config
    let config: AlignTrueConfig;

    if (existsSync(configPath)) {
      config = await loadConfigWithValidation(configPath);
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
      if (s.type === "url" && sourceType === "url") {
        return s.url === baseUrl;
      }
      if (s.type === "local" && sourceType === "local") {
        return s.path === baseUrl;
      }
      return false;
    });

    if (existingSource) {
      spinner.stop("Source already linked", 1);

      if (isTTY()) {
        clack.log.warn(
          `This source is already linked in your configuration:\n  ${baseUrl}`,
        );
        clack.log.info(
          "To update it, edit .aligntrue/config.yaml directly or remove and re-add.",
        );
      } else {
        console.log(`\nWarning: This source is already linked: ${baseUrl}`);
      }
      return;
    }

    // Build source configuration
    let newSource: { type: string; url?: string; path?: string; ref?: string };

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
    } else if (sourceType === "url") {
      newSource = {
        type: "url",
        url: baseUrl,
      };
    } else {
      newSource = {
        type: "local",
        path: baseUrl,
      };
    }

    // Add to sources (already ensured it exists above)
    const sources = config.sources!;
    sources.push(newSource as (typeof sources)[number]);

    // Save config
    await saveConfig(config, configPath);

    spinner.stop("Source linked");

    // Success message
    const sourceDesc =
      sourceType === "git"
        ? `Git source: ${baseUrl}${gitRef ? ` (${gitRef})` : ""}`
        : sourceType === "url"
          ? `URL source: ${baseUrl}`
          : `Local source: ${baseUrl}`;

    const successMessage =
      `Linked ${sourceDesc}\n\n` +
      `This source will be fetched on each 'aligntrue sync'.\n\n` +
      `Next steps:\n` +
      `  - Run sync to pull rules: aligntrue sync\n` +
      `  - To remove: aligntrue remove ${baseUrl}`;

    if (isTTY()) {
      clack.outro(successMessage);
    } else {
      console.log("\n" + successMessage);
    }
  } catch (error) {
    spinner.stop("Link failed", 1);

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Link failed",
      message: `Failed to link source: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL format and try again.",
      code: "LINK_FAILED",
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
  spinner: ReturnType<typeof createManagedSpinner>;
}): Promise<void> {
  const { source, gitRef, cwd, paths, configPath, nonInteractive, spinner } =
    options;

  spinner.start(`Importing rules from ${source}...`);

  try {
    // Ensure .aligntrue/rules exists
    const rulesDir = join(paths.aligntrueDir, "rules");
    mkdirSync(rulesDir, { recursive: true });

    // Ensure config exists
    if (!existsSync(configPath)) {
      // Create minimal config
      const config: AlignTrueConfig = {
        version: undefined,
        mode: "solo",
        sources: [{ type: "local", path: ".aligntrue/rules" }],
        exporters: ["agents"],
      };
      mkdirSync(dirname(configPath), { recursive: true });
      await saveConfig(config, configPath);
    }

    // Import rules
    const result = await importRules({
      source,
      ref: gitRef,
      cwd,
      targetDir: rulesDir,
    });

    if (result.error) {
      spinner.stop("Import failed", 1);
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

    spinner.stop(`Imported ${createdFiles.length} rules`);

    // Success message
    const fileList = createdFiles
      .slice(0, 5)
      .map((f) => `  - ${f}`)
      .join("\n");
    const moreCount =
      createdFiles.length > 5
        ? `\n  ... and ${createdFiles.length - 5} more`
        : "";

    const successMessage =
      `Added ${createdFiles.length} rules from ${source}\n\n` +
      `Files created in .aligntrue/rules/:\n${fileList}${moreCount}\n\n` +
      `To remove these rules: delete the files and run 'aligntrue sync'`;

    if (isTTY()) {
      clack.outro(successMessage);
    } else {
      console.log("\n" + successMessage);
    }
  } catch (error) {
    spinner.stop("Import failed", 1);

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
