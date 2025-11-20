/**
 * Interactive prompts for sync command
 * Handles new file detection, merge strategy, and drift reconciliation
 */

import * as clack from "@clack/prompts";
import type { DetectedFileWithContent } from "../../utils/detect-agents.js";

/**
 * Action to take with new files
 */
export type NewFileAction = "import_and_merge" | "import_readonly" | "ignore";

/**
 * Result of new file handling prompt
 */
export interface NewFileHandlingResult {
  action: NewFileAction;
  updateEditSource: boolean;
}

/**
 * Prompt user for how to handle newly detected files with content
 * @param files - Array of detected files with content
 * @returns Action to take and whether to update edit_source
 */
export async function promptNewFileHandling(
  files: DetectedFileWithContent[],
): Promise<NewFileHandlingResult> {
  // Show comprehensive drift report
  clack.log.warn("⚠ Detected new content outside tracked files");
  clack.log.step("");

  // Group files by agent
  const filesByAgent = new Map<string, DetectedFileWithContent[]>();
  for (const file of files) {
    const existing = filesByAgent.get(file.agent) || [];
    existing.push(file);
    filesByAgent.set(file.agent, existing);
  }

  // Display files
  for (const [agent, agentFiles] of filesByAgent) {
    const totalSections = agentFiles.reduce(
      (sum, f) => sum + f.sectionCount,
      0,
    );
    clack.log.info(
      `${agent}: ${agentFiles.length} file(s), ${totalSections} section(s)`,
    );
    for (const file of agentFiles) {
      const modifiedAgo = getTimeAgo(file.lastModified);
      clack.log.step(
        `  • ${file.relativePath} - ${file.sectionCount} sections, modified ${modifiedAgo}`,
      );
    }
  }

  clack.log.step("");

  // Prompt for action
  const action = (await clack.select({
    message: "How should we handle these files?",
    options: [
      {
        value: "import_and_merge",
        label: "Import all and merge (recommended)",
        hint: "All sections sync to all agents, add to edit_source, clean up duplicates after",
      },
      {
        value: "import_readonly",
        label: "Import but keep read-only",
        hint: "Merge content once, don't track for future edits",
      },
      {
        value: "ignore",
        label: "Ignore for now",
        hint: "Don't import content, ask again next sync",
      },
    ],
    initialValue: "import_and_merge",
  })) as NewFileAction;

  if (clack.isCancel(action)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  const updateEditSource = action === "import_and_merge";

  return {
    action,
    updateEditSource,
  };
}

/**
 * Prompt user for merge strategy when importing multiple files
 * @param sourceFiles - Array of source file paths
 * @returns Whether to merge all (true) or use advanced config (false)
 */
export async function promptMergeStrategy(
  sourceFiles: string[],
): Promise<boolean> {
  clack.log.step("");
  clack.log.info(
    `Merging ${sourceFiles.length} sources: ${sourceFiles.join(", ")}`,
  );

  const merge = await clack.confirm({
    message: "Merge all rules into one shared set?",
    initialValue: true,
  });

  if (clack.isCancel(merge)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  if (!merge) {
    clack.log.info(
      "Advanced configuration required. See: https://aligntrue.ai/docs/reference/config-reference#sync",
    );
    clack.log.warn(
      "For now, files will be imported but won't auto-sync until configured.",
    );
  }

  return merge as boolean;
}

/**
 * Helper to format time ago
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffWeeks > 0) {
    return `${diffWeeks} week${diffWeeks > 1 ? "s" : ""} ago`;
  }
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/**
 * Prompt to confirm adding files to edit_source
 * @param files - Files to add
 * @returns Whether user confirmed
 */
export async function promptAddToEditSource(
  files: DetectedFileWithContent[],
): Promise<boolean> {
  clack.log.step("");

  const patterns = new Set<string>();
  for (const file of files) {
    // Suggest glob patterns for directories
    if (file.relativePath.includes("/")) {
      const dir = file.relativePath.substring(
        0,
        file.relativePath.lastIndexOf("/"),
      );
      if (file.format === "cursor-mdc") {
        patterns.add(`${dir}/*.mdc`);
      } else if (file.relativePath.endsWith(".md")) {
        patterns.add(`${dir}/*.md`);
      } else {
        patterns.add(file.relativePath);
      }
    } else {
      patterns.add(file.relativePath);
    }
  }

  clack.log.info("Will add to edit_source:");
  for (const pattern of patterns) {
    clack.log.step(`  • ${pattern}`);
  }

  const confirmed = await clack.confirm({
    message: "Add these patterns to edit_source?",
    initialValue: true,
  });

  if (clack.isCancel(confirmed)) {
    clack.cancel("Operation cancelled");
    process.exit(0);
  }

  return confirmed as boolean;
}

/**
 * Show duplicate sections warning
 * @param duplicates - Array of duplicate section names with their sources
 */
export function showDuplicateWarning(
  duplicates: Array<{ heading: string; sources: string[] }>,
): void {
  if (duplicates.length === 0) return;

  clack.log.warn("⚠ Found potential duplicate sections:");
  for (const dup of duplicates) {
    const sourceList = dup.sources.join(", ");
    clack.log.step(`  • "${dup.heading}" in: ${sourceList}`);
  }
  clack.log.info("  Using last-write-wins strategy (newest version kept)");
  clack.log.step("");
}
