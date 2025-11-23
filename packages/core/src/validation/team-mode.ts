/**
 * Team mode validation
 * Enforces invariants for team mode configuration
 */

import type { AlignTrueConfig } from "../config/index.js";
import { isPlainObject } from "../overlays/operations.js";
import { ValidationResult, ValidationIssue, valid } from "./framework.js";

/**
 * Validate team mode configuration
 */
export function validateTeamMode(config: AlignTrueConfig): ValidationResult {
  const errors: ValidationIssue[] = [];

  // Only validate if in team mode
  if (config.mode !== "team") {
    return valid();
  }

  // Check for invalid storage combinations
  if (config.storage) {
    for (const [scope, storageConfig] of Object.entries(config.storage)) {
      // In team mode, personal + repo is not allowed
      if (scope === "personal" && storageConfig.type === "repo") {
        errors.push({
          path: `storage.${scope}.type`,
          message: "Personal rules cannot use 'repo' storage in team mode",
          hint: "Change to 'local' or 'remote'",
        });
      }

      // Validate remote storage has URL
      if (storageConfig.type === "remote" && !storageConfig.url) {
        errors.push({
          path: `storage.${scope}.url`,
          message: `Remote storage for scope "${scope}" requires url`,
          hint: "Add url field with git repository URL",
        });
      }
    }
  }

  // Check resources configuration
  if (config.resources) {
    for (const [resourceType, resourceConfig] of Object.entries(
      config.resources,
    )) {
      // Validate scopes are defined
      if (
        !resourceConfig.scopes ||
        Object.keys(resourceConfig.scopes).length === 0
      ) {
        errors.push({
          path: `resources.${resourceType}.scopes`,
          message: `Resource "${resourceType}" must have at least one scope defined`,
          hint: "Add scopes configuration",
        });
      }

      // Validate storage is defined for each scope
      if (resourceConfig.scopes && resourceConfig.storage) {
        for (const scope of Object.keys(resourceConfig.scopes)) {
          if (!resourceConfig.storage[scope]) {
            errors.push({
              path: `resources.${resourceType}.storage.${scope}`,
              message: `No storage configuration for scope "${scope}"`,
              hint: `Add storage.${scope} configuration`,
            });
          }

          // Check for invalid combinations
          const storageConfig = resourceConfig.storage[scope];
          if (
            storageConfig &&
            scope === "personal" &&
            storageConfig.type === "repo"
          ) {
            errors.push({
              path: `resources.${resourceType}.storage.${scope}.type`,
              message: "Personal scope cannot use 'repo' storage in team mode",
              hint: "Change to 'local' or 'remote'",
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return valid();
}

/**
 * Check if storage URL is accessible
 * Basic URL validation - full connectivity check can be added when needed
 */
export async function validateStorageAccess(
  url: string,
): Promise<{ accessible: boolean; error?: string }> {
  // Basic URL format validation
  // Full git connectivity check can be added when needed
  if (!url.includes("git@") && !url.includes("https://")) {
    return {
      accessible: false,
      error: "URL must be SSH (git@...) or HTTPS (https://...)",
    };
  }

  return { accessible: true };
}

/**
 * Validate scope configuration
 */
export function validateScopeConfig(
  scopes: Record<string, unknown>,
): ValidationResult {
  const errors: ValidationIssue[] = [];

  for (const [scope, config] of Object.entries(scopes)) {
    if (!isPlainObject(config)) {
      continue;
    }
    if (!config["sections"]) {
      errors.push({
        path: `scopes.${scope}.sections`,
        message: `Scope "${scope}" must have sections defined`,
        hint: "Add sections array or '*' for all sections",
      });
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
    };
  }

  return valid();
}

/**
 * Check for scope conflicts
 */
export function detectScopeConflicts(
  scopes: Record<string, { sections: string[] | "*" }>,
): Array<{ section: string; scopes: string[] }> {
  const conflicts: Array<{ section: string; scopes: string[] }> = [];
  const sectionToScopes = new Map<string, string[]>();

  for (const [scope, config] of Object.entries(scopes)) {
    if (config.sections === "*") {
      // Wildcard scope - check if any specific sections are defined in other scopes
      for (const [otherScope, otherConfig] of Object.entries(scopes)) {
        if (otherScope !== scope && Array.isArray(otherConfig.sections)) {
          for (const section of otherConfig.sections) {
            const existing = sectionToScopes.get(section) || [];
            existing.push(scope, otherScope);
            sectionToScopes.set(section, existing);
          }
        }
      }
    } else if (Array.isArray(config.sections)) {
      for (const section of config.sections) {
        const existing = sectionToScopes.get(section) || [];
        existing.push(scope);
        sectionToScopes.set(section, existing);
      }
    }
  }

  // Find sections with multiple scopes
  for (const [section, scopeList] of sectionToScopes.entries()) {
    const uniqueScopes = [...new Set(scopeList)];
    if (uniqueScopes.length > 1) {
      conflicts.push({ section, scopes: uniqueScopes });
    }
  }

  return conflicts;
}
