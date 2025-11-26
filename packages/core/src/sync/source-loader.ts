/**
 * Source file utilities
 * Handles multi-file source organization
 */

import { basename } from "path";
import type { Align, AlignSection } from "@aligntrue/schema";

export interface SourceFile {
  path: string;
  absolutePath: string;
  content: string;
  mtime: Date;
  sections: AlignSection[];
}

/**
 * Order source files by custom order or alphabetically
 *
 * @param files - List of source files
 * @param customOrder - Optional custom ordering by basename
 * @returns Ordered list of source files
 */
export function orderSourceFiles(
  files: SourceFile[],
  customOrder?: string[],
): SourceFile[] {
  if (!customOrder || customOrder.length === 0) {
    // Default: alphabetical by basename
    return [...files].sort((a, b) =>
      basename(a.path).localeCompare(basename(b.path)),
    );
  }

  // Custom order: sort by position in customOrder array
  return [...files].sort((a, b) => {
    const aName = basename(a.path);
    const bName = basename(b.path);
    const aIndex = customOrder.indexOf(aName);
    const bIndex = customOrder.indexOf(bName);

    // Files not in customOrder go to the end (alphabetically)
    if (aIndex === -1 && bIndex === -1) {
      return aName.localeCompare(bName);
    }
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;

    return aIndex - bIndex;
  });
}

/**
 * Merge multiple source files into a single Align
 * Adds source file metadata to each section for provenance
 *
 * @param files - Ordered list of source files
 * @param preservedId - Optional ID to preserve from existing IR (instead of using "multi-file-source")
 * @returns Merged Align with all sections
 */
export function mergeSourceFiles(
  files: SourceFile[],
  preservedId?: string,
): Align {
  const allSections: AlignSection[] = [];

  for (const file of files) {
    for (const section of file.sections) {
      // Add source file metadata for provenance
      const sectionWithSource = { ...section };

      // Initialize vendor metadata if not present
      if (!sectionWithSource.vendor) {
        sectionWithSource.vendor = {};
      }
      if (!sectionWithSource.vendor.aligntrue) {
        sectionWithSource.vendor.aligntrue = {};
      }

      // Add source file information
      sectionWithSource.vendor.aligntrue.source_file = basename(file.path);

      allSections.push(sectionWithSource);
    }
  }

  return {
    id: preservedId || "multi-file-source",
    version: "1.0.0",
    spec_version: "1",
    sections: allSections,
  };
}
