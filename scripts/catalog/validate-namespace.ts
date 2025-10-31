/**
 * Namespace ownership validation for catalog (Phase 4)
 *
 * Validates that pack IDs match their declared namespace owners.
 * Prevents namespace squatting during manual curation.
 */

import { readFileSync, existsSync } from "fs";
import YAML from "yaml";

/**
 * Namespace registry entry
 */
export interface NamespaceEntry {
  /** Namespace pattern (e.g., "packs/aligntrue/*") */
  namespace: string;
  /** GitHub org or user that owns this namespace */
  owner: string;
  /** Optional notes about the namespace */
  notes?: string;
}

/**
 * Namespace registry structure
 */
export interface NamespaceRegistry {
  /** Registry format version */
  version: string;
  /** Last updated timestamp */
  updated_at: string;
  /** Namespace entries */
  namespaces: NamespaceEntry[];
}

/**
 * Namespace validation result
 */
export interface NamespaceValidation {
  valid: boolean;
  error?: string;
  owner?: string;
}

/**
 * Load namespace registry from YAML file
 *
 * @param registryPath - Path to catalog/namespaces.yaml
 * @returns Parsed registry
 */
export function loadNamespaceRegistry(registryPath: string): NamespaceRegistry {
  if (!existsSync(registryPath)) {
    // Return empty registry if file doesn't exist yet
    return {
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      namespaces: [],
    };
  }

  try {
    const content = readFileSync(registryPath, "utf8");
    const registry = YAML.parse(content) as NamespaceRegistry;

    // Validate registry structure
    if (!registry.version || !Array.isArray(registry.namespaces)) {
      throw new Error("Invalid namespace registry structure");
    }

    return registry;
  } catch (err) {
    throw new Error(
      `Failed to load namespace registry: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Check if pack ID matches namespace pattern
 *
 * Supports wildcards:
 * - "packs/org/*" matches "packs/org/anything"
 * - "packs/org/sub/*" matches "packs/org/sub/anything"
 * - "packs/org/exact" matches only "packs/org/exact"
 *
 * @param packId - Pack ID to check
 * @param pattern - Namespace pattern
 * @returns True if pack ID matches pattern
 */
export function matchesNamespace(packId: string, pattern: string): boolean {
  // Exact match
  if (packId === pattern) {
    return true;
  }

  // Wildcard match
  if (pattern.endsWith("/*")) {
    const prefix = pattern.slice(0, -2); // Remove /*
    return packId.startsWith(prefix + "/");
  }

  return false;
}

/**
 * Find namespace owner for pack ID
 *
 * @param packId - Pack ID to validate
 * @param registry - Namespace registry
 * @returns Owner if found, undefined otherwise
 */
export function findNamespaceOwner(
  packId: string,
  registry: NamespaceRegistry,
): string | undefined {
  // Find matching namespace (most specific wins)
  let matchedOwner: string | undefined;
  let matchedLength = 0;

  for (const entry of registry.namespaces) {
    if (matchesNamespace(packId, entry.namespace)) {
      // Prefer more specific (longer) patterns
      if (entry.namespace.length > matchedLength) {
        matchedOwner = entry.owner;
        matchedLength = entry.namespace.length;
      }
    }
  }

  return matchedOwner;
}

/**
 * Validate namespace ownership for pack
 *
 * Checks that:
 * 1. Pack ID follows expected format (packs/org/name)
 * 2. Namespace is registered (if registry exists)
 * 3. Claimed owner matches registry
 *
 * @param packId - Pack ID (e.g., "packs/aligntrue/base-global")
 * @param claimedOwner - Owner claimed in pack metadata
 * @param registry - Namespace registry
 * @returns Validation result
 */
export function validateNamespace(
  packId: string,
  claimedOwner: string | undefined,
  registry: NamespaceRegistry,
): NamespaceValidation {
  // Validate pack ID format
  const parts = packId.split("/");
  if (parts.length < 2 || parts[0] !== "packs") {
    return {
      valid: false,
      error: `Invalid pack ID format: ${packId} (expected "packs/org/name")`,
    };
  }

  // Find registered owner
  const registeredOwner = findNamespaceOwner(packId, registry);

  // If namespace is registered, validate match
  if (registeredOwner) {
    if (!claimedOwner) {
      return {
        valid: false,
        error: `Pack ${packId} is in registered namespace "${registeredOwner}" but no owner specified`,
        owner: registeredOwner,
      };
    }

    if (claimedOwner !== registeredOwner) {
      return {
        valid: false,
        error: `Pack ${packId} owner mismatch: claimed "${claimedOwner}", registered "${registeredOwner}"`,
        owner: registeredOwner,
      };
    }

    // Valid: claimed owner matches registry
    return {
      valid: true,
      owner: registeredOwner,
    };
  }

  // Namespace not registered - warn but allow (for new packs)
  // Manual PR review required to update registry
  if (claimedOwner) {
    return {
      valid: true,
      owner: claimedOwner,
    };
  }

  // No owner claimed and namespace not registered - require owner
  return {
    valid: false,
    error: `Pack ${packId} requires namespace_owner field (namespace not registered)`,
  };
}

/**
 * Extract org from pack ID
 *
 * @param packId - Pack ID (e.g., "packs/aligntrue/base-global")
 * @returns Org name or undefined
 */
export function extractOrgFromPackId(packId: string): string | undefined {
  const parts = packId.split("/");
  if (parts.length >= 2 && parts[0] === "packs") {
    return parts[1];
  }
  return undefined;
}
