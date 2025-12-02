/**
 * Cleanup utilities for format switching
 *
 * Handles safe removal of old export files when switching between
 * native and agents-md formats, with backup to unified .aligntrue/.backups/files/ folder.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "fs";
import { join, dirname, basename } from "path";
import type { CleanupMode } from "../config/types.js";

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Files that were removed */
  removed: string[];
  /** Files that were backed up */
  backedUp: string[];
  /** Path to the backup directory */
  backupDir: string;
  /** Any warnings during cleanup */
  warnings: string[];
}

/**
 * Agent file patterns for cleanup
 * Maps agent names to their output file patterns (glob-like)
 */
const AGENT_PATTERNS: Record<string, string[]> = {
  cursor: [".cursor/rules/*.mdc"],
  agents: ["AGENTS.md"],
  amazonq: [".amazonq/rules/*.md"],
  kilocode: [".kilocode/rules/*.md"],
  augmentcode: [".augment/rules/*.md"],
  kiro: [".kiro/steering/*.md"],
  "trae-ai": [".trae/rules/*.md"],
  "vscode-mcp": [".vscode/mcp.json"],
  copilot: ["AGENTS.md"], // Uses AGENTS.md
  claude: ["AGENTS.md"], // Uses AGENTS.md
  aider: ["AGENTS.md"], // Uses AGENTS.md
  codex: ["AGENTS.md"], // Uses AGENTS.md
};

/**
 * Get all files matching a pattern in a directory
 */
