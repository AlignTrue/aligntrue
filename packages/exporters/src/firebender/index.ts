/**
 * Firebender exporter
 * Exports AlignTrue rules to Firebender firebender.json format
 *
 * Features:
 * - Combines rules and MCP configuration in a single JSON file
 * - Includes source_file references for direct reading from .aligntrue/rules/
 * - Firebender can optionally read rules directly from referenced source files
 * - Full content is included for environments without direct file access
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

/**
 * Firebender configuration JSON structure
 */
interface FirebenderConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  unresolved_plugs?: number;
  sections: FirebenderSection[];
  fidelity_notes?: string[];
  mcp?: Record<string, unknown>;
}

/**
 * Firebender section for natural markdown format
 * Can optionally include source_file reference for direct file reading
 */
interface FirebenderSection {
  heading: string;
  level: number;
  content: string;
  fingerprint: string;
  scope?: string;
  source_file?: string; // Path to original rule file for direct reading
  [key: string]: unknown; // Additional vendor.firebender fields
}

interface ExporterState {
  allSections: Array<{ section: AlignSection; scopePath: string }>;
  seenScopes: Set<string>;
}

export class FirebenderExporter extends ExporterBase {
  name = "firebender";
  version = "1.0.0";

  // State for accumulating sections across multiple scope calls
  private state: ExporterState = {
    allSections: [],
    seenScopes: new Set(),
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, align } = request;
    const { outputDir, dryRun = false } = options;

    const sections = align.sections;

    // Validate inputs
    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Accumulate content with scope information
    const scopePath = this.formatScopePath(scope);

    sections.forEach((section) => {
      this.state.allSections.push({ section, scopePath });
    });

    this.state.seenScopes.add(scopePath);

    // Generate firebender.json with all accumulated content
    const outputPath = join(outputDir, "firebender.json");

    // Generate Firebender config JSON
    const firebenderConfig = this.generateFirebenderConfig(
      options.unresolvedPlugsCount,
    );
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const content = JSON.stringify(firebenderConfig, null, 2) + "\n";

    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  /**
   * Format scope path for display
   */
  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }

  /**
   * Generate Firebender configuration from natural markdown sections
   */
  private generateFirebenderConfig(unresolvedPlugs?: number): FirebenderConfig {
    const allSectionsIR = this.state.allSections.map(({ section }) => section);
    const contentHash = computeContentHash({ sections: allSectionsIR });
    const fidelityNotes = this.computeSectionFidelityNotes(allSectionsIR);

    const firebenderSections = this.state.allSections.map(
      ({ section, scopePath }) =>
        this.mapSectionToFirebenderFormat(section, scopePath),
    );

    const config: FirebenderConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      sections: firebenderSections,
    };

    if (unresolvedPlugs !== undefined && unresolvedPlugs > 0) {
      config["unresolved_plugs"] = unresolvedPlugs;
    }

    if (fidelityNotes.length > 0) {
      config.fidelity_notes = fidelityNotes;
    }

    // Add empty MCP config placeholder
    config.mcp = {};

    return config;
  }

  /**
   * Map AlignSection to Firebender format with vendor.firebender extraction
   */
  private mapSectionToFirebenderFormat(
    section: AlignSection,
    scopePath: string,
  ): FirebenderSection {
    const firebenderSection: FirebenderSection = {
      heading: section.heading,
      level: section.level,
      content: section.content,
      fingerprint: section.fingerprint,
    };

    // Add scope if not default
    if (scopePath !== "all files") {
      firebenderSection.scope = scopePath;
    }

    // Add source file reference if available
    // Firebender can optionally read directly from .aligntrue/rules/ files
    if (section.source_file) {
      firebenderSection.source_file = section.source_file;
    }

    // Extract vendor.firebender fields to top level
    const firebenderFields = this.extractVendorFirebenderFromSection(section);
    Object.assign(firebenderSection, firebenderFields);

    return firebenderSection;
  }

  /**
   * Extract and flatten vendor.firebender fields from section
   */
  private extractVendorFirebenderFromSection(
    section: AlignSection,
  ): Record<string, unknown> {
    if (!section.vendor || !section.vendor["firebender"]) {
      return {};
    }

    const firebenderFields: Record<string, unknown> = {};
    const firebenderVendor = section.vendor["firebender"];

    // Flatten all vendor.firebender fields to top level
    for (const [key, value] of Object.entries(firebenderVendor)) {
      firebenderFields[key] = value;
    }

    return firebenderFields;
  }

  /**
   * Reset internal state (useful for testing)
   */
  resetState(): void {
    this.state = {
      allSections: [],
      seenScopes: new Set(),
    };
  }
}

export default FirebenderExporter;
