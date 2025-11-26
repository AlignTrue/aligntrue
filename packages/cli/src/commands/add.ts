/**
 * Add command - Add an align from a URL to your configuration
 *
 * Enables:
 * - Adding remote aligns from git or HTTP URLs
 * - Automatic detection of align manifests (.align.yaml)
 * - Quick setup with `aligntrue add <url>`
 *
 * Usage:
 *   aligntrue add https://github.com/org/rules
 *   aligntrue add https://example.com/my-align.align.yaml
 *   aligntrue add https://github.com/org/rules?customizations=false
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import {
  saveConfig,
  parseAlignUrl,
  isAlignManifest,
  type AlignTrueConfig,
} from "@aligntrue/core";
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
    description: "Path to rules file within repository",
  },
  {
    flag: "--no-customizations",
    hasValue: false,
    description: "Disable author-recommended customizations",
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
function detectSourceType(url: string): "git" | "url" {
  // Git URLs
  if (
    url.startsWith("git@") ||
    url.includes("github.com") ||
    url.includes("gitlab.com") ||
    url.includes("bitbucket.org")
  ) {
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

  // Default to URL for plain HTTP/HTTPS
  return "url";
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
      description: "Add an align from a URL to your configuration",
      usage: "aligntrue add <url> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue add https://github.com/org/rules  # Add git source",
        "aligntrue add https://github.com/org/rules --ref v1.0.0  # Pin to version",
        "aligntrue add https://example.com/align.yaml  # Add URL source",
        "aligntrue add https://github.com/org/rules --no-customizations  # Skip author customizations",
      ],
    });
    return;
  }

  // Validate URL provided
  if (positional.length === 0) {
    exitWithError(Errors.missingArgument("url", "aligntrue add <url>"));
  }

  const rawUrl = positional[0]!;
  const configPath =
    (flags["--config"] as string | undefined) || ".aligntrue/config.yaml";
  const gitRef = flags["--ref"] as string | undefined;
  const gitPath = flags["--path"] as string | undefined;
  const noCustomizations = flags["--no-customizations"] === true;

  // Parse URL for query parameters
  const { baseUrl, applyCustomizations: urlCustomizations } =
    parseAlignUrl(rawUrl);
  const applyCustomizations = !noCustomizations && urlCustomizations;

  // Detect source type
  const sourceType = detectSourceType(baseUrl);
  const isManifest = isAlignManifest(baseUrl);

  // Record telemetry
  await recordEvent({
    command_name: "add",
    align_hashes_used: [],
  });

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });
  spinner.start("Adding align source...");

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
        sources: [],
        exporters: [],
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
      return false;
    });

    if (existingSource) {
      spinner.stop("Source already exists", 1);

      if (isTTY()) {
        clack.log.warn(
          `This align source is already in your configuration:\n  ${baseUrl}`,
        );
        clack.log.info(
          "To update it, edit .aligntrue/config.yaml directly or remove and re-add.",
        );
      } else {
        console.log(
          `\nWarning: This align source is already in your configuration: ${baseUrl}`,
        );
        console.log(
          "To update it, edit .aligntrue/config.yaml directly or remove and re-add.",
        );
      }
      return;
    }

    // Build source configuration
    let newSource: Record<string, unknown>;

    if (sourceType === "git") {
      newSource = {
        type: "git",
        url: baseUrl,
      };

      if (gitRef) {
        newSource["ref"] = gitRef;
      }

      if (gitPath) {
        newSource["path"] = gitPath;
      }
    } else {
      newSource = {
        type: "url",
        url: baseUrl,
      };
    }

    // Add customizations flag if disabled
    if (!applyCustomizations && isManifest) {
      newSource["customizations"] = false;
    }

    // Add to sources
    config.sources.push(
      newSource as {
        type: "git" | "url" | "local";
        url?: string;
        path?: string;
      },
    );

    // Save config
    await saveConfig(config, configPath);

    spinner.stop("Align source added");

    // Success message
    const sourceDesc =
      sourceType === "git"
        ? `Git source: ${baseUrl}${gitRef ? ` (${gitRef})` : ""}`
        : `URL source: ${baseUrl}`;

    const nextSteps = ["Run sync to pull rules: aligntrue sync"];

    if (isManifest) {
      nextSteps.push(
        "This is an align manifest - rules will be loaded from the manifest",
      );
    }

    if (!applyCustomizations) {
      nextSteps.push("Author customizations are disabled");
    }

    const successMessage =
      `Added ${sourceDesc}\n\n` +
      `Next steps:\n` +
      nextSteps.map((s) => `  - ${s}`).join("\n");

    if (isTTY()) {
      clack.outro(successMessage);
    } else {
      console.log("\n" + successMessage);
    }
  } catch (error) {
    spinner.stop("Add failed", 1);

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Add failed",
      message: `Failed to add align source: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the URL format and try again.",
      code: "ADD_FAILED",
    });
  }
}
