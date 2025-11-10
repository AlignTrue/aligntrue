/**
 * Cline exporter
 * Exports AlignTrue rules to Cline .clinerules/ directory format
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

export class ClineExporter extends ExporterBase {
  name = "cline";
  version = "1.0.0";

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
    const outputPath = join(outputDir, ".clinerules", filename);

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
   * Generate Cline content from sections (natural markdown)
   */
  private generateSectionContent(
    scope: ResolvedScope,
    sections: AlignSection[],
  ): { content: string; warnings: string[] } {
    const lines: string[] = [];

    const scopeDesc = scope.isDefault
      ? "Cline rules (default scope)"
      : `Cline rules for ${scope.path}`;
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

export default ClineExporter;
