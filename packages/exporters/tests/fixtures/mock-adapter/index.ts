/**
 * Mock adapter handler for testing dynamic loading
 */

import type { ExporterPlugin, ScopedExportRequest, ExportOptions, ExportResult } from '../../src/types.js'

export class MockAdapterExporter implements ExporterPlugin {
  name = 'mock-adapter'
  version = '2.0.0'
  
  async export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult> {
    return {
      success: true,
      filesWritten: ['.mock/test.txt'],
      contentHash: 'mock-hash',
      fidelityNotes: ['Mock adapter loaded successfully']
    }
  }
}

// Export as default for registry loading
export default MockAdapterExporter