function getFilesMatchingPattern(outputDir: string, pattern: string): string[] {
  const files: string[] = [];

  // Parse pattern: e.g., ".cursor/rules/*.mdc"
  const parts = pattern.split("/");
  const fileName = parts.pop() || "";
  const subDir = parts.join("/");
  const fullDir = subDir ? join(outputDir, subDir) : outputDir;

  if (!existsSync(fullDir)) {
    return files;
  }

  // Check if it's a glob pattern
  if (fileName.includes("*")) {
    // Simple glob: *.mdc matches all .mdc files
    const ext = fileName.replaceAll("*", "");
    try {
      const entries = readdirSync(fullDir);
      for (const entry of entries) {
        if (entry.endsWith(ext) || (ext === "" && fileName === "*")) {
          files.push(join(fullDir, entry));
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }
  } else {
    // Exact file
    const fullPath = join(fullDir, fileName);
    if (existsSync(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Create backup directory and return its path
 * Uses unified .aligntrue/.backups/files/ location with timestamp
 */
function createBackupDir(outputDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  // Use unified backup location under .aligntrue
  const cwd = outputDir;
  const backupDir = join(cwd, ".aligntrue", ".backups", "files", timestamp);
  mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

/**
 * Backup a file to the backup directory, preserving relative path
 * Adds .bak suffix to make backups clear at a glance
 */
function backupFile(
  file: string,
  outputDir: string,
  backupDir: string,
): string {
  const relativePath = file.startsWith(outputDir)
    ? file.slice(outputDir.length + 1)
    : basename(file);

  // Add .bak suffix to backed-up files
  const backupPath = join(backupDir, `${relativePath}.bak`);
  mkdirSync(dirname(backupPath), { recursive: true });

  try {
    renameSync(file, backupPath);
    return backupPath;
  } catch (err) {
    throw new Error(`Failed to backup ${file}: ${err}`);
  }
}

/**
 * Clean up old export files for an agent when switching formats
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param agent - The agent name
 * @param mode - Cleanup mode: "all" removes all matching files, "managed" only removes tracked files
 * @param trackedFiles - Files previously tracked by AlignTrue (for "managed" mode)
 * @returns Cleanup result with removed files, backups, and warnings
 */
export async function cleanupOldExports(
  outputDir: string,
  agent: string,
  mode: CleanupMode = "all",
  trackedFiles?: string[],
): Promise<CleanupResult> {
  const result: CleanupResult = {
    removed: [],
    backedUp: [],
    backupDir: "",
    warnings: [],
  };

  const patterns = AGENT_PATTERNS[agent];
  if (!patterns) {
    result.warnings.push(`No cleanup patterns defined for agent: ${agent}`);
    return result;
  }

  // Find all files matching patterns
  const filesToClean: string[] = [];
  for (const pattern of patterns) {
    const matches = getFilesMatchingPattern(outputDir, pattern);
    filesToClean.push(...matches);
  }

  if (filesToClean.length === 0) {
    return result;
  }

  // Filter based on mode
  let filesToRemove = filesToClean;
  if (mode === "managed" && trackedFiles) {
    const trackedSet = new Set(trackedFiles.map((f) => join(outputDir, f)));
    filesToRemove = filesToClean.filter((f) => trackedSet.has(f));
  }

  if (filesToRemove.length === 0) {
    return result;
  }

  // Check .alignignore before cleanup
  const { isIgnoredByAlignignore } = await import("../alignignore/index.js");
  const { resolve, relative } = await import("path");
  const cwd = process.cwd();
  const alignignorePath = resolve(cwd, ".alignignore");

  // Filter out files protected by .alignignore
  filesToRemove = filesToRemove.filter((file) => {
    const absolutePath = resolve(cwd, file);
    const relativePath = relative(cwd, absolutePath).replace(/\\/g, "/");
    if (isIgnoredByAlignignore(relativePath, alignignorePath)) {
      result.warnings.push(
        `File protected by .alignignore, skipping cleanup: ${file}`,
      );
      return false;
    }
    return true;
  });

  if (filesToRemove.length === 0) {
    return result;
  }

  // Create backup directory
  result.backupDir = createBackupDir(outputDir);

  // Backup and remove files
  for (const file of filesToRemove) {
    try {
      const backupPath = backupFile(file, outputDir, result.backupDir);
      result.backedUp.push(backupPath);
      result.removed.push(file);
    } catch (err) {
      result.warnings.push(`Failed to cleanup ${file}: ${err}`);
    }
  }

  return result;
}

/**
 * Clean up empty directories after file removal
 */
export function cleanupEmptyDirs(dir: string): void {
  if (!existsSync(dir)) {
    return;
  }

  try {
    const stat = statSync(dir);
    if (!stat.isDirectory()) {
      return;
    }

    const entries = readdirSync(dir);
    if (entries.length === 0) {
      // Directory is empty, remove it
      const { rmdirSync } = require("fs");
      rmdirSync(dir);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Get cleanup patterns for an agent (legacy format switching)
 */
export function getAgentPatterns(agent: string): string[] {
  return AGENT_PATTERNS[agent] || [];
}

/**
 * Check if any files exist for an agent's format
 */
export function agentHasExistingFiles(
  outputDir: string,
  agent: string,
): boolean {
  const patterns = AGENT_PATTERNS[agent] || [];
  for (const pattern of patterns) {
    const matches = getFilesMatchingPattern(outputDir, pattern);
    if (matches.length > 0) {
      return true;
    }
  }
  return false;
}

/**
 * Get all multi-file exporter paths
 */
export function getAllMultiFileExporterPaths(): Record<string, string> {
  return { ...MULTI_FILE_EXPORTERS };
}

/**
 * Multi-file exporter configuration
 * Maps agent names to their export directory paths
 */
const MULTI_FILE_EXPORTERS: Record<string, string> = {
  cursor: ".cursor/rules",
  amazonq: ".amazonq/rules",
  kilocode: ".kilocode/rules",
  augmentcode: ".augment/rules",
  kiro: ".kiro/steering",
  "trae-ai": ".trae/rules",
  openhands: ".openhands/microagents",
  "openhands-config": ".openhands/microagents",
  cline: ".cline/rules",
  "firebase-studio": ".firebase-studio/rules",
  windsurf: ".windsurf/rules",
  roocode: ".roocode/rules",
  zed: ".zed/rules",
  goose: ".goose/rules",
  crush: ".crush/rules",
  warp: ".warp/rules",
  junie: ".junie/rules",
  jules: ".jules/rules",
  opencode: ".opencode/rules",
  "qwen-code": ".qwen-code/rules",
};

/**
 * Get export directory for a multi-file exporter
 * @param agent - Agent name
 * @returns Directory path or undefined if single-file exporter
 */
export function getMultiFileExporterPath(agent: string): string | undefined {
  return MULTI_FILE_EXPORTERS[agent];
}

/**
 * Result of stale export detection
 */
export interface StaleExportGroup {
  /** Directory where stale files were found (relative to output dir) */
  directory: string;
  /** Agent name */
  agent: string;
  /** Stale files (exports with no matching source) */
  files: string[];
}

/**
 * Source rule information for stale export detection
 */
export interface SourceRuleInfo {
  /** Base filename of the rule (without extension) */
  name: string;
  /** Nested location where this rule should export (e.g., "apps/docs") */
  nestedLocation?: string | undefined;
}

/**
 * Normalize a path for comparison by removing leading/trailing slashes and dots,
 * normalizing path separators, and converting to lowercase for case-insensitive comparison.
 *
 * @param path - Path to normalize
 * @returns Normalized path string
 */
function normalizePathForComparison(path: string): string {
  // Remove leading ./ or .\ and trailing slashes
  let normalized = path.replace(/^[./\\]+|[./\\]+$/g, "");
  // Normalize path separators to forward slashes (consistent across platforms)
  normalized = normalized.replace(/\\/g, "/");
  // Convert to lowercase for case-insensitive comparison
  return normalized.toLowerCase();
}

/**
 * Check if an export at a given location is valid for a source rule
 *
 * @param rule - Source rule info
 * @param exportLocation - Where the export was found (undefined = root, string = nested path)
 * @returns true if the export is at the correct location for this rule
 */
function isExportAtCorrectLocation(
  rule: SourceRuleInfo,
  exportLocation: string | undefined,
): boolean {
  // If rule has no nested_location, it should export to root
  if (!rule.nestedLocation) {
    return exportLocation === undefined;
  }
  // If rule has nested_location, export should be in that nested directory
  // Normalize both paths for comparison to handle format differences
  if (!exportLocation) {
    return false;
  }
  return (
    normalizePathForComparison(exportLocation) ===
    normalizePathForComparison(rule.nestedLocation)
  );
}

/**
 * Detect stale exported files (exports with no matching source rule OR at wrong location)
 *
 * Scans multi-file export directories and identifies files that:
 * 1. Don't correspond to any current source rule (orphans from renamed/deleted sources)
 * 2. Are at the wrong location (e.g., root when rule has nested_location set)
 *
 * Only checks multi-file exporters (single-file formats are fully rewritten
 * on each sync, so stale files can't accumulate).
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param sourceRules - Source rule info including names and nested locations
 * @param activeExporters - List of active exporter names
 * @returns Array of stale export groups found
 *
 * @example
 * ```typescript
 * const rules = [
 *   { name: 'security', nestedLocation: undefined },      // exports to root
 *   { name: 'web_stack', nestedLocation: 'apps/docs' }    // exports to apps/docs/
 * ];
 * const stale = detectStaleExports('/workspace', rules, ['cursor']);
 * // If web_stack.mdc exists at root .cursor/rules/, it's flagged as stale
 * // because it should be at apps/docs/.cursor/rules/
 * ```
 */
export function detectStaleExports(
  outputDir: string,
  sourceRules: SourceRuleInfo[],
  activeExporters: string[],
): StaleExportGroup[] {
  const staleGroups: StaleExportGroup[] = [];

  // Build lookup maps for efficient checking
  // Map of lowercase name -> array of rules with that name (could have multiple with different locations)
  const rulesByName = new Map<string, SourceRuleInfo[]>();
  for (const rule of sourceRules) {
    const nameLower = rule.name.toLowerCase();
    const existing = rulesByName.get(nameLower) || [];
    existing.push(rule);
    rulesByName.set(nameLower, existing);
  }

  // Collect all unique nested locations from rules
  const nestedLocations = new Set<string>();
  for (const rule of sourceRules) {
    if (rule.nestedLocation) {
      nestedLocations.add(rule.nestedLocation);
    }
  }

  for (const agent of activeExporters) {
    const dirPath = getMultiFileExporterPath(agent);
    if (!dirPath) continue; // Skip single-file exporters

    // Check root-level exports
    const rootStale = scanDirectoryForStaleExports(
      outputDir,
      dirPath,
      undefined, // root location
      rulesByName,
      agent,
    );
    if (rootStale) {
      staleGroups.push(rootStale);
    }

    // Check nested directories (based on rules' nested_location values)
    for (const nestedLoc of nestedLocations) {
      const nestedDirPath = join(nestedLoc, dirPath);
      const nestedStale = scanDirectoryForStaleExports(
        outputDir,
        nestedDirPath,
        nestedLoc,
        rulesByName,
        agent,
      );
      if (nestedStale) {
        staleGroups.push(nestedStale);
      }
    }
  }

  return staleGroups;
}

/**
 * Scan a directory for stale exports
 *
 * @param outputDir - Workspace root
 * @param dirPath - Relative path to the export directory
 * @param exportLocation - The nested location this directory represents (undefined for root)
 * @param rulesByName - Map of lowercase rule names to their info
 * @param agent - Agent name for the result
 * @returns StaleExportGroup if stale files found, undefined otherwise
 */
function scanDirectoryForStaleExports(
  outputDir: string,
  dirPath: string,
  exportLocation: string | undefined,
  rulesByName: Map<string, SourceRuleInfo[]>,
  agent: string,
): StaleExportGroup | undefined {
  const fullDir = join(outputDir, dirPath);

  // Skip if directory doesn't exist
  if (!existsSync(fullDir)) return undefined;

  try {
    const entries = readdirSync(fullDir);
    const staleFiles: string[] = [];

    for (const entry of entries) {
      const filePath = join(fullDir, entry);

      try {
        const stat = statSync(filePath);

        // Skip directories
        if (stat.isDirectory()) continue;

        // Extract base name (without extension) from exported filename
        // Examples: "ai-guidance.mdc" -> "ai-guidance", "style.md" -> "style"
        const baseNameMatch = entry.match(/^(.+?)\.[^.]+$/);
        const baseName = baseNameMatch?.[1] || entry;
        const baseNameLower = baseName.toLowerCase();

        // Find rules with this name
        const matchingRules = rulesByName.get(baseNameLower);

        if (!matchingRules || matchingRules.length === 0) {
          // No source rule with this name - definitely stale
          staleFiles.push(entry);
        } else {
          // Source rule(s) exist - check if any should export to this location
          const hasValidExport = matchingRules.some((rule) =>
            isExportAtCorrectLocation(rule, exportLocation),
          );

          if (!hasValidExport) {
            // Rule exists but should export elsewhere - this export is stale
            staleFiles.push(entry);
          }
        }
      } catch {
        // Skip files that can't be read (TOCTOU race condition)
      }
    }

    if (staleFiles.length > 0) {
      // Normalize directory path: use forward slashes and remove leading ./ for consistency
      let normalizedDir = dirPath.replace(/\\/g, "/");
      // Remove leading ./ or .\ (but preserve leading . for hidden directories like .cursor)
      normalizedDir = normalizedDir.replace(/^\.\//, "").replace(/^\.\\/, "");
      return {
        directory: normalizedDir,
        agent,
        files: staleFiles.sort(),
      };
    }
  } catch {
    // Skip directories that can't be read
  }

  return undefined;
}

/**
 * Result of cleaning stale exports
 */
export interface CleanResult {
  /** Files that were deleted */
  deleted: string[];
  /** Total size freed (bytes) */
  freedBytes: number;
  /** Any warnings during cleanup */
  warnings: string[];
}

/**
 * Clean stale exported files
 *
 * Deletes all exported files that don't have a corresponding source rule.
 * Respects .alignignore protection.
 *
 * @param outputDir - The output directory (usually workspace root)
 * @param staleGroups - Stale export groups from detectStaleExports()
 * @returns Clean result with deleted files and freed space
 *
 * @example
 * ```typescript
 * const stale = detectStaleExports(cwd, sourceNames, ['cursor']);
 * const result = cleanStaleExports(cwd, stale);
 * console.log(`Removed ${result.deleted.length} stale files`);
 * ```
 */
export async function cleanStaleExports(
  outputDir: string,
  staleGroups: StaleExportGroup[],
): Promise<CleanResult> {
  const result: CleanResult = {
    deleted: [],
    freedBytes: 0,
    warnings: [],
  };

  if (staleGroups.length === 0) {
    return result;
  }

  // Check .alignignore protection
  const { isIgnoredByAlignignore } = await import("../alignignore/index.js");
  const { resolve, relative } = await import("path");
  const cwd = process.cwd();
  const alignignorePath = resolve(cwd, ".alignignore");

  for (const group of staleGroups) {
    const fullDir = join(outputDir, group.directory);

    for (const filename of group.files) {
      const filePath = join(fullDir, filename);

      try {
        // Check if file is protected by .alignignore
        const absolutePath = resolve(cwd, filePath);
        const relativePath = relative(cwd, absolutePath).replace(/\\/g, "/");
        if (isIgnoredByAlignignore(relativePath, alignignorePath)) {
          result.warnings.push(
            `File protected by .alignignore, skipping: ${relativePath}`,
          );
          continue;
        }

        const stat = statSync(filePath);
        result.freedBytes += stat.size;

        // Delete the file
        unlinkSync(filePath);
        result.deleted.push(filename);
      } catch (err) {
        result.warnings.push(
          `Failed to delete ${filename}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  return result;
}
