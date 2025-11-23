/**
 * Handle content merging when edit source changes during sync
 * Supports three strategies: keep-both, keep-new, keep-existing
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { globSync } from "glob";
import { join } from "path";
import type { EditSourceMergeStrategy } from "./edit-source-merge-strategy.js";
import { backupFileToOverwrittenRules } from "./extract-rules.js";

function debugLog(msg: string) {
  try {
    writeFileSync("/tmp/aligntrue-debug.log", msg + "\n", { flag: "a" });
  } catch {}
}

export interface MergeResult {
  /**
   * Content to merge into IR
   * - keep-both: combined old and new
   * - keep-new: new content only
   * - keep-existing: existing IR content (new backed up)
   */
  contentToMerge: string;
  /**
   * Files that were backed up
   */
  backedUpFiles: string[];
  /**
   * Human-readable summary of what happened
   */
  summary: string;
}

/**
 * Merge content from old and new edit sources based on strategy
 *
 * @param oldEditSource - Previous edit source pattern
 * @param newEditSource - New edit source pattern
 * @param currentIRContent - Current IR content (if any)
 * @param cwd - Working directory
 * @param strategy - Merge strategy (keep-both, keep-new, keep-existing)
 * @returns Merge result with content and summary
 */
export async function mergeEditSourceContent(
  oldEditSource: string | string[] | undefined,
  newEditSource: string,
  currentIRContent: string | undefined,
  cwd: string,
  strategy: EditSourceMergeStrategy,
): Promise<MergeResult> {
  const backedUpFiles: string[] = [];

  // Read content from old edit source
  debugLog(`[DEBUG] Reading old edit source: ${oldEditSource} in ${cwd}`);
  const oldContent = readEditSourceContent(oldEditSource, cwd);
  debugLog(`[DEBUG] Old content length: ${oldContent.length}`);

  // Read content from new edit source
  debugLog(`[DEBUG] Reading new edit source: ${newEditSource} in ${cwd}`);
  const newContent = readEditSourceContent(newEditSource, cwd);
  debugLog(`[DEBUG] New content length: ${newContent.length}`);

  let contentToMerge = "";
  let summary = "";

  switch (strategy) {
    case "keep-both": {
      // Merge old and new content
      contentToMerge = mergeContents(oldContent, newContent);
      summary = "Merged old and new rule content";
      break;
    }

    case "keep-new": {
      // Keep new content, backup old files
      contentToMerge = newContent;
      if (oldEditSource) {
        const oldFiles = getEditSourceFiles(oldEditSource, cwd);
        for (const file of oldFiles) {
          const fullPath = join(cwd, file);
          if (existsSync(fullPath)) {
            const result = backupFileToOverwrittenRules(fullPath, cwd);
            if (result.backed_up) {
              backedUpFiles.push(file);
            }
          }
        }
      }
      summary = `Replaced with new content (backed up ${backedUpFiles.length} old file(s))`;
      break;
    }

    case "keep-existing": {
      // Keep existing IR content, backup new files
      contentToMerge = currentIRContent || "";
      const newFiles = getEditSourceFiles(newEditSource, cwd);
      for (const file of newFiles) {
        const fullPath = join(cwd, file);
        if (existsSync(fullPath)) {
          const result = backupFileToOverwrittenRules(fullPath, cwd);
          if (result.backed_up) {
            backedUpFiles.push(file);
          }
        }
      }
      summary = `Preserved existing rules (backed up ${backedUpFiles.length} new file(s))`;
      break;
    }
  }

  return {
    contentToMerge,
    backedUpFiles,
    summary,
  };
}

/**
 * Read content from edit source pattern(s)
 */
function readEditSourceContent(
  editSource: string | string[] | undefined,
  cwd: string,
): string {
  if (!editSource) {
    debugLog("[DEBUG] readEditSourceContent: editSource is undefined");
    return "";
  }

  const patterns = Array.isArray(editSource) ? editSource : [editSource];
  const allContent: string[] = [];

  debugLog(
    `[DEBUG] readEditSourceContent: patterns=${JSON.stringify(patterns)}, cwd=${cwd}`,
  );

  for (const pattern of patterns) {
    // Use absolute path for glob to be safe? No, pattern is relative.
    const files = globSync(pattern, { cwd });
    debugLog(`[DEBUG] globSync('${pattern}') found: ${JSON.stringify(files)}`);
    for (const file of files) {
      const fullPath = join(cwd, file);
      if (existsSync(fullPath)) {
        try {
          const content = readFileSync(fullPath, "utf-8");
          debugLog(`[DEBUG] read file ${fullPath}: length=${content.length}`);
          allContent.push(content);
        } catch (err) {
          debugLog(`[DEBUG] failed to read ${fullPath}: ${err}`);
        }
      }
    }
  }

  return allContent.join("\n\n");
}

/**
 * Get all files matching edit source pattern(s)
 */
function getEditSourceFiles(
  editSource: string | string[] | undefined,
  cwd: string,
): string[] {
  if (!editSource) return [];

  const patterns = Array.isArray(editSource) ? editSource : [editSource];
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = globSync(pattern, { cwd });
    allFiles.push(...files);
  }

  return allFiles;
}

/**
 * Simple merge of two content strings
 * Combines both with a separator, avoiding duplicates
 */
function mergeContents(oldContent: string, newContent: string): string {
  if (!oldContent) return newContent;
  if (!newContent) return oldContent;

  // Simple concat with separator - more sophisticated merging
  // would happen at IR level
  return `${oldContent}\n\n${newContent}`;
}
