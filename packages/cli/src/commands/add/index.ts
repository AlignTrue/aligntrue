/**
 * Add command - Add rules, links (connected sources), or remotes
 */

import { getAlignTruePaths } from "@aligntrue/core";
import {
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../../utils/command-utilities.js";
import { isTTY } from "../../utils/tty-helper.js";
import { createManagedSpinner } from "../../utils/spinner.js";
import { exitWithError } from "../../utils/error-formatter.js";
import { CommonErrors as Errors } from "../../utils/common-errors.js";
import { extractCatalogId, isCatalogId } from "../../utils/catalog-resolver.js";
import { addLink } from "./add-link.js";
import { addRemote } from "./add-remote.js";
import { copyRulesToLocal } from "./copy-local.js";
import { importCatalogCommand } from "./catalog-import.js";
import {
  detectSourceType,
  isPrivateSource,
  normalizeUrl,
} from "./url-detection.js";

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
    flag: "--replace",
    hasValue: false,
    description: "On conflict, replace existing files (backup saved)",
  },
  {
    flag: "--skip-conflicts",
    hasValue: false,
    description: "On conflict, skip incoming files (do not import)",
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
 * Add command implementation
 */
export async function add(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);

  // Show help if requested
  if (help) {
    showStandardHelp({
      name: "add",
      description: "Add rules, links, or remotes",
      usage: "aligntrue add [link|remote] <url> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue add abc123defgh                         # Catalog pack or rule by ID",
        "aligntrue add https://aligntrue.ai/a/abc123defgh  # Catalog pack or rule by URL",
        "aligntrue add https://github.com/org/rules           # One-time copy",
        "aligntrue add link https://github.com/org/rules     # Add as link (updates on sync)",
        "aligntrue add link <url> --personal                 # Personal link",
        "aligntrue add remote https://github.com/me/backup    # Add as push destination",
        "aligntrue add remote <url> --personal                # Set as remotes.personal",
        "aligntrue add remote <url> --shared                  # Set as remotes.shared",
      ],
      notes: [
        "- Default (no subcommand): copies rules to .aligntrue/rules/ (one-time import)",
        "- 'add link': adds to config sources (gets updates on sync)",
        "- 'add remote': adds to config remotes (pushes rules on sync)",
        "- To remove: 'aligntrue remove link <url>'",
      ],
    });
    return;
  }

  // Check for subcommand (link/source or remote)
  const firstArg = positional[0];
  const subcommand =
    firstArg === "remote"
      ? "remote"
      : firstArg === "link" || firstArg === "source"
        ? "link"
        : null;
  const urlArg = subcommand ? positional[1] : positional[0];

  // Validate URL provided
  if (!urlArg) {
    if (subcommand) {
      exitWithError(
        Errors.missingArgument("url", `aligntrue add ${subcommand} <url>`),
        2,
      );
    } else {
      exitWithError(
        Errors.missingArgument(
          "url",
          "aligntrue add <url> or aligntrue add link/remote <url>",
        ),
        2,
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
  const replaceConflicts = (flags["replace"] as boolean | undefined) || false;
  const skipConflicts =
    (flags["skip-conflicts"] as boolean | undefined) || false;
  const nonInteractive = (flags["yes"] as boolean | undefined) || !isTTY();
  const noSync = (flags["no-sync"] as boolean | undefined) || false;

  if (replaceConflicts && skipConflicts) {
    exitWithError(
      {
        title: "Invalid options",
        message: "Use only one of --replace or --skip-conflicts",
        hint: "Choose --replace to overwrite existing files or --skip-conflicts to ignore incoming duplicates",
        code: "INVALID_OPTIONS",
      },
      2,
    );
  }

  const baseUrl = normalizeUrl(urlArg);

  // Show spinner
  const spinner = createManagedSpinner({ disabled: !isTTY() });

  // Early catalog handling to avoid detectSourceType rejecting catalog URLs
  const catalogId =
    !subcommand && isCatalogId(baseUrl) ? extractCatalogId(baseUrl) : null;
  if (!subcommand && catalogId) {
    await importCatalogCommand({
      catalogId,
      cwd,
      paths,
      configPath,
      nonInteractive,
      noSync,
      replaceConflicts,
      skipConflicts,
      spinner,
    });
    return;
  }

  // Detect source type and privacy (non-catalog paths)
  const sourceType = detectSourceType(baseUrl);
  const privateSource = isPrivateSource(baseUrl);

  if (subcommand === "link") {
    // Add as connected link (alias: source)
    await addLink({
      baseUrl,
      sourceType,
      gitRef,
      gitPath,
      configPath,
      privateSource,
      personal: personalFlag,
      noSync,
      spinner,
    });
  } else if (subcommand === "remote") {
    // Validate --shared and --personal are not both set
    if (sharedFlag && personalFlag) {
      exitWithError(
        {
          title: "Invalid options",
          message: "Cannot use both --personal and --shared flags together",
          hint: "Choose one: --personal (for remotes.personal) or --shared (for remotes.shared)",
          code: "INVALID_OPTIONS",
        },
        2,
      );
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
      replaceConflicts,
      skipConflicts,
      spinner,
    });
  }
}
