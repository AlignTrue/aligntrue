/**
 * Source file discovery and loading
 * Handles multi-file source organization (like Ruler)
 */

import { existsSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";
import { glob } from "glob";
import { parse as parseYaml } from "yaml";
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
  // Get source patterns from config (no default fallback - all exporters are equal)
  const patterns = config.sync?.source_files;
  if (!patterns) {
    return [];
  }
  const patternArray = Array.isArray(patterns) ? patterns : [patterns];

  const allFiles: SourceFile[] = [];

  for (const pattern of patternArray) {
    // Skip glob for exact filenames (avoid Windows filesystem cache issues)
    const hasWildcard =
      pattern.includes("*") || pattern.includes("?") || pattern.includes("[");

    let matches: string[] = [];

    if (hasWildcard) {
      // For glob patterns, use glob() for wildcard expansion
      // Add a small delay to ensure filesystem is ready (helps with tests)
      await new Promise((resolve) => setTimeout(resolve, 1));
      matches = await glob(pattern, {
        cwd,
        nodir: true,
        absolute: false,
      });
      // Normalize to forward slashes for cross-platform consistency
      matches = matches.map((p) => p.replace(/\\/g, "/"));
    } else {
      // For exact filenames, use the pattern directly
      // This avoids Windows filesystem cache race conditions
      matches = [pattern];
    }

    for (const relativePath of matches) {
      const absolutePath = join(cwd, relativePath);

      try {
        // Read file content directly - handle errors if file doesn't exist or changed
        const content = readFileSync(absolutePath, "utf-8");

        // Get file stats after reading to avoid race condition
        // If file changed during read, we still use the content we successfully read
        const now = new Date();
        let stats: ReturnType<typeof statSync> = {
          mtime: now,
          isFile: () => true,
        } as ReturnType<typeof statSync>;
        let shouldSkip = false;
        try {
          const fileStats = statSync(absolutePath);
          if (!fileStats.isFile()) {
            // File changed to non-file after read, skip it
            shouldSkip = true;
          } else {
            stats = fileStats;
          }
        } catch {
          // Stat failed after read, but content was valid at read time
          // Use the default stats object we initialized above
        }
        if (shouldSkip) {
          continue;
        }

        // Parse sections from markdown
        // Use the same parser as agents exporter
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
            level: s.level || 2,
            fingerprint: s.hash || "",
          }),
        );

        allFiles.push({
          path: relativePath,
          absolutePath,
          content,
          mtime: stats!.mtime,
          sections: alignSections,
        });
      } catch {
        // Skip files we can't read or that disappear
        continue;
      }
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
 * @param preservedId - Optional ID to preserve from existing IR (instead of using "multi-file-source")
 * @returns Merged AlignPack with all sections
 */
export function mergeSourceFiles(
  files: SourceFile[],
  preservedId?: string,
): AlignPack {
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

/**
 * Load and merge source files into a single AlignPack
 * Main entry point for multi-file source loading
 *
 * Preserves existing IR's ID if .rules.yaml exists, only uses "multi-file-source" as fallback.
 *
 * @param cwd - Current working directory
 * @param config - AlignTrue configuration
 * @returns Merged AlignPack from all source files
 */
export async function loadSourceFiles(
  cwd: string,
  config: AlignTrueConfig,
): Promise<AlignPack> {
  // Try to read existing IR's ID to preserve it
  let existingId: string | undefined;
  const rulesPath = join(cwd, ".aligntrue", ".rules.yaml");
  if (existsSync(rulesPath)) {
    try {
      const rulesContent = readFileSync(rulesPath, "utf-8");
      // Parse YAML properly to extract id field
      const parsed = parseYaml(rulesContent);
      if (typeof parsed === "object" && parsed !== null && "id" in parsed) {
        const id = (parsed as Record<string, unknown>)["id"];
        if (typeof id === "string") {
          existingId = id;
        }
      }
    } catch {
      // Silently ignore if can't read/parse existing IR
    }
  }

  // Discover all source files
  const files = await discoverSourceFiles(cwd, config);

  // If no files found, return empty pack
  if (files.length === 0) {
    return {
      id: existingId || "multi-file-source",
      version: "1.0.0",
      spec_version: "1",
      sections: [],
    };
  }

  // Order files
  const ordered = orderSourceFiles(files, config.sync?.source_order);

  // Merge into single pack, preserving existing IR's ID
  return mergeSourceFiles(ordered, existingId);
}
