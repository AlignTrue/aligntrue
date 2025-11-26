/**
 * Kiro MCP exporter
 * Propagates MCP server configuration to .kiro/settings/mcp.json format
 *
 * Reads mcp.servers from AlignTrue config and generates agent-specific MCP files
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { generateCanonicalMcpConfig, type McpServer } from "@aligntrue/core";
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

    return this.buildResult(filesWritten, canonicalConfig.content_hash, []);
  }

  resetState(): void {
    // Stateless
  }
}

export default KiroMcpExporter;
