/**
 * openhands exporter
 * @deprecated Not yet fully implemented for sections-only format
 */

import type {
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "../types.js";
import { ExporterBase } from "../base/index.js";

export class OpenHandsExporter extends ExporterBase {
  name = "openhands";
  version = "1.0.0";

  async export(
    _request: ScopedExportRequest,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    // TODO: Implement openhands exporter for sections format
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

// Maintain backward compatibility
export { OpenHandsExporter as OpenhandsExporter };

export default OpenHandsExporter;
