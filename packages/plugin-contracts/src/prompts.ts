/**
 * Shared prompt utilities for exporters and CLI
 *
 * These prompts are used by exporters during conflict resolution
 * when files have been manually edited by users.
 */

/**
 * Type for file conflict resolution decisions
 */
export type ConflictResolution = "overwrite" | "keep" | "abort";

/**
 * Prompt callback type for interactive conflict resolution
 *
 * Exporters call this when a file has been manually edited and needs user decision.
 * @param filePath - Absolute path to the conflicted file
 * @returns Decision: overwrite (replace with synced), keep (skip), or abort (stop sync)
 */
export type PromptFunction = (filePath: string) => Promise<ConflictResolution>;

/**
 * Global prompt handler - set by CLI during sync
 * Exporters use this during conflict resolution
 */
let globalPromptHandler: PromptFunction | undefined;

/**
 * Set the global prompt handler for interactive conflict resolution
 * Called by CLI during sync initialization
 */
export function setPromptHandler(handler: PromptFunction): void {
  globalPromptHandler = handler;
}

/**
 * Get the current prompt handler
 */
export function getPromptHandler(): PromptFunction | undefined {
  return globalPromptHandler;
}

/**
 * Clear the global prompt handler
 * Called after sync completes
 */
export function clearPromptHandler(): void {
  globalPromptHandler = undefined;
}
