/**
 * Rule importer for init command
 *
 * Scans for existing agent files and imports them as AlignTrue rules.
 * Uses parseRuleFile() from core to treat each file as a single rule.
 *
 * Includes overlap detection to identify when multiple agent files contain
 * similar content, allowing us to import only the preferred format and
 * backup the rest.
 */

import { readFileSync } from "fs";
import { dirname } from "path";
import {
  detectNestedAgentFiles,
  parseRuleFile,
  findSimilarContent,
  logImport,
  DEFAULT_SIMILARITY_THRESHOLD,
  type RuleFile,
  type NestedAgentFile,
  type FileWithContent,
  type SimilarityGroup,
} from "@aligntrue/core";

/**
 * Extract the nested location from a relative path
 *
 * For files in nested directories, extracts the parent path before the agent-specific
 * directory structure. This is used to set nested_location in frontmatter so exports
 * go back to the original nested location.
 *
 * @example
 * extractNestedLocation("apps/docs/.cursor/rules/web_stack.mdc", "cursor")
 * // returns "apps/docs"
 *
 * extractNestedLocation("packages/cli/AGENTS.md", "agents")
 * // returns "packages/cli"
 *
 * extractNestedLocation(".cursor/rules/global.mdc", "cursor")
 * // returns undefined (root level)
 *
 * @param relativePath Relative path to the file
 * @param type Type of agent file (cursor, agents, claude, other)
 * @returns The nested location or undefined if at root level
 */
export function extractNestedLocation(
  relativePath: string,
  type: string,
): string | undefined {
  // Normalize to forward slashes for cross-platform compatibility
  // (dirname returns backslashes on Windows, but suffixes use forward slashes)
  const dir = dirname(relativePath).replace(/\\/g, "/");

  // Agent-specific directory suffixes to strip
  const suffixes: Record<string, string[]> = {
    cursor: [".cursor/rules", ".cursor"],
    agents: [], // AGENTS.md is directly in its directory
    claude: [], // CLAUDE.md is directly in its directory
    other: [],
  };

  const typeSuffixes = suffixes[type] || [];

  // Try to strip agent-specific suffixes from the directory path
  for (const suffix of typeSuffixes) {
    if (suffix && dir.endsWith(suffix)) {
      const location = dir
        .slice(0, -suffix.length)
        .replace(/\/$/, "")
        .replace(/\.$/, "");
      if (location && location !== ".") {
        return location;
      }
      return undefined;
    }
  }

  // For AGENTS.md and CLAUDE.md, the nested location is the parent directory
  // (since they sit directly in the directory, not in a subdirectory)
  if (type === "agents" || type === "claude") {
    if (dir && dir !== ".") {
      return dir;
    }
  }

  return undefined;
}

/**
 * A duplicate file that was detected as similar to the canonical source
 */
export interface DuplicateFile {
  /** Original file info */
  file: NestedAgentFile;
  /** Similarity score to canonical (0-1) */
  similarity: number;
  /** Path of the canonical file this is a duplicate of */
  canonicalPath: string;
}

/**
 * Result of scanning for existing rules with overlap detection
 */
export interface ScanResult {
  /** Rules to import (canonical sources only) */
  rules: RuleFile[];
  /** Duplicate files that should be backed up */
  duplicates: DuplicateFile[];
  /** Similarity groups for display purposes */
  similarityGroups: SimilarityGroup[];
  /** Whether any overlap was detected */
  hasOverlap: boolean;
}

/**
 * Options for scanning rules
 */
export interface ScanOptions {
  /** Similarity threshold for detecting duplicates (0-1), default 0.75 */
  similarityThreshold?: number;
  /** Whether to detect and deduplicate overlapping files, default true */
  detectOverlap?: boolean;
}

/**
 * Convert a NestedAgentFile to a RuleFile
 *
 * Note: Source metadata is no longer stored in frontmatter.
 * Import events are logged to .aligntrue/.history via logImport().
 */
