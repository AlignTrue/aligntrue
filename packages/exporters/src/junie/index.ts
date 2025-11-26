/**
 * Junie exporter
 * Exports AlignTrue rules to Junie .junie/guidelines.md format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ResolvedScope,
} from "../types.js";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface ExporterState {
  // Stub
}

export class JunieExporter extends ExporterBase {
  name = "junie";
  version = "1.0.0";

  private state: ExporterState = {};

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { scope: _scope, align } = request;
    const { outputDir, dryRun = false } = options;
    const sections = align.sections;

    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const outputPath = join(outputDir, ".junie", "guidelines.md");

    // Generate content from sections
    const lines: string[] = [];
    lines.push("# Junie Guidelines");
    lines.push("");

    sections.forEach((section) => {
      lines.push(`## ${section.heading}`);
      lines.push("");
      lines.push(section.content);
      lines.push("");
    });

    const contentHash = computeContentHash({ sections });
    const fidelityNotes = this.computeSectionFidelityNotes(sections);

    const content = lines.join("\n");
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  resetState(): void {
    this.state = {};
  }

  private formatScopePath(scope: ResolvedScope): string {
    if (scope.isDefault || scope.path === "." || scope.path === "") {
      return "all files";
    }
    return scope.path;
  }
}

export default JunieExporter;
