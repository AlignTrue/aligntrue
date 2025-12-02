/**
 * Rule importer - fetches and converts rules from local sources
 *
 * Supports:
 * - Local file paths (absolute or relative)
 *
 * NOTE: Git source support is provided by @aligntrue/cli.
 * Use CLI commands (aligntrue add, aligntrue sync) for git sources.
 *
 * Uses SourceResolver which:
 * - Supports files and directories
 * - Scans for .md and .mdc files
 * - Preserves directory structure
 * - Converts .mdc to .md format
 */

import type { RuleFile } from "@aligntrue/schema";
import {
  resolveSource,
  type ResolveSourceOptions,
} from "../sources/resolver.js";
import { detectConflicts, type ConflictInfo } from "./conflict-resolver.js";
import { parseSourceUrl, type SourceType } from "./source-detector.js";
import { logImport } from "../audit/history.js";

/**
 * Options for importing rules
 */
export interface ImportOptions extends ResolveSourceOptions {
  /** Source URL, path, or git URL */
  source: string;
  /** Git ref (branch/tag/commit) - only for git sources */
  ref?: string | undefined;
  /** Target directory for imported rules (e.g., .aligntrue/rules) */
  targetDir: string;
  /** Cache directory for git sources (unused - resolver handles caching) */
  cacheDir?: string | undefined;
}

/**
 * Result of importing rules
 */
export interface ImportResult {
  /** Successfully parsed rules */
  rules: RuleFile[];
  /** Conflicts with existing rules */
  conflicts: ConflictInfo[];
  /** Source URL/path */
  source: string;
  /** Detected source type */
  sourceType: SourceType;
  /** Error message if import failed */
  error?: string;
}

/**
 * Import rules from a source
 *
 * Uses unified SourceResolver to fetch and parse rules.
 * Adds source metadata and detects conflicts with existing rules.
 *
 * @param options - Import options
 * @returns Import result with rules and any conflicts
 */
export async function importRules(
  options: ImportOptions,
): Promise<ImportResult> {
  const { source, cwd = process.cwd(), targetDir } = options;
  const parsed = parseSourceUrl(source);

  try {
    // Use unified resolver to fetch and parse rules
    // Note: Git sources will throw an error - use CLI's importRules for git support
    const resolved = await resolveSource(source, {
      cwd,
      offlineMode: options.offlineMode ?? undefined,
      forceRefresh: options.forceRefresh ?? undefined,
      onProgress: options.onProgress,
    });

    const rules = resolved.rules;

    // Log import events to audit log (instead of storing in frontmatter)
    for (const rule of rules) {
      logImport(cwd, rule.filename, source);
    }

    // Detect conflicts with existing rules
    const conflicts = detectConflicts(
      rules.map((r) => ({
        filename: r.filename,
        title: r.frontmatter.title || r.filename,
        source,
      })),
      targetDir,
    );

    return {
      rules,
      conflicts,
      source,
      sourceType: parsed.type,
    };
  } catch (error) {
    return {
      rules: [],
      conflicts: [],
      source,
      sourceType: parsed.type,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
