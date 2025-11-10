/**
 * Import coverage analysis
 * Analyzes field mapping coverage from agent formats to IR
 */

import type { AlignSection } from "@aligntrue/schema";

/**
 * Field mapping information
 */
export interface FieldMapping {
  irField: string;
  agentSource: string;
  mapped: boolean;
}

/**
 * Unmapped field information
 */
export interface UnmappedField {
  irField: string;
  reason: string;
  preservation: string;
}

/**
 * Coverage analysis report
 */
export interface CoverageReport {
  agent: string;
  rulesImported: number;
  mappedFields: FieldMapping[];
  unmappedFields: UnmappedField[];
  coveragePercentage: number;
  confidence: "high" | "medium" | "low";
  vendorPreserved: boolean;
}

/**
 * All possible IR fields for coverage analysis
 */
const IR_FIELDS = [
  "id",
  "severity",
  "applies_to",
  "guidance",
  "check",
  "tags",
  "vendor",
];

/**
 * Analyze Cursor .mdc import coverage
 */
export function analyzeCursorCoverage(
  sections: AlignSection[],
): CoverageReport {
  const mappedFields: FieldMapping[] = [
    { irField: "id", agentSource: "Rule header (## Rule: <id>)", mapped: true },
    {
      irField: "severity",
      agentSource: "**Severity:** metadata",
      mapped: true,
    },
    {
      irField: "applies_to",
      agentSource: "**Applies to:** patterns",
      mapped: true,
    },
    { irField: "guidance", agentSource: "Markdown prose", mapped: true },
    {
      irField: "vendor",
      agentSource: "YAML frontmatter → vendor.cursor",
      mapped: true,
    },
    { irField: "check", agentSource: "Not in .mdc format", mapped: false },
    { irField: "tags", agentSource: "Not in .mdc format", mapped: false },
  ];

  const unmappedFields: UnmappedField[] = [
    {
      irField: "check",
      reason: "Not supported in Cursor .mdc format",
      preservation: "vendor.cursor.check (if present in IR)",
    },
    {
      irField: "tags",
      reason: "Not supported in Cursor .mdc format",
      preservation: "vendor.cursor.tags (if present in IR)",
    },
  ];

  const mappedCount = mappedFields.filter((f) => f.mapped).length;
  const coveragePercentage = Math.round((mappedCount / IR_FIELDS.length) * 100);
  const confidence = calculateConfidence(mappedCount, IR_FIELDS.length);

  // Check if any sections have vendor.cursor metadata
  const vendorPreserved = sections.some(
    (s) => s.vendor?.["cursor"] !== undefined,
  );

  return {
    agent: "cursor",
    rulesImported: sections.length,
    mappedFields,
    unmappedFields,
    coveragePercentage,
    confidence,
    vendorPreserved,
  };
}

/**
 * Analyze AGENTS.md import coverage
 */
export function analyzeAgentsMdCoverage(
  sections: AlignSection[],
): CoverageReport {
  const mappedFields: FieldMapping[] = [
    { irField: "id", agentSource: "**ID:** metadata", mapped: true },
    {
      irField: "severity",
      agentSource: "**Severity:** (ERROR/WARN/INFO)",
      mapped: true,
    },
    { irField: "applies_to", agentSource: "**Scope:** patterns", mapped: true },
    { irField: "guidance", agentSource: "Markdown prose", mapped: true },
    {
      irField: "vendor",
      agentSource: "Preserved in vendor.* on export",
      mapped: true,
    },
    { irField: "check", agentSource: "Not in AGENTS.md format", mapped: false },
    { irField: "tags", agentSource: "Not in AGENTS.md format", mapped: false },
  ];

  const unmappedFields: UnmappedField[] = [
    {
      irField: "check",
      reason: "Not supported in AGENTS.md universal format",
      preservation: "Lost on import (not in format)",
    },
    {
      irField: "tags",
      reason: "Not supported in AGENTS.md universal format",
      preservation: "Lost on import (not in format)",
    },
  ];

  const mappedCount = mappedFields.filter((f) => f.mapped).length;
  const coveragePercentage = Math.round((mappedCount / IR_FIELDS.length) * 100);
  const confidence = calculateConfidence(mappedCount, IR_FIELDS.length);

  // AGENTS.md doesn't preserve vendor metadata on import
  const vendorPreserved = false;

  return {
    agent: "agents-md",
    rulesImported: sections.length,
    mappedFields,
    unmappedFields,
    coveragePercentage,
    confidence,
    vendorPreserved,
  };
}

/**
 * Calculate confidence level based on coverage percentage
 */
export function calculateConfidence(
  mappedCount: number,
  totalCount: number,
): "high" | "medium" | "low" {
  const percentage = (mappedCount / totalCount) * 100;

  if (percentage >= 90) {
    return "high";
  } else if (percentage >= 70) {
    return "medium";
  } else {
    return "low";
  }
}

/**
 * Format coverage report for display
 */
export function formatCoverageReport(report: CoverageReport): string {
  const lines: string[] = [];

  // Header
  lines.push(`Import Coverage Report: ${report.agent}`);
  lines.push("━".repeat(43));
  lines.push("");
  lines.push(
    `✓ Imported: ${report.rulesImported} rules from ${getAgentFormatDescription(report.agent)}`,
  );
  lines.push("");

  // Field Mapping
  lines.push("Field Mapping:");
  for (const field of report.mappedFields) {
    if (field.mapped) {
      lines.push(`✓ ${field.irField.padEnd(15)} ← ${field.agentSource}`);
    }
  }
  lines.push("");

  // Unmapped Fields
  if (report.unmappedFields.length > 0) {
    lines.push("⚠ Unmapped Fields (preserved in vendor.*):");
    for (const field of report.unmappedFields) {
      lines.push(`  • ${field.irField.padEnd(13)} → ${field.preservation}`);
    }
    lines.push("");
  }

  // Coverage Stats
  const mappedCount = report.mappedFields.filter((f) => f.mapped).length;
  lines.push(
    `Coverage: ${report.coveragePercentage}% (${mappedCount}/${IR_FIELDS.length} IR fields mapped)`,
  );
  lines.push(
    `Confidence: ${capitalizeFirst(report.confidence)} (${getConfidenceDescription(report.confidence)})`,
  );

  if (report.vendorPreserved) {
    lines.push("");
    lines.push("✓ Vendor metadata preserved for round-trip fidelity");
  }

  return lines.join("\n");
}

/**
 * Get agent format description
 */
function getAgentFormatDescription(agent: string): string {
  switch (agent) {
    case "cursor":
      return ".cursor/rules/*.mdc";
    case "agents-md":
      return "AGENTS.md";
    default:
      return agent;
  }
}

/**
 * Get confidence level description
 */
function getConfidenceDescription(
  confidence: "high" | "medium" | "low",
): string {
  switch (confidence) {
    case "high":
      return "≥90% coverage";
    case "medium":
      return "70-89% coverage";
    case "low":
      return "<70% coverage";
  }
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
