/**
 * Patch file writer for merge conflicts (Overlays system)
 * Writes conflict patches to artifacts/ directory
 */

import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { generatePatchFile, type MergeConflict } from "./merge.js";

/**
 * Options for writing patch files
 */
export interface PatchWriterOptions {
  /** Base directory for artifacts (defaults to .aligntrue/artifacts) */
  artifactsDir?: string;
  /** Source identifier (git URL, etc) */
  source?: string;
  /** Custom filename (defaults to merge-conflicts-TIMESTAMP.md) */
  filename?: string;
}

/**
 * Result of patch write operation
 */
export interface PatchWriteResult {
  /** Whether write succeeded */
  success: boolean;
  /** Full path to written patch file */
  path?: string;
  /** Error message (on failure) */
  error?: string;
}

/**
 * Write merge conflicts to a patch file in artifacts/
 *
 * @param conflicts - Array of merge conflicts
 * @param metadata - Patch metadata (hashes, timestamp)
 * @param options - Writer options
 * @returns Result with path or error
 */
export function writePatchFile(
  conflicts: MergeConflict[],
  metadata: {
    baseHash: string;
    newBaseHash: string;
    timestamp: string;
  },
  options?: PatchWriterOptions,
): PatchWriteResult {
  try {
    // Determine artifacts directory
    const artifactsDir = options?.artifactsDir ?? ".aligntrue/artifacts";

    // Ensure directory exists
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true });
    }

    // Generate filename
    const filename =
      options?.filename ??
      `merge-conflicts-${new Date(metadata.timestamp).getTime()}.md`;
    const fullPath = join(artifactsDir, filename);

    // Generate patch content
    const patchMetadata: {
      baseHash: string;
      newBaseHash: string;
      timestamp: string;
      source?: string;
    } = {
      baseHash: metadata.baseHash,
      newBaseHash: metadata.newBaseHash,
      timestamp: metadata.timestamp,
    };
    if (options?.source) {
      patchMetadata.source = options.source;
    }
    const patchContent = generatePatchFile(conflicts, patchMetadata);

    // Write to file
    writeFileSync(fullPath, patchContent, "utf-8");

    return {
      success: true,
      path: fullPath,
    };
  } catch (_error) {
    return {
      success: false,
      error: _error instanceof Error ? _error.message : String(_error),
    };
  }
}

/**
 * List existing patch files in artifacts/
 *
 * @param artifactsDir - Artifacts directory (defaults to .aligntrue/artifacts)
 * @returns Array of patch file paths
 */
export function listPatchFiles(artifactsDir?: string): string[] {
  const dir = artifactsDir ?? ".aligntrue/artifacts";

  if (!existsSync(dir)) {
    return [];
  }

  try {
    const { readdirSync } = require("fs");
    const files = readdirSync(dir);
    return files
      .filter(
        (f: string) => f.startsWith("merge-conflicts-") && f.endsWith(".md"),
      )
      .map((f: string) => join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Delete a patch file
 *
 * @param path - Path to patch file
 * @returns Whether deletion succeeded
 */
export function deletePatchFile(path: string): boolean {
  try {
    const { unlinkSync } = require("fs");
    if (existsSync(path)) {
      unlinkSync(path);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
