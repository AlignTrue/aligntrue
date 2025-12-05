/**
 * Sync command - Main orchestrator
 * Coordinates loading config, pulling sources, and syncing IR to/from agents
 */

import { existsSync } from "fs";
import * as clack from "@clack/prompts";
import { getAlignTruePaths, isTeamModeActive } from "@aligntrue/core";
import { parseSyncOptions, showSyncHelp } from "./options.js";
import { buildSyncContext } from "./context-builder.js";
import { executeSyncWorkflow } from "./workflow.js";
import { handleSyncResult, handleSyncError } from "./result-handler.js";
import { checkIfSyncNeeded } from "./sync-checker.js";
import { exitWithError } from "../../utils/command-utilities.js";
import { isTTY } from "../../utils/tty-helper.js";

/**
 * Check if in team mode without personal config - prompt user to join
 * @returns true if sync should continue, false if user cancelled
 */
async function checkTeamModeJoin(
  cwd: string,
  quiet: boolean,
): Promise<boolean> {
  const paths = getAlignTruePaths(cwd);

  // Only check if team mode is active but personal config doesn't exist
  if (!isTeamModeActive(cwd) || existsSync(paths.config)) {
    return true; // Continue with sync
  }

  // Team mode active but no personal config - this is a new team member
  if (!isTTY()) {
    // Non-interactive: show error with clear fix
    exitWithError(
      1,
      "Team repo detected - personal config missing. This is a team repo but you don't have a personal config yet.",
      {
        hint: "Run: aligntrue team join --yes",
        code: "TEAM_JOIN_REQUIRED",
      },
    );
    return false; // unreachable but TypeScript needs it
  }

  // Interactive: prompt user
  if (!quiet) {
    clack.log.warn("Team repo detected - you need a personal config to sync.");
  }

  const shouldJoin = await clack.confirm({
    message: "Create personal config now?",
    initialValue: true,
  });

  if (clack.isCancel(shouldJoin) || !shouldJoin) {
    if (!quiet) {
      clack.log.info("Run 'aligntrue team join' when you're ready to set up.");
    }
    return false;
  }

  // User said yes - exec team join inline
  const { exec } = await import("child_process");
  const { promisify } = await import("util");
  const execAsync = promisify(exec);

  try {
    await execAsync("aligntrue team join --yes", { cwd });
    if (!quiet) {
      clack.log.success("Personal config created - continuing with sync");
    }
    return true;
  } catch (err) {
    exitWithError(
      1,
      `Failed to create personal config: ${err instanceof Error ? err.message : String(err)}`,
      {
        hint: "Try running: aligntrue team join --yes",
        code: "TEAM_JOIN_FAILED",
      },
    );
    return false;
  }
}

/**
 * Sync command implementation
 */
export async function sync(args: string[]): Promise<void> {
  const options = parseSyncOptions(args);

  if (options.help) {
    showSyncHelp();
    return;
  }

  if (!options.quiet) {
    clack.intro("AlignTrue Sync");
  }

  try {
    // Check if team mode needs join first
    const cwd = process.cwd();
    const shouldContinue = await checkTeamModeJoin(cwd, options.quiet ?? false);
    if (!shouldContinue) {
      return;
    }

    // Early check if sync is needed (unless explicit flags override)
    if (!options.force && !options.dryRun && !options.clean) {
      const syncNeeded = await checkIfSyncNeeded(options);
      if (!syncNeeded) {
        if (!options.quiet) {
          clack.log.success("Everything already in sync");
          clack.outro("✓ No changes detected");
        }
        return; // Early exit - nothing to do
      }
    }

    // Phase 1: Build sync context (load config, sources, exporters)
    const context = await buildSyncContext(options);

    // Phase 2: Execute sync workflow (backup, export to agents)
    const result = await executeSyncWorkflow(context, options);

    // Phase 3: Handle and display results
    await handleSyncResult(result, context, options);
  } catch (error) {
    handleSyncError(error as Error);
  }
}
