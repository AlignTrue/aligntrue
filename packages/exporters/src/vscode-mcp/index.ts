/**
 * VS Code MCP config exporter
 */

import type { Exporter, ExportOptions, ExportResult } from '../types.js';

export class VsCodeMcpExporter implements Exporter {
  name = 'vscode-mcp';
  version = '1.0.0';
  
  async export(ir: unknown, options: ExportOptions): Promise<ExportResult> {
    throw new Error('Not implemented');
  }
}

