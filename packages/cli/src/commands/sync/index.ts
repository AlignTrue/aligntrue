/**
 * Sync command - Main orchestrator
 * Coordinates loading config, pulling sources, and syncing IR to/from agents
 */

import * as clack from "@clack/prompts";
import { parseSyncOptions, showSyncHelp } from "./options.js";
import { buildSyncContext } from "./context-builder.js";
import { executeSyncWorkflow } from "./workflow.js";
import { handleSyncResult, handleSyncError } from "./result-handler.js";
import { checkIfSyncNeeded } from "./sync-checker.js";

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
    // Early check if sync is needed (unless explicit flags override)
    if (!options.force && !options.dryRun) {
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
