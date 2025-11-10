/**
 * Amazon Q exporter
 * Exports AlignTrue rules to Amazon Q .amazonq/rules/ directory format
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

export class AmazonQExporter extends ExporterBase {
  name = "amazonq";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope, pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    if (sections.length === 0) {
      throw new Error(
        "AmazonQExporter requires at least one section to export",
      );
    }

    const filename = this.getScopeFilename(scope);
    const outputPath = join(outputDir, ".amazonq", "rules", filename);

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
   * Generate Amazon Q content from sections (natural markdown)
   */
  private generateSectionContent(
    scope: ResolvedScope,
    sections: AlignSection[],
  ): { content: string; warnings: string[] } {
    const lines: string[] = [];

    const scopeDesc = scope.isDefault
      ? "Amazon Q rules (default scope)"
      : `Amazon Q rules for ${scope.path}`;
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
}

export default AmazonQExporter;
