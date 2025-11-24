/**
 * File merging utilities
 * Logic for merging IR sections with existing file content
 */

import { existsSync, readFileSync } from "fs";
import type { AlignSection } from "@aligntrue/schema";
import {
  matchSections,
  parsedToAlignSection,
} from "../utils/section-matcher.js";
import {
  parseAgentsMd,
  parseCursorMdc,
  parseGenericMarkdown,
  type ParsedSection,
} from "../utils/section-parser.js";

// Re-export types for use by ExporterBase
export type { ParsedSection };

export interface MergeStats {
  kept: number;
  updated: number;
  added: number;
  userAdded: number;
  preservedEdits: number;
}

/**
 * Read and merge existing file with IR sections
 *
 * @param outputPath - Path to existing agent file
 * @param irSections - Sections from IR
 * @param formatType - File format for parsing
 * @param managedSections - Array of team-managed section headings
 */
export async function readAndMerge(
  outputPath: string,
  irSections: AlignSection[],
  formatType: "agents" | "cursor-mdc" | "generic",
  managedSections: string[] = [],
): Promise<{
  mergedSections: AlignSection[];
  userSections: ParsedSection[];
  stats: MergeStats;
  warnings: string[];
}> {
  // If file doesn't exist, just return IR sections
  if (!existsSync(outputPath)) {
    return {
      mergedSections: irSections,
      userSections: [],
      stats: {
        kept: 0,
        updated: 0,
        added: irSections.length,
        userAdded: 0,
        preservedEdits: 0,
      },
      warnings: [],
    };
  }

  // Read and parse existing file
  const content = readFileSync(outputPath, "utf-8");
  let parsed;

  try {
    switch (formatType) {
      case "agents":
        parsed = parseAgentsMd(content);
        break;
      case "cursor-mdc":
        parsed = parseCursorMdc(content);
        break;
      case "generic":
        parsed = parseGenericMarkdown(content);
        break;
    }
  } catch (parseErr) {
    // If parsing fails, treat as empty file (no existing sections to merge)
    return {
      mergedSections: irSections,
      userSections: [],
      stats: {
        kept: 0,
        updated: 0,
        added: irSections.length,
        userAdded: 0,
        preservedEdits: 0,
      },
      warnings: [
        `Warning: Could not parse existing ${formatType} file at ${outputPath}: ${
          parseErr instanceof Error ? parseErr.message : String(parseErr)
        }. File will be overwritten with new content.`,
      ],
    };
  }

  // Match IR sections with existing sections
  const { matches, stats } = matchSections(
    irSections,
    parsed.sections,
    managedSections,
  );

  // Build merged sections list
  const mergedSections: AlignSection[] = [];
  const userSections: ParsedSection[] = [];
  const warnings: string[] = [];

  // Add all IR sections (keep, update, preserve-edit, or add)
  for (const match of matches) {
    if (match.action !== "user-added" && match.irSection) {
      mergedSections.push(match.irSection);
    }
  }

  // Add all user-added sections
  for (const match of matches) {
    if (match.action === "user-added" && match.existingSection) {
      userSections.push(match.existingSection);
      // Convert to AlignSection and add to merged list
      mergedSections.push(parsedToAlignSection(match.existingSection));
    }
  }

  // Generate warnings for merge operations
  if (stats.userAdded > 0) {
    warnings.push(
      `Preserved ${stats.userAdded} personal section${stats.userAdded !== 1 ? "s" : ""}`,
    );
  }

  if (stats.preservedEdits > 0) {
    warnings.push(
      `Preserved ${stats.preservedEdits} edited section${stats.preservedEdits !== 1 ? "s" : ""}`,
    );
  }

  if (stats.updated > 0) {
    warnings.push(
      `Updated ${stats.updated} section${stats.updated !== 1 ? "s" : ""} from IR`,
    );
  }

  return {
    mergedSections,
    userSections,
    stats,
    warnings,
  };
}
