/**
 * Generate markdown from IR (for round-trip workflows)
 */

import { stringify as stringifyYaml } from "yaml";
import type { IRDocument, MarkdownMetadata } from "./ir-builder.js";

export interface GenerateOptions {
  preserveMetadata?: boolean; // Use _markdown_meta if available
  headerText?: string; // Override header (default: "# AlignTrue Rules")
  indentSize?: number; // Override indent (default: 2)
  lineEndings?: "lf" | "crlf"; // Override line endings (default: 'lf')
}

/**
 * Generate markdown from IR document
 *
 * @param ir - IR document to convert to markdown
 * @param options - Generation options
 * @returns Markdown string with fenced block
 */
export function generateMarkdown(
  ir: IRDocument,
  options?: GenerateOptions,
): string {
  const opts = options || {};

  // Extract metadata if preserving
  const meta: MarkdownMetadata | undefined =
    opts.preserveMetadata && ir._markdown_meta ? ir._markdown_meta : undefined;

  // Determine settings (metadata > options > defaults)
  const header = opts.headerText || meta?.header_prefix || "# AlignTrue Rules";

  const indentSize =
    opts.indentSize || meta?.whitespace_style?.indent_size || 2;

  const useSpaces = meta?.whitespace_style?.indent === "tabs" ? false : true;

  const lineEnding =
    opts.lineEndings || meta?.whitespace_style?.line_endings || "lf";

  // Build clean IR for YAML generation (remove metadata fields)
  const cleanIr = { ...ir };
  delete cleanIr._markdown_meta;
  delete cleanIr.source_format; // Internal field, not part of AlignPack spec

  // Extract pack-level guidance (not part of AlignPack spec)
  // Pack-level guidance should be prose outside the fenced block, not YAML inside it
  let guidanceProse: string | undefined;
  if (cleanIr.guidance) {
    guidanceProse = cleanIr.guidance as string;
    delete cleanIr.guidance;
  }

  // Generate YAML from IR
  // Note: For byte-identical round-trips, we aim for canonical YAML formatting
  // The yaml library will use plain scalars where safe, quotes where needed
  const yaml = stringifyYaml(cleanIr, {
    indent: indentSize,
    lineWidth: 0, // Don't wrap lines
    minContentWidth: 0,
    defaultStringType: "PLAIN", // Let library decide quoting
    defaultKeyType: "PLAIN",
  });

  // Convert spaces to tabs if needed
  let formattedYaml = yaml;
  if (!useSpaces) {
    const lines = yaml.split("\n");
    formattedYaml = lines
      .map((line) => {
        // Replace leading spaces with tabs (every indentSize spaces = 1 tab)
        const match = line.match(/^( +)/);
        if (match) {
          const spaces = match[1]!.length;
          const tabs = Math.floor(spaces / indentSize);
          const remainder = " ".repeat(spaces % indentSize);
          return "\t".repeat(tabs) + remainder + line.slice(spaces);
        }
        return line;
      })
      .join("\n");
  }

  // Build markdown sections
  const sections: string[] = [];

  // Header
  sections.push(header);
  sections.push(""); // Blank line after header

  // Guidance prose if present
  if (guidanceProse) {
    sections.push(guidanceProse.trim());
    sections.push(""); // Blank line before code block
  }

  // Fenced code block
  sections.push("```aligntrue");
  sections.push(formattedYaml.trim());
  sections.push("```");

  // Join with appropriate line endings
  let markdown = sections.join("\n");

  // Add final newline
  if (!markdown.endsWith("\n")) {
    markdown += "\n";
  }

  // Convert line endings if needed
  if (lineEnding === "crlf") {
    markdown = markdown.replace(/\n/g, "\r\n");
  }

  return markdown;
}
