/**
 * Failing exporter for testing error paths
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/exporters";

/**
 * Exporter that always fails for testing error handling
 */
export class FailingExporter implements ExporterPlugin {
  name: string;
  version: string = "1.0.0-test";

  private errorMessage: string;
  private shouldThrow: boolean;

  constructor(name: string = "failing-exporter", shouldThrow: boolean = false) {
    this.name = name;
    this.shouldThrow = shouldThrow;
    this.errorMessage = `${name} intentionally failed`;
  }

  /**
   * Set custom error message
   */
  setErrorMessage(message: string): this {
    this.errorMessage = message;
    return this;
  }

  /**
   * Configure whether to throw or return failure
   */
  setShouldThrow(shouldThrow: boolean): this {
    this.shouldThrow = shouldThrow;
    return this;
  }

  /**
   * Export implementation (always fails)
   */
  async export(
    _request: ScopedExportRequest,
    _options: ExportOptions,
  ): Promise<ExportResult> {
    if (this.shouldThrow) {
      throw new Error(this.errorMessage);
    }

    return {
      success: false,
      filesWritten: [],
      contentHash: "",
    };
  }
}
