/**
 * Interactive prompts for CLI operations
 *
 * Provides user-facing prompts for conflict resolution, confirmations, and selections.
 */

import * as clack from "@clack/prompts";
import { relative } from "path";
import { setPromptHandler } from "@aligntrue/plugin-contracts";

/**
 * Prompt user to decide what to do with a manually edited file
 *
 * Called when a file was previously written by AlignTrue but has since been
 * manually edited by the user. Presents options to keep edits, overwrite, or abort.
 *
 * @param filePath - Absolute path to the conflicted file
 * @returns Decision: "overwrite" (replace with synced content), "keep" (skip this file), or "abort" (stop sync)
 *
 * @throws Error if user cancels the prompt
 */
export async function promptOverwriteDecision(
  filePath: string,
): Promise<"overwrite" | "keep" | "abort"> {
  const relativePath = relative(process.cwd(), filePath);

  const choice = await clack.select({
    message: `File has been manually edited: ${relativePath}`,
    options: [
      {
        value: "keep",
        label: "Keep my changes (skip sync for this file)",
      },
      {
        value: "overwrite",
        label: "Overwrite with synced content",
      },
      {
        value: "abort",
        label: "Abort sync",
      },
    ],
  });

  if (choice === undefined || typeof choice !== "string") {
    throw new Error("Cancelled");
  }

  return choice as "overwrite" | "keep" | "abort";
}

/**
 * Initialize interactive prompts for conflict resolution
 * Call at the start of sync workflow to enable interactive mode
 */
export function initializePrompts(): void {
  setPromptHandler(promptOverwriteDecision);
}
