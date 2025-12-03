/**
 * Mock exporter for testing sync engine
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/exporters";

/**
 * Mock exporter that tracks calls and returns configurable results
 */
export class MockExporter implements ExporterPlugin {
  name: string;
  version: string = "1.0.0-test";

  // Track calls for assertions
  calls: Array<{ request: ScopedExportRequest; options: ExportOptions }> = [];
  lastRequest?: ScopedExportRequest;
  lastOptions?: ExportOptions;

  // Configurable behavior
  private shouldSucceed: boolean = true;
  private filesToWrite: string[] = [];
  private fidelityNotes: string[] = [];
  private contentHash: string = "mock-hash-123";

  constructor(name: string = "mock-exporter") {
    this.name = name;
  }

  /**
   * Configure exporter to succeed or fail
   */
  setSuccess(shouldSucceed: boolean): this {
    this.shouldSucceed = shouldSucceed;
    return this;
  }

  /**
   * Configure files that will be "written"
   */
  setFilesToWrite(files: string[]): this {
    this.filesToWrite = files;
    return this;
  }

  /**
   * Configure fidelity notes to return
   */
  setFidelityNotes(notes: string[]): this {
    this.fidelityNotes = notes;
    return this;
  }

  /**
   * Configure content hash
   */
  setContentHash(hash: string): this {
    this.contentHash = hash;
    return this;
  }

  /**
   * Export implementation (tracks call and returns configured result)
   */
  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    // Track call
    this.calls.push({ request, options });
    this.lastRequest = request;
    this.lastOptions = options;

    // Return configured result
    return {
      success: this.shouldSucceed,
      filesWritten: this.filesToWrite,
      fidelityNotes:
        this.fidelityNotes.length > 0 ? this.fidelityNotes : undefined,
      contentHash: this.contentHash,
    };
  }

  /**
   * Get number of times export was called
   */
  getCallCount(): number {
    return this.calls.length;
  }

  /**
   * Check if export was called with specific scope path
   */
  wasCalledWithScope(scopePath: string): boolean {
    return this.calls.some((call) => call.request.scope.path === scopePath);
  }

  /**
   * Check if export was called with specific section fingerprint
   */
  wasCalledWithSection(fingerprint: string): boolean {
    return this.calls.some((call) =>
      call.request.align.sections.some(
        (section) => section.fingerprint === fingerprint,
      ),
    );
  }

  /**
   * Clear call history
   */
  clear(): void {
    this.calls = [];
    this.lastRequest = undefined;
    this.lastOptions = undefined;
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.clear();
    this.shouldSucceed = true;
    this.filesToWrite = [];
    this.fidelityNotes = [];
    this.contentHash = "mock-hash-123";
  }
}
