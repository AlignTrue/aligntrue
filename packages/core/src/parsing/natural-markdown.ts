/**
 * High-level API for parsing natural markdown to section-based IR
 * Combines section extraction with optional YAML frontmatter parsing
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  extractSections,
  type Section,
  type ExtractionResult,
} from "./section-extractor.js";

/**
 * Align metadata that can be specified in YAML frontmatter
 */
export interface AlignMetadata {
  id?: string;
  version?: string;
  summary?: string;
  tags?: string[];
  owner?: string;
  source?: string;
  source_sha?: string;
}

/**
 * Result of parsing natural markdown
 */
export interface ParseResult {
  metadata: AlignMetadata;
  sections: Section[];
  preamble?: string;
  errors: Array<{ line: number; message: string; level: "warn" | "error" }>;
}

/**
 * Parse natural markdown with optional YAML frontmatter
 *
 * Supports two formats:
 * 1. Pure markdown (no frontmatter)
 * 2. YAML frontmatter + markdown sections
 *
 * @param markdown - Raw markdown content
 * @param defaultId - Default align ID if not specified in frontmatter
 * @returns Parse result with metadata and sections
 */
export function parseNaturalMarkdown(
  markdown: string,
  defaultId?: string,
): ParseResult {
  const errors: Array<{
    line: number;
    message: string;
    level: "warn" | "error";
  }> = [];

  // Check for YAML frontmatter
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  let metadata: AlignMetadata = {};
  let contentToExtract: string;

  if (frontmatterMatch) {
    // Parse YAML frontmatter
    const frontmatterYaml = frontmatterMatch[1]!;
    contentToExtract = frontmatterMatch[2]!;

    try {
      const parsed = parseYaml(frontmatterYaml);
      if (typeof parsed === "object" && parsed !== null) {
        metadata = parsed as AlignMetadata;
      }
    } catch (err) {
      errors.push({
        line: 1,
        message: `Failed to parse YAML frontmatter: ${err instanceof Error ? err.message : String(err)}`,
        level: "error",
      });
    }
  } else {
    // No frontmatter, extract from entire content
    contentToExtract = markdown;
  }

  // Extract sections from markdown content
  const extractionResult: ExtractionResult = extractSections(contentToExtract);

  // Merge errors
  errors.push(...extractionResult.errors);

  // Apply defaults to metadata
  if (!metadata.id) {
    metadata.id = defaultId || "unnamed-align";
  }
  if (!metadata.version) {
    metadata.version = "1.0.0";
  }

  const result: ParseResult = {
    metadata,
    sections: extractionResult.sections,
    errors,
  };

  // Only add preamble if it exists (exactOptionalPropertyTypes: true)
  if (extractionResult.preamble) {
    result.preamble = extractionResult.preamble;
  }

  return result;
}

/**
 * Generate natural markdown from sections and metadata
 * Inverse of parseNaturalMarkdown
 *
 * @param metadata - Align metadata
 * @param sections - Sections to render
 * @param includeFrontmatter - Whether to include YAML frontmatter (default: only if metadata has non-default values)
 * @returns Markdown string
 */
export function generateNaturalMarkdown(
  metadata: AlignMetadata,
  sections: Section[],
  options?: {
    includeFrontmatter?: boolean;
    preamble?: string;
  },
): string {
  const parts: string[] = [];

  // Determine if frontmatter is needed
  const hasCustomMetadata =
    metadata.id !== "unnamed-align" ||
    metadata.version !== "1.0.0" ||
    metadata.summary ||
    metadata.tags ||
    metadata.owner ||
    metadata.source ||
    metadata.source_sha;

  const shouldIncludeFrontmatter =
    options?.includeFrontmatter ?? hasCustomMetadata;

  // Add YAML frontmatter if needed
  if (shouldIncludeFrontmatter) {
    const frontmatter: Record<string, unknown> = {};
    if (metadata.id) frontmatter["id"] = metadata.id;
    if (metadata.version) frontmatter["version"] = metadata.version;
    if (metadata.summary) frontmatter["summary"] = metadata.summary;
    if (metadata.tags) frontmatter["tags"] = metadata.tags;
    if (metadata.owner) frontmatter["owner"] = metadata.owner;
    if (metadata.source) frontmatter["source"] = metadata.source;
    if (metadata.source_sha) frontmatter["source_sha"] = metadata.source_sha;

    const yaml = stringifyYaml(frontmatter);
    parts.push("---");
    parts.push(yaml.trim());
    parts.push("---");
    parts.push(""); // Blank line after frontmatter
  }

  // Add preamble if present
  if (options?.preamble) {
    parts.push(options.preamble);
    parts.push(""); // Blank line after preamble
  }

  // Add sections
  for (const section of sections) {
    const hashes = "#".repeat(section.level);
    parts.push(`${hashes} ${section.heading}`);
    parts.push(""); // Blank line after heading
    if (section.content) {
      parts.push(section.content);
      parts.push(""); // Blank line after content
    }
  }

  return parts.join("\n").trim() + "\n";
}
