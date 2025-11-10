/**
 * Hierarchical scope resolution with merge rules for monorepo support
 */

import { posix } from "path";
import micromatch from "micromatch";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import type { ResolvedScope } from "@aligntrue/plugin-contracts";

/**
 * Scope definition with path-based includes/excludes
 */
export interface Scope {
  path: string; // Relative path from workspace root
  include?: string[]; // Glob patterns to include
  exclude?: string[]; // Glob patterns to exclude
  rulesets?: string[]; // Rule IDs to apply (optional, for filtering)
}

// Re-export ResolvedScope from plugin-contracts for convenience
export type { ResolvedScope };

/**
 * Merge order for rule precedence
 * - root: Rules from workspace root
 * - path: Rules from path-specific configs
 * - local: Rules from local/nested configs
 */
export type MergeOrder = Array<"root" | "path" | "local">;

/**
 * Configuration for scope resolution
 */
export interface ScopeConfig {
  scopes: Scope[];
  merge?: {
    strategy?: "deep"; // Only deep merge supported in P1
    order?: MergeOrder; // Default: [root, path, local]
  };
}

/**
 * Result of applying scopes to sections
 */
export interface ScopedRules {
  scopePath: string;
  rules: AlignSection[];
}

/**
 * Normalize a file path to use forward slashes (Windows compatibility)
 */
export function normalizePath(filepath: string): string {
  // Convert backslashes to forward slashes
  let normalized = filepath.replace(/\\/g, "/");

  // Remove leading ./ if present
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  // Ensure no leading slash (relative paths)
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  return normalized;
}

/**
 * Validate that a path doesn't contain dangerous traversal patterns
 */
export function validateScopePath(path: string): void {
  // Check for absolute paths before normalization
  if (posix.isAbsolute(path) || path.startsWith("/")) {
    throw new Error(`Invalid scope path "${path}": absolute paths not allowed`);
  }

  const normalized = normalizePath(path);

  // Check for parent directory traversal
  if (normalized.includes("..")) {
    throw new Error(
      `Invalid scope path "${path}": parent directory traversal (..) not allowed`,
    );
  }
}

/**
 * Validate glob patterns are syntactically valid
 */
export function validateGlobPatterns(patterns?: string[]): void {
  if (!patterns || patterns.length === 0) {
    return;
  }

  for (const pattern of patterns) {
    try {
      // micromatch.makeRe can throw on truly invalid patterns
      // It returns a RegExp for valid patterns (very permissive)
      micromatch.makeRe(pattern);
    } catch (_err) {
      throw new Error(
        `Invalid glob pattern "${pattern}": ${_err instanceof Error ? _err.message : String(_err)}`,
      );
    }
  }
}

/**
 * Validate merge order contains only valid values
 */
export function validateMergeOrder(order: MergeOrder): void {
  const validValues = new Set(["root", "path", "local"]);

  for (const item of order) {
    if (!validValues.has(item)) {
      throw new Error(
        `Invalid merge order value "${item}": must be one of root, path, local`,
      );
    }
  }

  // Check for duplicates
  const seen = new Set<string>();
  for (const item of order) {
    if (seen.has(item)) {
      throw new Error(`Duplicate merge order value "${item}"`);
    }
    seen.add(item);
  }
}

/**
 * Resolve scopes with normalized paths and validation
 */
export function resolveScopes(
  workspacePath: string,
  config: ScopeConfig,
): ResolvedScope[] {
  const resolved: ResolvedScope[] = [];

  for (const scope of config.scopes) {
    // Validate path and patterns
    validateScopePath(scope.path);
    validateGlobPatterns(scope.include);
    validateGlobPatterns(scope.exclude);

    const normalizedPath = normalizePath(scope.path);
    const isDefault = normalizedPath === "." || normalizedPath === "";

    resolved.push({
      ...scope,
      normalizedPath,
      isDefault,
    });
  }

  // Validate merge order if provided
  if (config.merge?.order) {
    validateMergeOrder(config.merge.order);
  }

  return resolved;
}

/**
 * Match files to scopes based on include/exclude patterns
 * Last matching scope wins for each file
 */
export function matchFilesToScopes(
  files: string[],
  scopes: ResolvedScope[],
): Map<string, ResolvedScope> {
  const matches = new Map<string, ResolvedScope>();

  for (const file of files) {
    const normalizedFile = normalizePath(file);

    // Find last matching scope (last wins)
    for (const scope of scopes) {
      const shouldMatch = matchFileToScope(normalizedFile, scope);

      if (shouldMatch) {
        matches.set(normalizedFile, scope);
      }
    }
  }

  return matches;
}

/**
 * Check if a file matches a single scope's include/exclude patterns
 */
function matchFileToScope(file: string, scope: ResolvedScope): boolean {
  const { include = [], exclude = [], normalizedPath } = scope;

  // File must be within scope's path
  const scopePath =
    normalizedPath === "." || normalizedPath === "" ? "" : normalizedPath;
  if (scopePath && !file.startsWith(scopePath)) {
    return false;
  }

  // If no include patterns, include everything in path
  const includeMatch =
    include.length === 0 || micromatch.isMatch(file, include);

  // Exclude overrides include
  const excludeMatch = exclude.length > 0 && micromatch.isMatch(file, exclude);

  return includeMatch && !excludeMatch;
}

/**
 * Merge sections by fingerprint with precedence order
 * Later sections in order override earlier ones (last-write-wins)
 */
export function applyScopeMerge(
  rulesByLevel: Map<"root" | "path" | "local", AlignSection[]>,
  order: MergeOrder = ["root", "path", "local"],
): AlignSection[] {
  const mergedSectionsByFingerprint = new Map<string, AlignSection>();

  // Process sections in order (later override earlier)
  for (const level of order) {
    const sections = rulesByLevel.get(level) || [];

    for (const section of sections) {
      // Later sections override earlier ones
      mergedSectionsByFingerprint.set(section.fingerprint, section);
    }
  }

  return Array.from(mergedSectionsByFingerprint.values()).sort((a, b) =>
    a.fingerprint.localeCompare(b.fingerprint),
  );
}

/**
 * Group sections by their source level (root/path/local)
 * This is a helper for callers who need to organize sections before merging
 */
export function groupRulesByLevel(
  packs: Array<{ pack: AlignPack; level: "root" | "path" | "local" }>,
): Map<"root" | "path" | "local", AlignSection[]> {
  const grouped = new Map<"root" | "path" | "local", AlignSection[]>();
  grouped.set("root", []);
  grouped.set("path", []);
  grouped.set("local", []);

  for (const { pack, level } of packs) {
    const existing = grouped.get(level)!;
    existing.push(...pack.sections);
  }

  return grouped;
}
