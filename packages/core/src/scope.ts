/**
 * Hierarchical scope resolution with merge rules for monorepo support
 */

import micromatch from "micromatch";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import type { ResolvedScope } from "@aligntrue/plugin-contracts";

import type { AlignTrueConfig } from "./config/types.js";
import { validateGlobPattern, checkScopePath } from "./validation/index.js";

/**
 * Scope definition with path-based includes/excludes
 */
export interface Scope {
  path: string; // Relative path from workspace root
  inherit?: boolean; // Default: true
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
import { normalizePath } from "./paths.js";

export { normalizePath };

/**
 * Validate that a path doesn't contain dangerous traversal patterns
 */
export function validateScopePath(path: string): void {
  const result = checkScopePath(path);
  if (!result.valid) {
    // Throw error to maintain backward compatibility
    const message =
      result.errors?.[0]?.message || `Invalid scope path "${path}"`;
    throw new Error(message);
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
    const result = validateGlobPattern(pattern);
    if (!result.valid) {
      const message =
        result.errors?.[0]?.message || `Invalid glob pattern "${pattern}"`;
      throw new Error(message);
    }

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
 * Resolve hierarchical scope chain for a given scope path
 * Returns array of scope paths from root to target scope
 * e.g. "apps/web" -> [".", "apps", "apps/web"]
 *
 * Respects inherit: false setting in config to break the chain
 */
export function resolveHierarchicalScopes(
  scopePath: string,
  config: AlignTrueConfig,
): string[] {
  const normalizedTarget = normalizePath(scopePath);
  const isDefault = normalizedTarget === "." || normalizedTarget === "";

  // If root scope, just return root
  if (isDefault) {
    return ["."];
  }

  // Find all defined scopes in config
  const definedScopes = resolveScopes(process.cwd(), {
    scopes: config.scopes || [],
  });

  // Build potential chain by path segments
  const parts = normalizedTarget.split("/");
  const chain: string[] = ["."]; // Always start with root
  let currentPath = "";

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    chain.push(currentPath);
  }

  // Filter chain to only include scopes that are defined in config OR are the target
  // (Implicit intermediate scopes are allowed if they match a defined scope)
  // Actually, we only care about scopes that have rules associated with them.
  // But for inheritance, we need to check the 'inherit' flag of the *child* scope.

  // We walk the chain from leaf (target) up to root.
  // If we encounter a scope with inherit: false, we stop.

  const resultChain: string[] = [];
  let currentScopePath = normalizedTarget;

  // Walk up from target
  while (true) {
    resultChain.unshift(currentScopePath); // Add to front

    // Find config for current scope
    const scopeConfig = definedScopes.find(
      (s) => s.normalizedPath === currentScopePath,
    );

    // Check inheritance (default true)
    // If inherit is explicitly false, stop walking up
    if (scopeConfig && scopeConfig.inherit === false) {
      break;
    }

    // Move to parent
    if (currentScopePath === "." || currentScopePath === "") {
      break; // Reached root
    }

    const lastSlash = currentScopePath.lastIndexOf("/");
    if (lastSlash === -1) {
      currentScopePath = "."; // Parent of top-level dir is root
    } else {
      currentScopePath = currentScopePath.substring(0, lastSlash);
    }
  }

  // Ensure root is "." not ""
  return resultChain.map((p) => (p === "" ? "." : p));
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
