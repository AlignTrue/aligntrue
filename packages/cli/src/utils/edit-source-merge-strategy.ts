/**
 * Merge strategy for handling content when edit source changes during sync
 */

export type EditSourceMergeStrategy =
  | "keep-both"
  | "keep-new"
  | "keep-existing";

export interface EditSourceChangeContext {
  oldEditSource: string | string[] | undefined;
  newEditSource: string;
  mergeStrategy: EditSourceMergeStrategy;
}

/**
 * Prompt user for merge strategy when edit source changes
 * Returns the selected strategy or default if non-interactive
 */
export async function promptEditSourceMergeStrategy(
  oldEditSource: string | string[] | undefined,
  newEditSource: string,
  isNonInteractive: boolean,
): Promise<EditSourceMergeStrategy> {
  // In non-interactive mode, default to "keep-both" (safest option)
  if (isNonInteractive) {
    return "keep-both";
  }

  const clack = await import("@clack/prompts");

  const strategy = await clack.select({
    message: `Edit source changed from "${formatEditSourceForDisplay(oldEditSource)}" to "${newEditSource}"\n\nWhat should happen to your rule content?`,
    options: [
      {
        value: "keep-both",
        label: "Keep both (merge old and new content)",
        hint: "Combine content from both sources",
      },
      {
        value: "keep-new",
        label: "Keep new only (replace with new source)",
        hint: "Old content backed up, new source becomes canonical",
      },
      {
        value: "keep-existing",
        label: "Keep existing only (preserve current rules)",
        hint: "New content backed up, current IR content stays",
      },
    ],
    initialValue: "keep-both",
  });

  if (clack.isCancel(strategy)) {
    clack.cancel("Edit source change cancelled");
    process.exit(0);
  }

  return strategy as EditSourceMergeStrategy;
}

/**
 * Format edit source for user-friendly display
 */
function formatEditSourceForDisplay(
  editSource: string | string[] | undefined,
): string {
  if (!editSource) return "none";
  if (Array.isArray(editSource)) {
    return editSource.join(", ");
  }
  return editSource;
}
