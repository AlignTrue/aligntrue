/**
 * AGENTS.md exporter
 * Exports AlignTrue rules to universal AGENTS.md format
 */

import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult } from '../types.js'

export class AgentsMdExporter implements ExporterPlugin {
  name = 'agents-md'
  version = '1.0.0'
  
  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    // Step 12 will implement this
    throw new Error('AgentsMdExporter.export() not yet implemented (Step 12)')
  }
}

/**
 * Format AGENTS.md with versioned structure
 * @param version - Format version (e.g., 'v1')
 */
export function formatAgentsMd(version: string = 'v1'): string {
  // Step 12 will implement this
  throw new Error('formatAgentsMd() not yet implemented (Step 12)')
}
