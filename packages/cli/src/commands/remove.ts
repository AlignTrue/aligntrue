/**
 * Remove command - Remove an align source from your configuration
 *
 * Enables:
 * - Removing remote aligns by URL
 * - Clean removal without affecting other sources
 *
 * Usage:
 *   aligntrue remove source https://github.com/org/rules
 */

import { existsSync, readFileSync } from "fs";
import * as clack from "@clack/prompts";
import { patchConfig, type AlignTrueConfig } from "@aligntrue/core";
import { parse as parseYaml } from "yaml";
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
    flag: "--yes",
    alias: "-y",
    hasValue: false,
    description: "Non-interactive mode (skip confirmations)",
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
 * Remove command implementation
 */
export async function remove(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);
  const skipConfirmations = Boolean(flags["yes"]);

  // Show help if requested
  if (help) {
    showStandardHelp({
      name: "remove",
      description: "Remove an align source from your configuration",
      usage: "aligntrue remove source <url>",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue remove source https://github.com/org/rules  # Remove git source",
        "aligntrue remove source https://example.com/rules.md  # Remove URL source",
      ],
    });
    return;
  }

  // Expect subcommand "source" for clarity and symmetry with add
  const subcommand = positional[0];
  const urlArg = positional[1];

  if (subcommand !== "source") {
    exitWithError(
      {
        title: "Invalid usage",
        message: "Use: aligntrue remove source <url>",
        hint: "To remove a linked source, run: aligntrue remove source <git-url>",
        code: "INVALID_SUBCOMMAND",
      },
      2,
    );
  }

  if (!urlArg) {
    exitWithError(
      Errors.missingArgument("url", "aligntrue remove source <url>"),
      2,
    );
  }

  const urlToRemove = urlArg!;
  const configPath =
    (flags["config"] as string | undefined) || ".aligntrue/config.yaml";

  // Check if config exists
  if (!existsSync(configPath)) {
    exitWithError(
      {
        title: "Config not found",
        message: `Configuration file not found: ${configPath}`,
        hint: "Run 'aligntrue init' to create a configuration file.",
        code: "CONFIG_NOT_FOUND",
      },
      2,
    );
  }

  // Confirm removal in interactive mode unless skipped
  if (isTTY() && !skipConfirmations) {
    const confirmed = await clack.confirm({
      message: `Remove source ${urlToRemove}?`,
      active: "Remove",
      inactive: "Cancel",
    });

    if (clack.isCancel(confirmed) || !confirmed) {
      clack.cancel("Removal cancelled");
      return;
    }
  }

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });
  spinner.start("Removing align source...");

  try {
    // Load config
    let config: AlignTrueConfig | undefined;
    try {
      config = await loadConfigWithValidation(configPath);
    } catch {
      // Fall back to lenient parse so users can repair invalid configs
      try {
        const raw = readFileSync(configPath, "utf-8");
        config = (parseYaml(raw) as AlignTrueConfig) || { sources: [] };
        if (isTTY()) {
          clack.log.warn(
            "Config is invalid. Loaded raw YAML to allow removal of bad sources.",
          );
        }
      } catch (rawError) {
        throw rawError;
      }
    }

    if (!config) {
      throw new Error("Failed to load configuration");
    }

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
      const sourcesList = config.sources.map((source) =>
        source.type === "git" ? `git: ${source.url}` : `local: ${source.path}`,
      );
      exitWithError(
        {
          title: "Source not found",
          message: `No source found matching: ${urlToRemove}`,
          details:
            sourcesList.length > 0
              ? ["Current sources:", ...sourcesList]
              : ["No sources are configured."],
          hint: "Check the URL and run 'aligntrue sources list' to view configured sources.",
          code: "ERR_SOURCE_NOT_FOUND",
        },
        2,
      );
    }

    // Patch config - only update sources, preserve everything else
    await patchConfig({ sources: config.sources }, configPath);

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

    if (error instanceof Error && error.message?.startsWith("process.exit")) {
      throw error;
    }

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
