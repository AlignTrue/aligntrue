/**
 * Extract sections from natural markdown
 * Parses ## headings and their content into structured sections
 */

import {
  generateFingerprint,
  extractExplicitId,
} from "../tracking/section-fingerprint.js";

/**
 * A section extracted from markdown
 */
export interface Section {
  heading: string; // "Testing instructions"
  level: number; // 2 for ##, 3 for ###
  content: string; // Full markdown content under this heading
  fingerprint: string; // Auto-generated: "testing-instructions-a3f5b2"
  lineStart: number; // Line number where section starts (1-indexed)
  lineEnd: number; // Line number where section ends (1-indexed)
  explicitId?: string; // Optional: <!-- aligntrue-id: custom -->
}

/**
 * Result of extracting sections from markdown
 */
export interface ExtractionResult {
  sections: Section[];
  preamble?: string; // Content before first heading
  errors: Array<{ line: number; message: string; level: "warn" | "error" }>;
}

/**
 * Extract sections from markdown content
 *
 * @param markdown - Raw markdown content
 * @returns Extraction result with sections and any errors
 */
export function extractSections(markdown: string): ExtractionResult {
  const sections: Section[] = [];
  const errors: Array<{
    line: number;
    message: string;
    level: "warn" | "error";
  }> = [];

  // Normalize line endings
  const normalized = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");

  let preamble = "";
  let currentSection: Partial<Section> | null = null;
  let currentContent: string[] = [];
  let inCodeBlock = false;
  let codeBlockFence = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    // Track code blocks to avoid false heading detection
    const fenceMatch = line.match(/^(`{3,}|~{3,})/);
    if (fenceMatch) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockFence = fenceMatch[1]!;
      } else if (line.startsWith(codeBlockFence)) {
        inCodeBlock = false;
        codeBlockFence = "";
      }
    }

    // Skip heading detection inside code blocks
    if (inCodeBlock) {
      if (currentSection) {
        currentContent.push(line);
      } else {
        preamble += line + "\n";
      }
      continue;
    }

    // Detect markdown heading (## or ###, etc.)
    const headingMatch = line.match(/^(#{2,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section if exists
      if (currentSection) {
        sections.push(finalizeSection(currentSection, currentContent, i));
      }

      // Start new section
      const level = headingMatch[1]!.length;
      const heading = headingMatch[2]!.trim();

      currentSection = {
        level,
        heading,
        lineStart: lineNum,
      };
      currentContent = [];
    } else if (currentSection) {
      // Accumulate content for current section
      currentContent.push(line);
    } else {
      // Content before first heading (preamble)
      preamble += line + "\n";
    }
  }

  // Finalize last section
  if (currentSection) {
    sections.push(
      finalizeSection(currentSection, currentContent, lines.length),
    );
  }

  // Validate and warn about duplicate headings
  const headingCounts = new Map<string, number>();
  for (const section of sections) {
    const count = headingCounts.get(section.heading) || 0;
    headingCounts.set(section.heading, count + 1);
  }

  for (const [heading, count] of headingCounts.entries()) {
    if (count > 1) {
      const firstSection = sections.find((s) => s.heading === heading);
      if (firstSection) {
        errors.push({
          line: firstSection.lineStart,
          message: `Duplicate heading "${heading}" appears ${count} times. Consider adding context to distinguish them (e.g., "Testing (API)" vs "Testing (Frontend)").`,
          level: "warn",
        });
      }
    }
  }

  const result: ExtractionResult = {
    sections,
    errors,
  };

  // Only add preamble if it exists (exactOptionalPropertyTypes: true)
  const trimmedPreamble = preamble.trim();
  if (trimmedPreamble) {
    result.preamble = trimmedPreamble;
  }

  return result;
}

/**
 * Finalize a section by computing its fingerprint and end line
 */
function finalizeSection(
  partial: Partial<Section>,
  contentLines: string[],
  currentLine: number,
): Section {
  const content = contentLines.join("\n").trim();
  const heading = partial.heading || "Untitled";
  const level = partial.level || 2;
  const lineStart = partial.lineStart || 1;

  // Extract explicit ID if present
  const explicitId = extractExplicitId(content);

  // Generate fingerprint
  const fingerprint = explicitId || generateFingerprint(heading, content);

  return {
    heading,
    level,
    content,
    fingerprint,
    lineStart,
    lineEnd: currentLine,
    ...(explicitId && { explicitId }),
  };
}

/**
 * Filter sections by level (e.g., only ## level-2 headings)
 */
export function filterSectionsByLevel(
  sections: Section[],
  level: number,
): Section[] {
  return sections.filter((s) => s.level === level);
}

/**
 * Group sections by parent heading (for nested structure)
 * Returns map of parent heading to child sections
 */
export function groupSectionsByParent(
  sections: Section[],
): Map<string, Section[]> {
  const groups = new Map<string, Section[]>();
  let currentParent: string | null = null;

  for (const section of sections) {
    if (section.level === 2) {
      // Top-level section
      currentParent = section.heading;
      groups.set(currentParent, []);
    } else if (currentParent && section.level > 2) {
      // Child section
      const children = groups.get(currentParent) || [];
      children.push(section);
      groups.set(currentParent, children);
    }
  }

  return groups;
}
