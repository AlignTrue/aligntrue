/**
 * Handle content merging when edit source changes during sync
 *
 * Simplified Strategy (v2): "New Source As Truth"
 * - Always replace IR with new source content
 * - Always backup old source files to overwritten-rules/
 * - No prompt, no complex merge logic
 */

import { readFileSync, existsSync, writeFileSync } from "fs";
import { globSync } from "glob";
import { join } from "path";
import { backupFileToOverwrittenRules } from "./extract-rules.js";

function debugLog(msg: string) {
  try {
    writeFileSync("/tmp/aligntrue-debug.log", msg + "\n", { flag: "a" });
  } catch {}
}

export interface EditSourceSwitchResult {
  /**
   * New content to replace IR with
   */
  content: string;
  /**
   * Files that were backed up from old source
   */
  backedUpFiles: string[];
  /**
   * Human-readable summary of what happened
   */
  summary: string;
}

/**
 * Prepare for edit source switch:
 * 1. Read content from new edit source (to become new IR)
 * 2. Backup files from old edit source (for safety)
 *
 * @param oldEditSource - Previous edit source pattern
 * @param newEditSource - New edit source pattern
 * @param cwd - Working directory
 * @returns Result with new content and backup info
 */
export async function prepareEditSourceSwitch(
  oldEditSource: string | string[] | undefined,
  newEditSource: string,
  cwd: string,
): Promise<EditSourceSwitchResult> {
  const backedUpFiles: string[] = [];

  // 1. Backup old source files
  if (oldEditSource) {
    debugLog(`[DEBUG] Backing up old edit source: ${oldEditSource} in ${cwd}`);
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

  // 2. Read content from new edit source
  debugLog(`[DEBUG] Reading new edit source: ${newEditSource} in ${cwd}`);
  const newContent = readEditSourceContent(newEditSource, cwd);
  debugLog(`[DEBUG] New content length: ${newContent.length}`);

  const summary = `Switched to new source (backed up ${backedUpFiles.length} old file(s))`;

  return {
    content: newContent,
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
    // Use globSync to find files matching pattern
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
