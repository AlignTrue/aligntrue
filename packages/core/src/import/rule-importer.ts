/**
 * Rule importer - fetches and converts rules from external sources
 *
 * Supports:
 * - Git repositories (GitHub, GitLab, etc.)
 * - HTTP/HTTPS URLs
 * - Local file paths (absolute or relative)
 *
 * Uses unified SourceResolver which:
 * - Auto-detects source type
 * - Handles cloning/fetching/caching
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
    const resolved = await resolveSource(source, {
      cwd,
      offlineMode: options.offlineMode ?? undefined,
      forceRefresh: options.forceRefresh ?? undefined,
      consentManager: options.consentManager,
      onProgress: options.onProgress,
    });

    const rules = resolved.rules;

    // Add source metadata to all rules
    const now = new Date().toISOString().split("T")[0] ?? ""; // YYYY-MM-DD
    for (const rule of rules) {
      rule.frontmatter["source"] = source;
      rule.frontmatter["source_added"] = now;
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
