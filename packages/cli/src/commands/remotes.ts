/**
 * Remotes command for AlignTrue CLI
 *
 * Manages remote destinations for rule sync.
 * This is an alias/convenience layer over backup remote subcommands.
 */

import * as clack from "@clack/prompts";
import { join } from "path";
import { loadConfig, createRemotesManager } from "@aligntrue/core";
import {
  exitWithError,
  parseCommonArgs,
  showStandardHelp,
  type ArgDefinition,
} from "../utils/command-utilities.js";
import { withSpinner } from "../utils/spinner.js";

const ARG_DEFINITIONS: ArgDefinition[] = [
  {
    flag: "--help",
    alias: "-h",
    hasValue: false,
    description: "Show help",
  },
  {
    flag: "--dry-run",
    hasValue: false,
    description: "Preview without pushing",
  },
  {
    flag: "--force",
    alias: "-f",
    hasValue: false,
    description: "Force push even if no changes detected",
  },
];

/**
 * Remotes command implementation
 */
export async function remotes(args: string[]): Promise<void> {
  const { flags, positional, help } = parseCommonArgs(args, ARG_DEFINITIONS);

  const subcommand = positional[0];

  // Show help
  if (help || !subcommand) {
    showStandardHelp({
      name: "remotes",
      description: "Manage remote destinations for rule sync",
      usage: "aligntrue remotes <subcommand> [options]",
      args: ARG_DEFINITIONS,
      examples: [
        "aligntrue remotes status          # Show configured remotes and file routing",
        "aligntrue remotes push            # Push rules to all configured remotes",
        "aligntrue remotes push --dry-run  # Preview what would be pushed",
      ],
      notes: [
        "Subcommands: status, push",
        "Configure remotes in .aligntrue/config.yaml under 'remotes:' section",
        "Solo mode: all rules push to remotes.personal by default",
        "Team mode: only scope: personal rules push to remotes.personal",
        "Use 'aligntrue add remote <url>' to add a new remote",
      ],
    });
    return;
  }

  const cwd = process.cwd();

  switch (subcommand) {
    case "status":
      await handleStatus(cwd);
      break;
    case "push":
      await handlePush(cwd, flags);
      break;
    default:
      console.error(`Unknown subcommand: ${subcommand}`);
      console.error("Run 'aligntrue remotes --help' for available subcommands");
      exitWithError(1, `Unknown subcommand: ${subcommand}`, {
        hint: "Run 'aligntrue remotes --help' for available subcommands",
      });
  }
}

async function handleStatus(cwd: string): Promise<void> {
  const config = await loadConfig(undefined, cwd);

  if (!config.remotes) {
    clack.log.warn("No remotes configured");
    clack.log.info("Add remotes section to .aligntrue/config.yaml");
    clack.log.info("Or run: aligntrue add remote <url>");
    exitWithError(2, "No remotes configured", {
      hint: "Add remotes to .aligntrue/config.yaml or run: aligntrue add remote <url>",
      code: "NO_REMOTES_CONFIGURED",
    });
  }

  const rulesDir = join(cwd, ".aligntrue", "rules");
  const mode = config.mode || "solo";

  const remotesManager = createRemotesManager(config.remotes, {
    cwd,
    rulesDir,
    mode,
  });

  // Get source URLs for conflict detection
  const sourceUrls =
    config.sources
      ?.filter((s) => s.type === "git" && s.url)
      .map((s) => s.url!)
      .filter(Boolean) ?? [];

  const summary = await remotesManager.formatStatusSummary(sourceUrls);

  console.log(`\nMode: ${mode}`);
  if (mode === "solo") {
    console.log("  (All rules route to remotes.personal by default)\n");
  } else {
    console.log(
      "  (Rules route based on scope: personal/shared frontmatter)\n",
    );
  }

  console.log(summary);
}

async function handlePush(
  cwd: string,
  flags: Record<string, unknown>,
): Promise<void> {
  const config = await loadConfig(undefined, cwd);

  const dryRun = flags["dry-run"] as boolean | undefined;
  const force = flags["force"] as boolean | undefined;

  if (!config.remotes) {
    clack.log.warn("No remotes configured");
    clack.log.info("Add remotes section to .aligntrue/config.yaml");
    exitWithError(2, "No remotes configured", {
      hint: "Add remotes to .aligntrue/config.yaml or run: aligntrue add remote <url>",
      code: "NO_REMOTES_CONFIGURED",
    });
  }

  const rulesDir = join(cwd, ".aligntrue", "rules");
  const mode = config.mode || "solo";

  const remotesManager = createRemotesManager(config.remotes, {
    cwd,
    rulesDir,
    mode,
  });

  // Get source URLs for conflict detection
  const sourceUrls =
    config.sources
      ?.filter((s) => s.type === "git" && s.url)
      .map((s) => s.url!)
      .filter(Boolean) ?? [];

  if (dryRun) {
    clack.log.info("[DRY RUN] Would push to remotes");
  }

  await withSpinner(
    dryRun ? "Previewing remote sync..." : "Syncing to remotes...",
    async () => {
      const result = await remotesManager.sync({
        cwd,
        sourceUrls,
        ...(dryRun !== undefined && { dryRun }),
        ...(force !== undefined && { force }),
        onProgress: (msg: string) => clack.log.step(msg),
      });

      // Show results
      for (const pushResult of result.results) {
        if (pushResult.skipped) {
          clack.log.info(
            `${pushResult.remoteId}: Skipped (${pushResult.skipReason})`,
          );
        } else if (pushResult.success) {
          clack.log.success(
            `${pushResult.remoteId}: Pushed ${pushResult.filesCount} files${pushResult.commitSha ? ` (${pushResult.commitSha.slice(0, 7)})` : ""}`,
          );
        } else {
          clack.log.error(
            `${pushResult.remoteId}: Failed - ${pushResult.error}`,
          );
        }
      }

      // Show warnings
      for (const warning of result.warnings) {
        clack.log.warn(warning.message);
      }

      // Show diagnostics if no files synced
      if (result.totalFiles === 0 && result.diagnostics) {
        const {
          mode: resolvedMode,
          totalFiles,
          unroutedFiles,
        } = result.diagnostics;
        clack.log.info(`Found ${totalFiles} rule files, 0 routed to remotes`);

        if (resolvedMode === "team") {
          clack.log.info(
            "Team mode uses scope-based routing. Add 'scope: personal' to rule frontmatter.",
          );
        }

        if (unroutedFiles.length > 0 && unroutedFiles.length <= 5) {
          for (const { path, scope, reason } of unroutedFiles) {
            clack.log.step(`  ${path} (${scope}: ${reason})`);
          }
        }
      }

      if (result.success && result.totalFiles > 0) {
        clack.log.success(`Total: ${result.totalFiles} files synced`);
      }
    },
    dryRun ? "Preview complete" : "Sync complete",
    (err) => {
      clack.log.error(`Push failed: ${err.message}`);
      throw err;
    },
  );
}
