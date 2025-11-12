/**
 * Multi-file parser for two-way sync
 * Detects edited agent files and merges them back to IR
 */

import { existsSync, statSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import micromatch from "micromatch";
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
  files: Array<{ path: string; mtime: Date }>;
  reason: string;
  winner: string; // Path of the file that won (most recent)
}

/**
 * Check if a file path matches the edit_source configuration
 */
export function matchesEditSource(
  filePath: string,
  editSource: string | string[] | undefined,
  _cwd: string,
): boolean {
  if (!editSource) {
    // Default to AGENTS.md if no edit_source specified
    return filePath === "AGENTS.md" || filePath.endsWith("/AGENTS.md");
  }

  if (editSource === ".rules.yaml") {
    // IR only mode - no agent files accept edits
    return false;
  }

  if (editSource === "any_agent_file") {
    // All agent files accept edits
    return isAgentFile(filePath);
  }

  // Single pattern or array of patterns
  const patterns = Array.isArray(editSource) ? editSource : [editSource];

  // Normalize file path for matching
  const normalizedPath = filePath.replace(/\\/g, "/");

  // Try matching with micromatch
  return micromatch.isMatch(normalizedPath, patterns, {
    dot: true,
    nocase: false,
  });
}

/**
 * Check if a file is a known agent file
 */
function isAgentFile(filePath: string): boolean {
  const agentPatterns = [
    "AGENTS.md",
    "CLAUDE.md",
    "CRUSH.md",
    "WARP.md",
    "GEMINI.md",
    ".cursor/rules/**/*.mdc",
    ".vscode/mcp.json",
    ".windsurf/mcp_config.json",
    ".clinerules",
    ".goosehints",
    // Add more patterns as needed
  ];

  const normalizedPath = filePath.replace(/\\/g, "/");
  return micromatch.isMatch(normalizedPath, agentPatterns, {
    dot: true,
    nocase: false,
  });
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
  const editSource = config.sync?.edit_source;

  // Skip detection if edit_source is ".rules.yaml" (IR only mode)
  if (editSource === ".rules.yaml") {
    return [];
  }

  // Backwards compatibility: check two_way if edit_source not set
  if (editSource === undefined && config.sync?.two_way === false) {
    return [];
  }

  // Check AGENTS.md if it matches edit_source
  const agentsMdPath = paths.agentsMd();
  if (
    existsSync(agentsMdPath) &&
    matchesEditSource("AGENTS.md", editSource, cwd)
  ) {
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

  // Check Cursor .mdc files with glob pattern support
  const cursorRulesDir = join(cwd, ".cursor", "rules");
  if (existsSync(cursorRulesDir)) {
    try {
      const files = readdirSync(cursorRulesDir);
      const mdcFiles = files.filter((f) => f.endsWith(".mdc"));

      for (const mdcFile of mdcFiles) {
        const relativePath = `.cursor/rules/${mdcFile}`;
        const absolutePath = join(cursorRulesDir, mdcFile);

        // Check if this file matches edit_source
        if (!matchesEditSource(relativePath, editSource, cwd)) {
          continue;
        }

        const stats = statSync(absolutePath);
        if (!lastSyncTime || stats.mtime > lastSyncTime) {
          // Dynamic import at runtime (exporters is a peer dependency)
          const parseModule = "@aligntrue/exporters/utils/section-parser";
          // @ts-ignore - Dynamic import of peer dependency (resolved at runtime)
          const { parseCursorMdc } = await import(parseModule);
          const content = readFileSync(absolutePath, "utf-8");
          const parsed = parseCursorMdc(content);

          if (parsed.sections.length > 0) {
            editedFiles.push({
              path: relativePath,
              absolutePath,
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
    } catch {
      // Directory not readable, continue
    }
  }

  return editedFiles;
}

/**
 * Detect edits to read-only files (files not in edit_source)
 * Returns list of read-only files that have been edited
 */
export async function detectReadOnlyFileEdits(
  cwd: string,
  config: AlignTrueConfig,
  lastSyncTime?: Date,
): Promise<string[]> {
  const readOnlyEdited: string[] = [];
  const paths = getAlignTruePaths(cwd);
  const editSource = config.sync?.edit_source;

  // If edit_source is "any_agent_file", no files are read-only
  if (editSource === "any_agent_file") {
    return [];
  }

  // Check common agent files that might have been edited
  const candidateFiles = [
    { path: "AGENTS.md", absolutePath: paths.agentsMd() },
  ];

  // Add Cursor files if they exist
  const cursorRulesDir = join(cwd, ".cursor", "rules");
  if (existsSync(cursorRulesDir)) {
    try {
      const files = readdirSync(cursorRulesDir);
      const mdcFiles = files.filter((f) => f.endsWith(".mdc"));
      for (const mdcFile of mdcFiles) {
        candidateFiles.push({
          path: `.cursor/rules/${mdcFile}`,
          absolutePath: join(cursorRulesDir, mdcFile),
        });
      }
    } catch {
      // Directory not readable
    }
  }

  // Check each candidate file
  for (const { path, absolutePath } of candidateFiles) {
    // Skip if file doesn't exist
    if (!existsSync(absolutePath)) {
      continue;
    }

    // Skip if file matches edit_source (it's editable)
    if (matchesEditSource(path, editSource, cwd)) {
      continue;
    }

    // Check if file was modified
    const stats = statSync(absolutePath);
    if (lastSyncTime && stats.mtime > lastSyncTime) {
      readOnlyEdited.push(path);
    }
  }

  return readOnlyEdited;
}

/**
 * Extract scope name from file path
 * Examples:
 *   .cursor/rules/backend.mdc → backend
 *   .cursor/rules/aligntrue.mdc → default
 *   AGENTS.md → default
 */
function extractScopeFromPath(filePath: string): string {
  // Cursor scope files
  const cursorMatch = filePath.match(/\.cursor\/rules\/(.+)\.mdc$/);
  if (cursorMatch) {
    const scopeName = cursorMatch[1];
    return scopeName === "aligntrue" ? "default" : scopeName || "default";
  }

  // Default scope for all other files
  return "default";
}

/**
 * Merge sections from multiple edited files into IR
 * Uses last-write-wins strategy based on file mtime
 * Adds vendor.aligntrue metadata for scope tracking
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
    const sourceScope = extractScopeFromPath(file.path);

    for (const section of file.sections) {
      const key = section.heading.toLowerCase().trim();
      const existing = sectionsByHeading.get(key);

      if (existing) {
        // Conflict: same section in multiple files
        const conflictIndex = conflicts.findIndex(
          (c) => c.heading === section.heading,
        );
        if (conflictIndex >= 0) {
          conflicts[conflictIndex]!.files.push({
            path: file.path,
            mtime: file.mtime,
          });
          // Update winner to most recent
          conflicts[conflictIndex]!.winner = file.path;
        } else {
          conflicts.push({
            heading: section.heading,
            files: [
              { path: existing.file, mtime: existing.mtime },
              { path: file.path, mtime: file.mtime },
            ],
            reason: "Same section edited in multiple files",
            winner: file.path, // Most recent wins
          });
        }
      }

      // Last-write-wins: replace with newer version
      // Add vendor metadata for scope tracking
      sectionsByHeading.set(key, {
        section: {
          heading: section.heading,
          content: section.content,
          level: section.level,
          fingerprint: generateFingerprint(section.heading),
          vendor: {
            aligntrue: {
              source_scope: sourceScope,
              source_file: file.path,
              last_modified: file.mtime.toISOString(),
            },
          },
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
