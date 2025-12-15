/**
 * Conflict detection and resolution for rule imports
 * Handles filename collisions when importing rules
 */

import { existsSync } from "fs";
import { join, posix as pathPosix, win32 as pathWin32 } from "path";
import { backupOverwrittenFile } from "../utils/overwritten-rules-manager.js";

/**
 * Information about a conflict between existing and incoming rules
 */
export interface ConflictInfo {
  /** Filename that conflicts */
  filename: string;
  /** Full path to existing file */
  existingPath: string;
  /** Title of incoming rule */
  incomingTitle: string;
  /** Source of incoming rule */
  incomingSource: string;
}

/**
 * Resolution choice for a conflict
 */
export type ConflictResolution = "replace" | "keep-both" | "skip";

/**
 * Result of resolving a conflict
 */
export interface ResolvedConflict {
  /** Original filename */
  originalFilename: string;
  /** Final filename to use (may be renamed) */
  finalFilename: string;
  /** Resolution that was applied */
  resolution: ConflictResolution;
  /** Path to backup file if replaced */
  backupPath?: string;
}

/**
 * Detect conflicts between incoming rules and existing rules
 *
 * @param incomingFilenames - Filenames of rules to be imported
 * @param targetDir - Directory where rules will be written
 * @returns Array of conflicts found
 */
export function detectConflicts(
  incomingRules: Array<{ filename: string; title: string; source: string }>,
  targetDir: string,
): ConflictInfo[] {
  const conflicts: ConflictInfo[] = [];

  for (const rule of incomingRules) {
    const targetPath = join(targetDir, rule.filename);

    if (existsSync(targetPath)) {
      conflicts.push({
        filename: rule.filename,
        existingPath: targetPath,
        incomingTitle: rule.title,
        incomingSource: rule.source,
      });
    }
  }

  return conflicts;
}

/**
 * Resolve a single conflict
 *
 * @param conflict - The conflict to resolve
 * @param resolution - How to resolve it
 * @param cwd - Current working directory (for backup paths)
 * @returns Resolution result with final filename and backup path
 */
export function resolveConflict(
  conflict: ConflictInfo,
  resolution: ConflictResolution,
  cwd: string,
): ResolvedConflict {
  const pathOps = pickPathOps(conflict.existingPath, conflict.filename);

  switch (resolution) {
    case "replace": {
      // Backup existing file before replacing
      const backupPath = backupOverwrittenFile(conflict.existingPath, cwd);
      return {
        originalFilename: conflict.filename,
        finalFilename: conflict.filename,
        resolution: "replace",
        backupPath,
      };
    }

    case "keep-both": {
      // Generate a unique filename (preserve directory structure)
      const baseDir = pathOps.dirname(conflict.filename);
      const existingDir = pathOps.dirname(conflict.existingPath);

      // Walk up from the existing file directory to the rules root by popping
      // each segment present in the relative filename directory.
      const segments =
        baseDir && baseDir !== "." ? baseDir.split(/[/\\]+/) : [];
      let rulesRoot = existingDir;
      for (let i = 0; i < segments.length; i += 1) {
        rulesRoot = pathOps.dirname(rulesRoot);
      }

      const uniqueFilename = generateUniqueFilename(
        conflict.filename,
        rulesRoot,
      );
      const finalFilename = toPosix(uniqueFilename);
      return {
        originalFilename: conflict.filename,
        finalFilename,
        resolution: "keep-both",
      };
    }

    case "skip": {
      return {
        originalFilename: conflict.filename,
        finalFilename: conflict.filename,
        resolution: "skip",
      };
    }
  }
}

/**
 * Generate a unique filename by appending a number
 *
 * @param filename - Original filename (may include nested path, e.g., "deep/rule.md")
 * @param rulesDir - Rules directory root (absolute)
 * @returns Unique filename preserving path (e.g., "deep/rule-1.md")
 */
function generateUniqueFilename(filename: string, rulesDir: string): string {
  const pathOps = pickPathOps(rulesDir, filename);
  const ext = pathOps.extname(filename);
  const base = pathOps.basename(filename, ext);
  const dir = pathOps.dirname(filename);

  let counter = 1;
  let candidate =
    dir && dir !== "."
      ? pathOps.join(dir, `${base}-${counter}${ext}`)
      : `${base}-${counter}${ext}`;

  while (existsSync(pathOps.join(rulesDir, candidate))) {
    counter++;
    candidate =
      dir && dir !== "."
        ? pathOps.join(dir, `${base}-${counter}${ext}`)
        : `${base}-${counter}${ext}`;

    // Safety limit to prevent infinite loop
    if (counter > 100) {
      throw new Error(`Could not generate unique filename for ${filename}`);
    }
  }

  return candidate;
}

/**
 * Batch resolve conflicts with a single resolution for all
 *
 * @param conflicts - Array of conflicts
 * @param resolution - Resolution to apply to all
 * @param cwd - Current working directory
 * @returns Array of resolution results
 */
export function resolveAllConflicts(
  conflicts: ConflictInfo[],
  resolution: ConflictResolution,
  cwd: string,
): ResolvedConflict[] {
  return conflicts.map((conflict) =>
    resolveConflict(conflict, resolution, cwd),
  );
}

/**
 * Choose path operations that are compatible with the incoming paths.
 * If any path contains a backslash, use win32 helpers; otherwise use posix.
 */
function pickPathOps(...paths: Array<string | undefined>) {
  const hasBackslash = paths.some((p) => p && p.includes("\\"));
  return hasBackslash ? pathWin32 : pathPosix;
}

function toPosix(path: string): string {
  return path.replace(/\\/g, "/");
}
