/**
 * Extract and save rules from agent files to .aligntrue/extracted-rules.md
 * Used when enabling new agent files as export targets in centralized mode
 */

import { readFileSync, appendFileSync } from "fs";
import { join } from "path";
import { computeHash } from "@aligntrue/schema";
import { ensureDirectoryExists } from "@aligntrue/file-utils";
import type { AlignPack } from "@aligntrue/schema";
import type { ParsedSection } from "@aligntrue/exporters/utils/section-parser";
import {
  parseAgentsMd,
  parseCursorMdc,
  parseGenericMarkdown,
} from "@aligntrue/exporters/utils/section-parser";

export interface ExtractRulesResult {
  extracted: boolean;
  sectionCount: number;
  skippedDuplicates: number;
  extractedRulesPath: string;
}

/**
 * Normalize content for hashing (strip whitespace, normalize line endings)
 */
function normalizeContent(content: string): string {
  return content
    .replace(/\r\n/g, "\n") // Normalize line endings
    .trim();
}

/**
 * Compute content hash (normalized)
 */
function computeContentHash(content: string): string {
  return computeHash(normalizeContent(content));
}

/**
 * Build lookup map of content hashes from IR sections
 */
function buildIRContentHashes(ir: AlignPack | undefined): Map<string, boolean> {
  const hashes = new Map<string, boolean>();
  if (!ir || !ir.sections) {
    return hashes;
  }

  for (const section of ir.sections) {
    const hash = computeContentHash(section.content);
    hashes.set(hash, true);
  }

  return hashes;
}

/**
 * Detect file format from path
 */
function detectFormatFromPath(filePath: string): string {
  if (filePath.endsWith(".mdc")) {
    return "cursor-mdc";
  }
  if (filePath.includes("AGENTS.md")) {
    return "agents";
  }
  if (filePath.endsWith(".md")) {
    return "generic-markdown";
  }
  return "generic-markdown"; // Default fallback
}

/**
 * Parse agent file based on format
 */
async function parseAgentFile(
  filePath: string,
  format: string,
): Promise<ParsedSection[]> {
  const content = readFileSync(filePath, "utf-8");

  try {
    switch (format) {
      case "cursor-mdc":
        return parseCursorMdc(content).sections as ParsedSection[];
      case "agents":
        return parseAgentsMd(content).sections as ParsedSection[];
      case "generic-markdown":
        return parseGenericMarkdown(content).sections as ParsedSection[];
      default:
        return [];
    }
  } catch (error) {
    console.warn(`Failed to parse ${filePath}: ${error}`);
    return [];
  }
}

/**
 * Extract rules from agent file and save to extracted-rules.md
 * Deduplicates based on content hash against current IR
 *
 * @param agentFilePath - Path to agent file (absolute or relative to cwd)
 * @param agentFormat - Format of agent file (cursor-mdc, agents, generic-markdown). If not provided, auto-detected from path.
 * @param cwd - Current working directory
 * @param currentIR - Current IR for deduplication
 * @returns Extraction result with counts and path
 */
export async function extractAndSaveRules(
  agentFilePath: string,
  agentFormat: string | undefined,
  cwd: string,
  currentIR?: AlignPack,
): Promise<ExtractRulesResult> {
  // Auto-detect format if not provided
  const format = agentFormat || detectFormatFromPath(agentFilePath);
  const aligntrueDir = join(cwd, ".aligntrue");
  const extractedRulesPath = join(aligntrueDir, "extracted-rules.md");

  // Ensure .aligntrue directory exists
  ensureDirectoryExists(aligntrueDir);

  // Parse agent file
  const sections = await parseAgentFile(agentFilePath, format);
  if (sections.length === 0) {
    return {
      extracted: false,
      sectionCount: 0,
      skippedDuplicates: 0,
      extractedRulesPath,
    };
  }

  // Build IR content hash lookup
  const irContentHashes = buildIRContentHashes(currentIR);

  // Filter to only new content (content not in IR)
  const newSections = sections.filter((section) => {
    const hash = computeContentHash(section.content);
    return !irContentHashes.has(hash);
  });

  const skippedDuplicates = sections.length - newSections.length;

  if (newSections.length === 0) {
    return {
      extracted: false,
      sectionCount: 0,
      skippedDuplicates,
      extractedRulesPath,
    };
  }

  // Build extraction header
  const relativePath = agentFilePath.startsWith(cwd)
    ? agentFilePath.slice(cwd.length + 1)
    : agentFilePath;

  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0];

  const header = `---
Extracted from: ${relativePath}
Date: ${dateStr} ${timeStr}
Total sections: ${sections.length}
Extracted: ${newSections.length} (new/different from current rules)
Skipped: ${skippedDuplicates} (already in current rules)
Reason: File enabled as export target in centralized mode
---

`;

  // Build content sections
  const contentLines: string[] = [header];
  for (const section of newSections) {
    contentLines.push(`## ${section.heading}`);
    contentLines.push(section.content);
    contentLines.push("");
  }

  // Append separator
  contentLines.push("---\n");

  // Append to extracted-rules.md
  const content = contentLines.join("\n");
  appendFileSync(extractedRulesPath, content, "utf-8");

  return {
    extracted: true,
    sectionCount: newSections.length,
    skippedDuplicates,
    extractedRulesPath,
  };
}
