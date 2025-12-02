/**
 * Remove command - Remove an align source from your configuration
 *
 * Enables:
 * - Removing remote aligns by URL
 * - Clean removal without affecting other sources
 *
 * Usage:
 *   aligntrue remove https://github.com/org/rules
 *   aligntrue remove https://example.com/my-align.yaml
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { saveConfig, type AlignTrueConfig } from "@aligntrue/core";
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
 * Argument definitions for remove command
 */
const ARG_DEFINITIONS: ArgDefinition[] = [
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
 * Remove command implementation
 */
export async function remove(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (help) {
    showStandardHelp({
      name: "remove",
      description: "Remove an align source from your configuration",
      usage: "aligntrue remove <url>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue remove https://github.com/org/rules  # Remove git source",
        "aligntrue remove https://example.com/align.yaml  # Remove URL source",
      ],
    });
    return;
  }

  // Validate URL provided
  if (positional.length === 0) {
    exitWithError(Errors.missingArgument("url", "aligntrue remove <url>"));
  }

  const urlToRemove = positional[0]!;
  const configPath =
    (flags["--config"] as string | undefined) || ".aligntrue/config.yaml";

  // Record telemetry
  await recordEvent({
    command_name: "remove",
    align_hashes_used: [],
  });

  // Check if config exists
  if (!existsSync(configPath)) {
    exitWithError({
      title: "Config not found",
      message: `Configuration file not found: ${configPath}`,
      hint: "Run 'aligntrue init' to create a configuration file.",
      code: "CONFIG_NOT_FOUND",
    });
  }

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });
  spinner.start("Removing align source...");

  try {
    // Load config
    const config: AlignTrueConfig = await loadConfigWithValidation(configPath);

    // Check if sources exist
    if (!config.sources || config.sources.length === 0) {
      spinner.stop("No sources configured", 1);

      if (isTTY()) {
        clack.log.warn("No sources are configured. Nothing to remove.");
      } else {
        console.log("\nWarning: No sources are configured. Nothing to remove.");
      }
      return;
    }

    // Find matching source
    const originalLength = config.sources.length;
    config.sources = config.sources.filter((source) => {
      // Match by URL for git sources
      if (source.type === "git") {
        return source.url !== urlToRemove;
      }
      // Keep local sources (they don't match URL pattern)
      return true;
    });

    // Check if anything was removed
    if (config.sources.length === originalLength) {
      spinner.stop("Source not found", 1);

      if (isTTY()) {
        clack.log.warn(`No source found matching: ${urlToRemove}`);
        clack.log.info("Current sources:");
        for (const source of config.sources) {
          if (source.type === "git") {
            clack.log.info(`  - ${source.type}: ${source.url}`);
          } else if (source.type === "local") {
            clack.log.info(`  - local: ${source.path}`);
          }
        }
      } else {
        console.log(`\nWarning: No source found matching: ${urlToRemove}`);
        console.log("Current sources:");
        for (const source of config.sources) {
          if (source.type === "git") {
            console.log(`  - ${source.type}: ${source.url}`);
          } else if (source.type === "local") {
            console.log(`  - local: ${source.path}`);
          }
        }
      }
      return;
    }

    // Save updated config
    await saveConfig(config, configPath);

    spinner.stop("Align source removed");

    // Consolidated outro
    const outroMessage = `Removed source: ${urlToRemove}\nRun 'aligntrue sync' to update agent files.`;

    if (isTTY()) {
      clack.outro(outroMessage);
    } else {
      console.log("\n" + outroMessage);
    }
  } catch (error) {
    spinner.stop("Remove failed", 1);

    if (error && typeof error === "object" && "code" in error) {
      throw error;
    }

    exitWithError({
      title: "Remove failed",
      message: `Failed to remove align source: ${error instanceof Error ? error.message : String(error)}`,
      hint: "Check the configuration file and try again.",
      code: "REMOVE_FAILED",
    });
  }
}