function convertToRule(
  file: NestedAgentFile,
  cwd: string,
  _now: string,
): RuleFile {
  // Use parseRuleFile from core - treats entire file as one rule
  const rule = parseRuleFile(file.path, cwd);

  // Log import event to audit log (instead of storing in frontmatter)
  // The target filename will be computed after extension conversion
  let targetFilename = rule.filename;
  if (targetFilename.endsWith(".mdc")) {
    targetFilename = targetFilename.slice(0, -4) + ".md";
  }
  logImport(cwd, targetFilename, file.relativePath);

  // Extract nested location from source path so exports go to the correct nested directory
  // e.g., "apps/docs/.cursor/rules/web_stack.mdc" -> nested_location: "apps/docs"
  let nestedLocation = extractNestedLocation(file.relativePath, file.type);

  // If we didn't find nested_location from path but rule has a scope field that looks like a path,
  // infer nested_location from scope. This handles cases where a scoped rule is at root level.
  // e.g., .cursor/rules/web_stack.mdc with scope: "apps/docs" -> nested_location: "apps/docs"
  if (!nestedLocation && rule.frontmatter.scope) {
    const scope = rule.frontmatter.scope;
    // Only treat scope as a path if it contains "/" (like "apps/docs" or "packages/cli")
    // Generic scope values like "reference", "guide", "General" are NOT paths
    if (typeof scope === "string" && scope.includes("/")) {
      nestedLocation = scope;
    }
  }

  if (nestedLocation) {
    rule.frontmatter.nested_location = nestedLocation;
  }

  // Convert .mdc extension to .md for AlignTrue rules directory
  if (rule.filename.endsWith(".mdc")) {
    rule.filename = rule.filename.slice(0, -4) + ".md";
  }
  if (rule.path.endsWith(".mdc")) {
    rule.path = rule.path.slice(0, -4) + ".md";
  }
  if (rule.relativePath?.endsWith(".mdc")) {
    rule.relativePath = rule.relativePath.slice(0, -4) + ".md";
  }

  return rule;
}

/**
 * Scan for existing agent files with overlap detection
 *
 * Detects when multiple agent files (Cursor, AGENTS.md, CLAUDE.md) contain
 * similar content. Returns the canonical sources to import and duplicates
 * to backup.
 *
 * @param cwd Workspace root
 * @param options Scan options
 * @returns Scan result with rules to import and duplicates to backup
 */
export async function scanForExistingRulesWithOverlap(
  cwd: string,
  options: ScanOptions = {},
): Promise<ScanResult> {
  const {
    similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD,
    detectOverlap = true,
  } = options;

  const detectedFiles = await detectNestedAgentFiles(cwd);
  const now = new Date().toISOString().split("T")[0] ?? ""; // YYYY-MM-DD

  // If overlap detection is disabled or only one file, skip similarity analysis
  if (!detectOverlap || detectedFiles.length <= 1) {
    const rules = detectedFiles.map((file) => convertToRule(file, cwd, now));
    return {
      rules,
      duplicates: [],
      similarityGroups: [],
      hasOverlap: false,
    };
  }

  // Build file content map for similarity analysis
  const filesWithContent: FileWithContent[] = detectedFiles.map((file) => ({
    path: file.relativePath,
    content: readFileSync(file.path, "utf-8"),
    type: file.type,
  }));

  // Find similar content groups
  const { groups, unique } = findSimilarContent(
    filesWithContent,
    similarityThreshold,
  );

  // Build result
  const rules: RuleFile[] = [];
  const duplicates: DuplicateFile[] = [];

  // Add unique files as rules
  for (const fileContent of unique) {
    const file = detectedFiles.find((f) => f.relativePath === fileContent.path);
    if (file) {
      rules.push(convertToRule(file, cwd, now));
    }
  }

  // For each similarity group, add canonical as rule and others as duplicates
  for (const group of groups) {
    const canonicalFile = detectedFiles.find(
      (f) => f.relativePath === group.canonical.path,
    );
    if (canonicalFile) {
      rules.push(convertToRule(canonicalFile, cwd, now));
    }

    // Add duplicates
    for (const dup of group.duplicates) {
      const dupFile = detectedFiles.find(
        (f) => f.relativePath === dup.file.path,
      );
      if (dupFile) {
        duplicates.push({
          file: dupFile,
          similarity: dup.similarity,
          canonicalPath: group.canonical.path,
        });
      }
    }
  }

  return {
    rules,
    duplicates,
    similarityGroups: groups,
    hasOverlap: groups.length > 0,
  };
}
