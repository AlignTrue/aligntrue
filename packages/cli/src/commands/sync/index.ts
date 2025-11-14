/**
 * Sync command - Main orchestrator
 * Coordinates loading config, pulling sources, and syncing IR to/from agents
 */

import * as clack from "@clack/prompts";
import { parseSyncOptions, showSyncHelp } from "./options.js";
import { buildSyncContext } from "./context-builder.js";
import { executeSyncWorkflow } from "./workflow.js";
import { handleSyncResult, handleSyncError } from "./result-handler.js";

/**
 * Sync command implementation
 */
export async function sync(args: string[]): Promise<void> {
  const options = parseSyncOptions(args);

  if (options.help) {
    showSyncHelp();
    return;
  }

  clack.intro("AlignTrue Sync");

  try {
    // Phase 1: Build sync context (load config, sources, exporters)
    const context = await buildSyncContext(options);

    // Phase 2: Execute sync workflow (backup, two-way sync, sync execution)
    const result = await executeSyncWorkflow(context, options);

    // Phase 3: Handle and display results
    await handleSyncResult(result, context, options);
  } catch (error) {
    // Create a minimal spinner for error handling
    const spinner = clack.spinner();
    handleSyncError(error as Error, spinner);
  }
}
