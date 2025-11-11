/**
 * Multi-file parser for two-way sync
 * Detects edited agent files and merges them back to IR
 */

import { existsSync, statSync, readFileSync } from "fs";
import type { AlignTrueConfig } from "../config/index.js";
import type { AlignPack, AlignSection } from "@aligntrue/schema";
import { getAlignTruePaths } from "../paths.js";

interface ParsedSectionResult {
  heading: string;
  content: string;
  level: number;
  hash: string;
}

export interface EditedFile {
  path: string;
  absolutePath: string;
  format: "agents-md" | "cursor-mdc" | "generic";
  sections: ParsedSection[];
  mtime: Date;
}

interface ParsedSection {
  heading: string;
  content: string;
  level: number;
  hash: string;
}

export interface SectionConflict {
  heading: string;
  files: string[];
  reason: string;
}

/**
 * Detect edited agent files based on mtime
 * Returns files that were modified after last sync
 */
export async function detectEditedFiles(
  cwd: string,
  config: AlignTrueConfig,
  lastSyncTime?: Date,
): Promise<EditedFile[]> {
  const editedFiles: EditedFile[] = [];
  const paths = getAlignTruePaths(cwd);

  // Skip detection if two-way sync is disabled
  if (config.sync?.two_way === false) {
    return [];
  }

  // Check AGENTS.md
  const agentsMdPath = paths.agentsMd();
  if (existsSync(agentsMdPath)) {
    const stats = statSync(agentsMdPath);
    if (!lastSyncTime || stats.mtime > lastSyncTime) {
      // Dynamic import at runtime (exporters is a peer dependency)
      const parseModule = "@aligntrue/exporters/utils/section-parser";
      // @ts-ignore - Dynamic import of peer dependency (resolved at runtime)
      const { parseAgentsMd } = await import(parseModule);
      const content = readFileSync(agentsMdPath, "utf-8");
      const parsed = parseAgentsMd(content);

      if (parsed.sections.length > 0) {
        editedFiles.push({
          path: "AGENTS.md",
          absolutePath: agentsMdPath,
          format: "agents-md",
          sections: parsed.sections.map((s: ParsedSectionResult) => ({
            heading: s.heading,
            content: s.content,
            level: s.level,
            hash: s.hash,
          })),
          mtime: stats.mtime,
        });
      }
    }
  }

  // Check Cursor .mdc files (default scope)
  const cursorPath = paths.cursorRules("default");
  if (existsSync(cursorPath)) {
    const stats = statSync(cursorPath);
    if (!lastSyncTime || stats.mtime > lastSyncTime) {
      // Dynamic import at runtime (exporters is a peer dependency)
      const parseModule = "@aligntrue/exporters/utils/section-parser";
      // @ts-ignore - Dynamic import of peer dependency (resolved at runtime)
      const { parseCursorMdc } = await import(parseModule);
      const content = readFileSync(cursorPath, "utf-8");
      const parsed = parseCursorMdc(content);

      if (parsed.sections.length > 0) {
        editedFiles.push({
          path: ".cursor/rules/aligntrue.mdc",
          absolutePath: cursorPath,
          format: "cursor-mdc",
          sections: parsed.sections.map((s: ParsedSectionResult) => ({
            heading: s.heading,
            content: s.content,
            level: s.level,
            hash: s.hash,
          })),
          mtime: stats.mtime,
        });
      }
    }
  }

  return editedFiles;
}

/**
 * Merge sections from multiple edited files into IR
 * Uses last-write-wins strategy based on file mtime
 */
export function mergeFromMultipleFiles(
  editedFiles: EditedFile[],
  currentIR: AlignPack,
): {
  mergedPack: AlignPack;
  conflicts: SectionConflict[];
} {
  const conflicts: SectionConflict[] = [];
  const sectionsByHeading = new Map<
    string,
    { section: AlignSection; file: string; mtime: Date }
  >();

  // Sort files by mtime (oldest first, so newest wins)
  const sortedFiles = [...editedFiles].sort(
    (a, b) => a.mtime.getTime() - b.mtime.getTime(),
  );

  // Process each file's sections
  for (const file of sortedFiles) {
    for (const section of file.sections) {
      const key = section.heading.toLowerCase().trim();
      const existing = sectionsByHeading.get(key);

      if (existing) {
        // Conflict: same section in multiple files
        const conflictIndex = conflicts.findIndex(
          (c) => c.heading === section.heading,
        );
        if (conflictIndex >= 0) {
          conflicts[conflictIndex]!.files.push(file.path);
        } else {
          conflicts.push({
            heading: section.heading,
            files: [existing.file, file.path],
            reason: "Same section edited in multiple files",
          });
        }
      }

      // Last-write-wins: replace with newer version
      sectionsByHeading.set(key, {
        section: {
          heading: section.heading,
          content: section.content,
          level: section.level,
          fingerprint: generateFingerprint(section.heading),
        },
        file: file.path,
        mtime: file.mtime,
      });
    }
  }

  // Build merged pack
  const mergedSections: AlignSection[] = Array.from(
    sectionsByHeading.values(),
  ).map((entry) => entry.section);

  return {
    mergedPack: {
      ...currentIR,
      sections: mergedSections,
    },
    conflicts,
  };
}

/**
 * Generate fingerprint for section (matching schema behavior)
 */
function generateFingerprint(heading: string): string {
  const { createHash } = require("crypto");
  return createHash("sha256")
    .update(heading.toLowerCase().trim(), "utf-8")
    .digest("hex")
    .slice(0, 16);
}
