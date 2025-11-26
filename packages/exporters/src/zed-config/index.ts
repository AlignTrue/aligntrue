/**
 * Zed config exporter
 * Exports AlignTrue rules to .zed/settings.json configuration format (project root)
 * Note: Never use $HOME - always project root
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface ZedSettings {
  version: string;
  generated_by: string;
  content_hash: string;
  rules: string[];
  metadata?: Record<string, unknown>;
}

export class ZedConfigExporter extends ExporterBase {
  name = "zed-config";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { align } = request;
    const { outputDir, dryRun = false } = options;

    const sections = align.sections;

    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const outputPath = join(outputDir, ".zed", "settings.json");
    const contentHash = computeContentHash({ sections });
    const fidelityNotes = this.computeSectionFidelityNotes(sections);

    const config: ZedSettings = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      rules: sections.map((s) => s.heading),
    };

    const content = JSON.stringify(config, null, 2) + "\n";
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  resetState(): void {
    // Stateless exporter
  }
}

export default ZedConfigExporter;
