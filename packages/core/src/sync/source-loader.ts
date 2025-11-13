/**
 * Source file discovery and loading
 * Handles multi-file source organization (like Ruler)
 */

import { existsSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";
import { glob } from "glob";
import type { AlignTrueConfig } from "../config/index.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";

export interface SourceFile {
  path: string;
  absolutePath: string;
  content: string;
  mtime: Date;
  sections: AlignSection[];
}

/**
 * Discover source files based on config patterns
 *
 * @param cwd - Current working directory
 * @param config - AlignTrue configuration
 * @returns List of discovered source files with parsed sections
 */
export async function discoverSourceFiles(
  cwd: string,
  config: AlignTrueConfig,
): Promise<SourceFile[]> {
  // Get source patterns from config (default: AGENTS.md)
  const patterns = config.sync?.source_files || "AGENTS.md";
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  const allFiles: SourceFile[] = [];

  for (const pattern of patternArray) {
    // Use glob to find matching files
    const matches = await glob(pattern, {
      cwd,
      nodir: true,
      absolute: false,
    });

    for (const relativePath of matches) {
      const absolutePath = join(cwd, relativePath);

      // Skip if file doesn't exist (race condition)
      if (!existsSync(absolutePath)) {
        continue;
      }

      // Read file content and stats
      const content = readFileSync(absolutePath, "utf-8");
      const stats = statSync(absolutePath);

      // Parse sections from markdown
      // Use the same parser as agents-md exporter
      const { parseAgentsMd } = await import("@aligntrue/schema");
      const parsed = parseAgentsMd(content);

      // Convert parsed sections to AlignSection format
      const alignSections: AlignSection[] = parsed.sections.map(
        (s: {
          heading: string;
          content: string;
          level?: number;
          hash?: string;
        }) => ({
          heading: s.heading,
          content: s.content,
          level: s.level || 1,
          fingerprint: s.hash || "",
        }),
      );

      allFiles.push({
        path: relativePath,
        absolutePath,
        content,
        mtime: stats.mtime,
        sections: alignSections,
      });
    }
  }

  return allFiles;
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
 * Merge multiple source files into a single AlignPack
 * Adds source file metadata to each section for provenance
 *
 * @param files - Ordered list of source files
 * @returns Merged AlignPack with all sections
 */
export function mergeSourceFiles(files: SourceFile[]): AlignPack {
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
    id: "multi-file-source",
    version: "1.0.0",
    spec_version: "1",
    sections: allSections,
  };
}

/**
 * Load and merge source files into a single AlignPack
 * Main entry point for multi-file source loading
 *
 * @param cwd - Current working directory
 * @param config - AlignTrue configuration
 * @returns Merged AlignPack from all source files
 */
export async function loadSourceFiles(
  cwd: string,
  config: AlignTrueConfig,
): Promise<AlignPack> {
  // Discover all source files
  const files = await discoverSourceFiles(cwd, config);

  // If no files found, return empty pack
  if (files.length === 0) {
    return {
      id: "multi-file-source",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
    };
  }

  // Order files
  const ordered = orderSourceFiles(files, config.sync?.source_order);

  // Merge into single pack
  return mergeSourceFiles(ordered);
}
