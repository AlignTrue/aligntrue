/**
 * VS Code MCP config exporter
 * Exports AlignTrue rules to .vscode/mcp.json format
 */

import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult } from '../types.js'

export class VsCodeMcpExporter implements ExporterPlugin {
  name = 'vscode-mcp'
  version = '1.0.0'
  
  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    // Step 13 will implement this
    throw new Error('VsCodeMcpExporter.export() not yet implemented (Step 13)')
  }
}

/**
 * Generate MCP configuration JSON
 */
export function generateMcpConfig(): object {
  // Step 13 will implement this
  throw new Error('generateMcpConfig() not yet implemented (Step 13)')
}
