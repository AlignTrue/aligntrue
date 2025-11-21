/**
 * Kiro MCP exporter
 * Exports AlignTrue rules to .kiro/settings/mcp.json MCP configuration format
 *
 * Uses centralized MCP generator with Kiro-specific transformer
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { generateCanonicalMcpConfig } from "@aligntrue/core";
import { BaseMcpTransformer } from "../mcp-transformers/index.js";
import { ExporterBase } from "../base/index.js";

class KiroMcpTransformer extends BaseMcpTransformer {
  transform(config: unknown): string {
    return this.formatJson(config as Record<string, unknown>);
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".kiro", "settings", "mcp.json");
  }
}

export class KiroMcpExporter extends ExporterBase {
  name = "kiro-mcp";
  version = "1.0.0";

  private transformer = new KiroMcpTransformer();

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

    // Generate canonical MCP config
    const canonicalConfig = generateCanonicalMcpConfig(
      sections,
      options.unresolvedPlugsCount,
    );

    // Transform to Kiro-specific format
    const content = this.transformer.transform(canonicalConfig);

    // Get output path
    const outputPath = this.transformer.getOutputPath(outputDir);

    // Create directory if needed
    if (!dryRun) {
      const outputDirPath = dirname(outputPath);
      mkdirSync(outputDirPath, { recursive: true });
    }

    // Write file atomically
    const filesWritten = await this.writeFile(
      outputPath,
      content,
      dryRun,
      options,
    );

    // Use content hash from canonical config
    const fidelityNotes = canonicalConfig.fidelity_notes || [];

    return this.buildResult(
      filesWritten,
      canonicalConfig.content_hash,
      fidelityNotes,
    );
  }

  resetState(): void {
    // Stateless with shared generator
  }
}

export default KiroMcpExporter;
