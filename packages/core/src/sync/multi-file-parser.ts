/**
 * Scope-aware section filtering and merging
 * Used for team mode and scope resolution
 */

import { computeHash } from "@aligntrue/schema";
import type { AlignSection } from "@aligntrue/schema";

/**
 * Generate fingerprint for section (matching schema behavior)
 */
export function generateFingerprint(heading: string): string {
  return computeHash(heading.toLowerCase().trim()).slice(0, 16);
}

/**
 * Filter sections by scope configuration
 * Returns sections grouped by scope
 */
export function filterSectionsByScope(
  sections: AlignSection[],
  scopeConfig: Record<string, { sections: string[] | "*" }>,
): Record<string, AlignSection[]> {
  const result: Record<string, AlignSection[]> = {};

  // Initialize result with empty arrays for each scope
  for (const scope of Object.keys(scopeConfig)) {
    result[scope] = [];
  }

  // Assign sections to scopes
  for (const section of sections) {
    const sectionHeading = section.heading.toLowerCase().trim();

    for (const [scope, config] of Object.entries(scopeConfig)) {
      const scopeArray = result[scope];
      if (!scopeArray) {
        continue;
      }

      if (config.sections === "*") {
        // Wildcard - include all sections
        scopeArray.push(section);
      } else if (Array.isArray(config.sections)) {
        // Check if section heading matches any in the list
        const matches = config.sections.some(
          (pattern) => sectionHeading === pattern.toLowerCase().trim(),
        );
        if (matches) {
          scopeArray.push(section);
        }
      }
    }
  }

  return result;
}

/**
 * Merge sections from multiple scopes
 * Later scopes override earlier ones for conflicts
 */
export function mergeScopedSections(
  scopedSections: Record<string, AlignSection[]>,
  scopeOrder: string[],
): AlignSection[] {
  const merged = new Map<string, AlignSection>();

  // Process scopes in order
  for (const scope of scopeOrder) {
    const sections = scopedSections[scope] || [];
    for (const section of sections) {
      const key = section.heading.toLowerCase().trim();
      merged.set(key, section);
    }
  }

  return Array.from(merged.values());
}

/**
 * Check if a section belongs to a specific scope
 */
export function sectionMatchesScope(
  section: AlignSection,
  scopeConfig: { sections: string[] | "*" },
): boolean {
  if (scopeConfig.sections === "*") {
    return true;
  }

  if (Array.isArray(scopeConfig.sections)) {
    const sectionHeading = section.heading.toLowerCase().trim();
    return scopeConfig.sections.some(
      (pattern) => sectionHeading === pattern.toLowerCase().trim(),
    );
  }

  return false;
}
