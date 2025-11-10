/**
 * Opencode config exporter
 * Exports AlignTrue rules to opencode.json configuration format
 */

import { join } from "path";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { computeContentHash } from "@aligntrue/schema";
import { ExporterBase } from "../base/index.js";

interface OpencodeConfig {
  version: string;
  generated_by: string;
  content_hash: string;
  rules: string[];
  metadata?: Record<string, unknown>;
}

export class OpencodeConfigExporter extends ExporterBase {
  name = "opencode-config";
  version = "1.0.0";

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { pack } = request;
    const { outputDir, dryRun = false } = options;

    const sections = pack.sections;

    if (sections.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    const outputPath = join(outputDir, "opencode.json");
    const contentHash = computeContentHash({ sections });
    const fidelityNotes = this.computeSectionFidelityNotes(sections);

    const config: OpencodeConfig = {
      version: "v1",
      generated_by: "AlignTrue",
      content_hash: contentHash,
      rules: sections.map((s) => s.heading),
    };

    const content = JSON.stringify(config, null, 2) + "\n";
    const filesWritten = await this.writeFile(outputPath, content, dryRun);

    return this.buildResult(filesWritten, contentHash, fidelityNotes);
  }

  resetState(): void {
    // Stateless exporter
  }
}

export default OpencodeConfigExporter;
