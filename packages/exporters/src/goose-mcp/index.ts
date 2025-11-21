/**
 * Goose MCP exporter
 * Exports AlignTrue rules to .goose/config.yaml MCP configuration format
 *
 * Uses centralized MCP generator with Goose-specific transformer
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import {
  generateCanonicalMcpConfig,
  type CanonicalMcpConfig,
} from "@aligntrue/core";
import { BaseMcpTransformer } from "../mcp-transformers/index.js";
import { ExporterBase } from "../base/index.js";

class GooseMcpTransformer extends BaseMcpTransformer {
  transform(config: CanonicalMcpConfig): string {
    // Convert JSON MCP config to YAML format for Goose
    const yaml = require("yaml");
    return yaml.stringify(config) + "\n";
  }

  getOutputPath(baseDir: string): string {
    return join(baseDir, ".goose", "config.yaml");
  }
}

export class GooseMcpExporter extends ExporterBase {
  name = "goose-mcp";
  version = "1.0.0";

  private transformer = new GooseMcpTransformer();

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

    // Transform to Goose-specific YAML format
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

export default GooseMcpExporter;
