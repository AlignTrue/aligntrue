/**
 * Cursor MCP exporter
 * Exports AlignTrue rules to .cursor/mcp.json MCP configuration format
 *
 * Uses centralized MCP generator with Cursor-specific transformer
 */

import { dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { generateCanonicalMcpConfig } from "@aligntrue/core";
import { CursorMcpTransformer } from "../mcp-transformers/index.js";
import { ExporterBase } from "../base/index.js";

export class CursorMcpExporter extends ExporterBase {
  name = "cursor-mcp";
  version = "1.0.0";

  private transformer = new CursorMcpTransformer();

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

    // Transform to Cursor-specific format
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

export default CursorMcpExporter;
