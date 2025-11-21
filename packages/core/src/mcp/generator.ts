/**
 * Central MCP configuration generator
 * Produces canonical MCP JSON structure from rules and config
 */

import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";

export interface McpServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export interface McpConfigSection {
  heading: string;
  level: number;
  content: string;
  fingerprint: string;
  scope?: string;
  [key: string]: unknown;
}

export interface CanonicalMcpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  sections: McpConfigSection[];
  fidelity_notes?: string[];
}

/**
 * Generate canonical MCP configuration from sections
 * This is the single source of truth for MCP content
 */
export function generateCanonicalMcpConfig(
  sections: AlignSection[],
  unresolvedPlugs?: number,
): CanonicalMcpConfig {
  // Compute content hash from sections
  const contentHash = computeContentHash({ sections });

  // Convert sections to MCP format
  const mcpSections: McpConfigSection[] = sections.map((section) =>
    mapSectionToMcpFormat(section),
  );

  // Extract fidelity notes
  const fidelityNotes: string[] = [];
  sections.forEach((section) => {
    // Check for unsupported fields
    if ((section as unknown as Record<string, unknown>)["check"]) {
      fidelityNotes.push(
        `Section '${section.heading}': machine-checkable checks not represented in MCP format`,
      );
    }
    if ((section as unknown as Record<string, unknown>)["autofix"]) {
      fidelityNotes.push(
        `Section '${section.heading}': autofix hints not represented in MCP format`,
      );
    }
  });

  const config: CanonicalMcpConfig = {
    version: "v1",
    generated_by: "AlignTrue",
    content_hash: contentHash,
    sections: mcpSections,
  };

  if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
    config.unresolved_plugs = unresolvedPlugs;
  }

  if (fidelityNotes.length > 0) {
    config.fidelity_notes = fidelityNotes;
  }

  return config;
}

/**
 * Map AlignSection to MCP format
 */
function mapSectionToMcpFormat(section: AlignSection): McpConfigSection {
  const mcpSection: McpConfigSection = {
    heading: section.heading,
    level: section.level,
    content: section.content,
    fingerprint: section.fingerprint,
  };

  // Extract vendor.mcp fields to top level if present
  if (section.vendor && section.vendor["mcp"]) {
    const mcpVendor = section.vendor["mcp"];
    for (const [key, value] of Object.entries(mcpVendor)) {
      mcpSection[key] = value;
    }
  }

  return mcpSection;
}
