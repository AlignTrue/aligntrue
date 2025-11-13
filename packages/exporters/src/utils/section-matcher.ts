/**
 * Section matcher utility
 * Matches IR sections with parsed file sections for intelligent merging
 */

import type { AlignSection } from "@aligntrue/schema";
import type { ParsedSection } from "./section-parser.js";
import { createHash } from "crypto";

// Re-export ParsedSection for convenience
export type { ParsedSection };

export type MatchAction =
  | "keep"
  | "update"
  | "add"
  | "user-added"
  | "preserve-edit";

export interface MatchResult {
  irSection?: AlignSection;
  existingSection?: ParsedSection;
  action: MatchAction;
  reason: string;
  isTeamManaged: boolean;
}

export interface MergeStats {
  kept: number; // No changes needed
  updated: number; // Hash differs, IR wins
  added: number; // New from IR
  userAdded: number; // In file but not in IR
  preservedEdits: number; // User edited existing section, preserved
}

/**
 * Match IR sections with existing file sections
 * Returns match results and statistics
 */
export function matchSections(
  irSections: AlignSection[],
  existingSections: ParsedSection[],
  managedSections: string[] = [],
): {
  matches: MatchResult[];
  stats: MergeStats;
} {
  const matches: MatchResult[] = [];
  const stats: MergeStats = {
    kept: 0,
    updated: 0,
    added: 0,
    userAdded: 0,
    preservedEdits: 0,
  };

  // Create lookup map for existing sections by normalized heading
  const existingByHeading = new Map<string, ParsedSection>();
  for (const section of existingSections) {
    const key = normalizeHeading(section.heading);
    existingByHeading.set(key, section);
  }

  // Create lookup map for IR sections by normalized heading
  const irByHeading = new Map<string, AlignSection>();
  for (const section of irSections) {
    const key = normalizeHeading(section.heading);
    irByHeading.set(key, section);
  }

  // Match IR sections with existing sections
  for (const irSection of irSections) {
    const key = normalizeHeading(irSection.heading);
    const existing = existingByHeading.get(key);
    const isTeamManaged = managedSections.some(
      (managed) => normalizeHeading(managed) === key,
    );

    if (!existing) {
      // New section from IR - add it
      matches.push({
        irSection,
        action: "add",
        reason: "New section from IR",
        isTeamManaged,
      });
      stats.added++;
    } else {
      // Section exists - check if content changed
      const irHash = computeIRSectionHash(irSection);
      const existingHash = existing.hash;

      if (irHash === existingHash) {
        // Content matches - keep as is
        matches.push({
          irSection,
          existingSection: existing,
          action: "keep",
          reason: "Content unchanged",
          isTeamManaged,
        });
        stats.kept++;
      } else {
        // Content differs - check if this was a user edit that should be preserved
        // If IR section has vendor.aligntrue.last_modified, it came from an agent file edit
        // In that case, we should use the IR version (which already has the user's edit)
        const hasRecentEdit = irSection.vendor?.aligntrue?.last_modified;

        if (hasRecentEdit) {
          // This section was edited in an agent file and merged to IR
          // Use the IR version (which contains the user's edit)
          matches.push({
            irSection,
            existingSection: existing,
            action: "preserve-edit",
            reason: "User edited this section, using merged IR version",
            isTeamManaged,
          });
          stats.preservedEdits++;
        } else {
          // Normal update from IR (no recent user edit)
          matches.push({
            irSection,
            existingSection: existing,
            action: "update",
            reason: "Content changed in IR",
            isTeamManaged,
          });
          stats.updated++;
        }
      }
    }
  }

  // Find user-added sections (in existing but not in IR)
  for (const existing of existingSections) {
    const key = normalizeHeading(existing.heading);
    if (!irByHeading.has(key)) {
      // User-added section - preserve it
      const isTeamManaged = managedSections.some(
        (managed) => normalizeHeading(managed) === key,
      );

      matches.push({
        existingSection: existing,
        action: "user-added",
        reason: "User-added section (not in IR)",
        isTeamManaged,
      });
      stats.userAdded++;
    }
  }

  return { matches, stats };
}

/**
 * Normalize heading for comparison
 * Case-insensitive, trimmed, no special characters
 */
function normalizeHeading(heading: string): string {
  return heading
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "");
}

/**
 * Compute hash for IR section (matches section-parser hash computation)
 */
function computeIRSectionHash(section: AlignSection): string {
  const normalized = `${section.heading}\n${section.content}`.trim();
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}

/**
 * Convert ParsedSection to AlignSection for merging
 */
export function parsedToAlignSection(parsed: ParsedSection): AlignSection {
  // Generate fingerprint from heading for stable identity
  const fingerprint = createHash("sha256")
    .update(parsed.heading.toLowerCase().trim(), "utf-8")
    .digest("hex")
    .slice(0, 16);

  return {
    heading: parsed.heading,
    content: parsed.content,
    level: parsed.level,
    fingerprint,
  };
}
