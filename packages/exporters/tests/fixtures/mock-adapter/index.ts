/**
 * Mock exporter handler for testing dynamic loading
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../../src/types.js";

export class MockExporterExporter implements ExporterPlugin {
  name = "mock-exporter";
  version = "2.0.0";

  async export(
    _request: ScopedExportRequest,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    return {
      success: true,
      filesWritten: [".mock/test.txt"],
      contentHash: "mock-hash",
      fidelityNotes: ["Mock exporter loaded successfully"],
    };
  }
}

// Export as default for registry loading
export default MockExporterExporter;
