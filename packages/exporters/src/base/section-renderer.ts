/**
 * Section rendering utilities
 * Consolidates markdown rendering, normalization, and marker generation
 */

import type { AlignSection } from "@aligntrue/schema";

/**
 * Generate fidelity notes for sections-based format
 */
export function computeSectionFidelityNotes(
  sections: AlignSection[],
  exporterName: string,
  multiFileCapable: boolean,
): string[] {
  const notes: string[] = [];
  const crossAgentVendors = new Set<string>();
  const sourceFiles = new Set<string>();

  sections.forEach((section) => {
    // Check for cross-agent vendor fields
    if (section.vendor) {
      Object.keys(section.vendor).forEach((agent) => {
        if (agent !== exporterName && agent !== "_meta") {
          crossAgentVendors.add(agent);
        }
      });

      // Track source files for multi-file detection
      const sourceFile = section.vendor.aligntrue?.source_file;
      if (sourceFile) {
        sourceFiles.add(sourceFile);
      }
    }
  });

  // Generate note for multi-file merging (for single-file exporters)
  if (sourceFiles.size > 1 && !multiFileCapable) {
    const fileList = Array.from(sourceFiles).sort().join(", ");
    notes.push(`Merged from ${sourceFiles.size} source files: ${fileList}`);
  }

  // Generate notes for cross-agent vendor fields
  if (crossAgentVendors.size > 0) {
    const otherAgents = Array.from(crossAgentVendors).filter(
      (agent) => agent !== exporterName,
    );
    if (otherAgents.length > 0) {
      const agents = otherAgents.join(", ");
      notes.push(
        `Vendor-specific fields for other agents preserved: ${agents}`,
      );
    }
  }

  return notes;
}

/**
 * Generate source marker comment for a section
 */
export function generateSourceMarker(
  section: AlignSection,
  config?: unknown,
): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alignConfig = config as any; // Type assertion for config
  const mode = alignConfig?.sync?.source_markers || "auto";

  if (mode === "never") return "";

  const sourceFile = section.vendor?.aligntrue?.source_file;
  if (!sourceFile) return "";

  // For "auto" mode, only show if multiple source files configured
  if (mode === "auto") {
    const sourceFiles = alignConfig?.sync?.source_files;
    const hasMultipleSources = Array.isArray(sourceFiles)
      ? sourceFiles.length > 1
      : typeof sourceFiles === "string" && sourceFiles.includes("*");

    if (!hasMultipleSources) return "";
  }

  return `<!-- aligntrue:source ${sourceFile} -->\n`;
}

/**
 * Normalize markdown content
 */
export function normalizeMarkdownFormatting(content: string): string {
  let normalized = content;

  // Fix horizontal rules followed directly by headings
  normalized = normalized.replace(/^(---+)([#]+\s)/gm, "$1\n\n$2");

  // Ensure horizontal rules have blank lines around them
  normalized = normalized.replace(
    /([^\n])\n(---+)\n([^\n])/g,
    "$1\n\n$2\n\n$3",
  );

  return normalized;
}

/**
 * Render sections as natural markdown
 */
export function renderSections(
  sections: AlignSection[],
  includeVendor = false,
): string {
  if (sections.length === 0) {
    return "";
  }

  const rendered = sections.map((section) => {
    const lines: string[] = [];

    // Heading with proper level
    const headingPrefix = "#".repeat(section.level);
    lines.push(`${headingPrefix} ${section.heading}`);
    lines.push("");

    // Add vendor metadata as HTML comment if requested and present
    if (includeVendor && section.vendor) {
      lines.push(`<!-- aligntrue:vendor ${JSON.stringify(section.vendor)} -->`);
      lines.push("");
    }

    // Content - normalize formatting
    const normalizedContent = normalizeMarkdownFormatting(
      section.content.trim(),
    );
    lines.push(normalizedContent);

    return lines.join("\n");
  });

  return rendered.join("\n\n");
}

/**
 * Generate source attribution comment
 */
export function generateSourceAttribution(sections: AlignSection[]): string {
  const sourceFiles = new Set<string>();

  for (const section of sections) {
    const sourceFile = section.vendor?.aligntrue?.source_file;
    if (sourceFile && typeof sourceFile === "string") {
      sourceFiles.add(sourceFile);
    }
  }

  if (sourceFiles.size === 0) {
    return "";
  }

  const sourceList = Array.from(sourceFiles).sort().join(", ");
  const timestamp = new Date().toISOString();

  return `<!-- Synced from: ${sourceList} | Last sync: ${timestamp} -->\n\n`;
}
