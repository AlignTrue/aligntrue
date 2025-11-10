/**
 * Kilocode MCP exporter
 * @deprecated Not yet fully implemented for sections-only format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { ExporterBase } from "../base/index.js";

export class KilcodeMcpExporter extends ExporterBase {
  name = "kilocode-mcp";
  version = "1.0.0";

  async export(
    _request: ScopedExportRequest,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    // TODO: Implement Kilocode MCP exporter for sections format
    return {
      success: true,
      filesWritten: [],
      contentHash: "",
    };
  }

  resetState(): void {
    // Stub
  }
}

export default KilcodeMcpExporter;
