/**
 * VS Code MCP config exporter
 * Exports AlignTrue rules to .vscode/mcp.json format
 *
 * Format: Single root-level .vscode/mcp.json file with v1 JSON structure
 * Target: VS Code with Model Context Protocol (MCP) support
 */

import { dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "@aligntrue/plugin-contracts";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { getAlignTruePaths } from "@aligntrue/core";
import { ExporterBase } from "../base/index.js";

/**
 * State for collecting all scopes before generating single merged file
 */
interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  seenScopes: Set<string>;
}

/**
 * MCP configuration JSON structure
 */
interface McpConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  sections: McpSection[]; // Natural markdown format
  fidelity_notes?: string[];
}

/**
 * MCP section for natural markdown format
 */
interface McpSection {
  heading: string;
  level: number;
  content: string;
  fingerprint: string;
  scope?: string;
  [key: string]: unknown; // Additional vendor.vscode fields
}

export class VsCodeMcpExporter extends ExporterBase {
  name = "vscode-mcp";
  version = "1.0.0";

  // State for accumulating rules/sections across multiple scope calls
  private state: ExporterState = {
    allSections: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    // Validate inputs
    if (sections.length === 0) {
      // Empty scope is allowed, just skip accumulation
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate content with scope information
    const scopePath = this.formatScopePath(scope);

    // Natural markdown sections
    sections.forEach((section) => {
      this.state.allSections.push({ section, scopePath });
    });

    this.state.seenScopes.add(scopePath);

    // Generate .vscode/mcp.json with all accumulated content
    const paths = getAlignTruePaths(outputDir);
    const outputPath = paths.vscodeMcp();

    // Generate MCP config JSON - natural markdown mode
    const mcpConfig = this.generateMcpConfigFromSections(
      options.unresolvedPlugsCount,
    );
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const content = JSON.stringify(mcpConfig, null, 2) + "\n";

    // Write file atomically if not dry-run
    if (!dryRun) {
      // Ensure .vscode directory exists
      const vscodeDirPath = dirname(outputPath);
      mkdirSync(vscodeDirPath, { recursive: true });
    }

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  /**
   * Format scope path for display in MCP config
   * Default scope (path: ".") → "all files"
   * Named scope → actual path
   */
  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  /**
   * Generate complete MCP configuration object
   */
  private generateMcpConfig(unresolvedPlugs?: number): McpConfig {
    const allRulesIR = this.state.allRules.map(({ rule }) => rule);
    const contentHash = computeContentHash({ rules: allRulesIR });
    const fidelityNotes = this.computeFidelityNotes(allRulesIR);

    const mcpRules = this.state.allRules.map(({ rule, scopePath }) =>
      this.mapRuleToMcpFormat(rule, scopePath),
    );

    const config: McpConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      rules: mcpRules,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config["unresolved_plugs"] = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    return config;
  }

  /**
   * Generate MCP configuration from natural markdown sections
   */
  private generateMcpConfigFromSections(unresolvedPlugs?: number): McpConfig {
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const mcpSections = this.state.allSections.map(({ section, scopePath }) =>
      this.mapSectionToMcpFormat(section, scopePath),
    );

    const config: McpConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      sections: mcpSections,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config["unresolved_plugs"] = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    return config;
  }

  /**
   * Map AlignSection to MCP format with vendor.vscode extraction
   */
  private mapSectionToMcpFormat(
    section: AlignSection,
    scopePath: string,
  ): McpSection {
    const mcpSection: McpSection = {
      heading: section.heading,
      level: section.level,
      content: section.content,
      fingerprint: section.fingerprint,
    };

    // Add scope if not default
    if (scopePath !== "all files") {
      mcpSection.scope = scopePath;
    }

    // Extract vendor.vscode fields to top level
    const vscodeFields = this.extractVendorVscodeFromSection(section);
    Object.assign(mcpSection, vscodeFields);

    return mcpSection;
  }

  /**
   * Extract and flatten vendor.vscode fields from section
   * Returns object with vendor.vscode fields at top level
   */

  private extractVendorVscodeFromSection(
    section: AlignSection,
  ): Record<string, unknown> {
    if (!section.vendor || !section.vendor["vscode"]) {
      return {};
    }

    const vscodeFields: Record<string, unknown> = {};
    const vscodeVendor = section.vendor["vscode"];

    // Flatten all vendor.vscode fields to top level
    for (const [key, value] of Object.entries(vscodeVendor)) {
      vscodeFields[key] = value;
    }

    return vscodeFields;
  }

  /**
   * Map AlignRule to MCP format with vendor.vscode extraction
   */
  private mapRuleToMcpFormat(rule: AlignRule, scopePath: string): McpRule {
    const mcpRule: McpRule = {
      id: rule.id,
      severity: rule.severity,
      guidance: rule.guidance || "",
    };

    // Add scope if not default
    if (scopePath !== "all files") {
      mcpRule.scope = scopePath;
    }

    // Add applies_to patterns if present
    if (rule.applies_to && rule.applies_to.length > 0) {
      mcpRule.applies_to = rule.applies_to;
    }

    // Extract vendor.vscode fields to top level
    const vscodeFields = this.extractVendorVscode(rule);
    Object.assign(mcpRule, vscodeFields);

    return mcpRule;
  }

  /**
   * Extract and flatten vendor.vscode fields
   * Returns object with vendor.vscode fields at top level
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractVendorVscode(rule: AlignRule): Record<string, any> {
    if (!rule.vendor || !rule.vendor["vscode"]) {
      return {};
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vscodeFields: Record<string, any> = {};
    const vscodeVendor = rule.vendor["vscode"];

    // Flatten all vendor.vscode fields to top level
    for (const [key, value] of Object.entries(vscodeVendor)) {
      vscodeFields[key] = value;
    }

    return vscodeFields;
  }

  /**
   * Compute fidelity notes for unmapped fields (custom for VS Code MCP)
   * Overrides base class to add VS Code MCP-specific messages
   */
  override computeFidelityNotes(rules: AlignRule[]): string[] {
    const notes: string[] = [];
    const unmappedFields = new Set<string>();
    const vendorAgents = new Set<string>();

    rules.forEach((rule) => {
      // Check for unmapped fields
      if (rule.check) {
        unmappedFields.add("check");
      }
      if (rule.autofix) {
        unmappedFields.add("autofix");
      }

      // Check for vendor-specific metadata (excluding vscode since we extract it)
      if (rule.vendor) {
        Object.keys(rule.vendor).forEach((agent) => {
          if (agent !== "_meta" && agent !== "vscode") {
            vendorAgents.add(agent);
          }
        });
      }
    });

    // Add notes for unmapped fields
    if (unmappedFields.has("check")) {
      notes.push(
        "Machine-checkable rules (check) not represented in MCP config format",
      );
    }
    if (unmappedFields.has("autofix")) {
      notes.push("Autofix hints not represented in MCP config format");
    }

    // Add notes for non-vscode vendor metadata
    if (vendorAgents.size > 0) {
      const agents = Array.from(vendorAgents).sort().join(", ");
      notes.push(
        `Vendor-specific metadata for other agents not extracted to MCP config: ${agents}`,
      );
    }

    return notes;
  }

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    this.state = {
      allRules: [],
      allSections: [],
      seenScopes: new Set(),
      useSections: false,
    };
  }
}
