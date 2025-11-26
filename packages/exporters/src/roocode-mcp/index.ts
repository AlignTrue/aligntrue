/**
 * Roo Code MCP exporter
 * Propagates MCP server configuration to .roo/mcp.json format
 *
 * Reads mcp.servers from AlignTrue config and generates agent-specific MCP files
 */

import { dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { generateCanonicalMcpConfig, type McpServer } from "@aligntrue/core";
import { RoocodeMcpTransformer } from "../mcp-transformers/index.js";
import { ExporterBase } from "../base/index.js";

export class RoocodeMcpExporter extends ExporterBase {
  name = "roocode-mcp";
  version = "1.0.0";

  private transformer = new RoocodeMcpTransformer();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    const { outputDir, dryRun = false, config } = options;

    // Extract MCP servers from config
    const mcpConfig = config as { mcp?: { servers?: McpServer[] } } | undefined;
    const servers = mcpConfig?.mcp?.servers || [];

    // If no servers configured, return empty result
    if (servers.length === 0) {
      return {
        success: true,
        filesWritten: [],
        contentHash: "",
      };
    }

    // Generate canonical MCP config from servers
    const canonicalConfig = generateCanonicalMcpConfig(servers);

    // Transform to Roo Code-specific format
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

    return this.buildResult(filesWritten, canonicalConfig.content_hash, []);
  }

  resetState(): void {
    // Stateless
  }
}

export default RoocodeMcpExporter;
