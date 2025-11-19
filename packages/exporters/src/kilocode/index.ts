/**
 * Kilocode exporter
 * Exports AlignTrue rules to Kilocode .kilocode/rules/ directory format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
  ExporterCapabilities,
} from "../types.js";
import type { AlignSection } from "@aligntrue/schema";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

export class KiloCodeExporter extends ExporterBase {
  name = "kilocode";
  version = "1.0.0";
  capabilities: ExporterCapabilities = {
    multiFile: true, // Multi-file format (.kilocode/rules/*.md)
    twoWaySync: false, // Read-only exports
    scopeAware: true, // Can filter by scope
    preserveStructure: true, // Maintains file organization
    nestedDirectories: true, // Supports nested scope directories
  };

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const filename = this.getScopeFilename(scope);
    const outputPath = join(outputDir, ".kilocode", "rules", filename);

    // Generate content from sections
    const { content, warnings } = this.generateSectionContent(scope, sections);
    const contentHash = computeContentHash({ scope, sections });
    const fidelityNotes = this.computeSectionFidelityNotes(sections);

    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    const result = this.buildResult(filesWritten, contentHash, fidelityNotes);

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }

  /**
   * Generate Kilocode content from sections (natural markdown)
   */
  private generateSectionContent(
    scope: ResolvedScope,
    sections: AlignSection[],
  ): { content: string; warnings: string[] } {
    const lines: string[] = [];

    const scopeDesc = scope.isDefault
      ? "Kilocode rules (default scope)"
      : `Kilocode rules for ${scope.path}`;
    lines.push(`# ${scopeDesc}`);
    lines.push("");

    // Render sections as natural markdown
    const sectionsMarkdown = this.renderSections(sections, false);
    lines.push(sectionsMarkdown);

    return { content: lines.join("\n"), warnings: [] };
  }

  private getScopeFilename(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "rules.md";
    }

    const normalized = scope.normalizedPath.replace(/\//g, "-");
    return `${normalized}.md`;
  }

  resetState(): void {
    // Stateless exporter, nothing to reset
  }
}

// Maintain backward compatibility
export { KiloCodeExporter as KilocodeExporter };

export default KiloCodeExporter;
