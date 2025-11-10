/**
 * ROOCODE.md exporter
 * Delegates to GenericMarkdownExporter with Roocode-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class RoocodeMdExporter implements ExporterPlugin {
  name = "roocode-md";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "roocode-md",
    "ROOCODE.md",
    "ROOCODE.md",
    "for Roocode",
  );

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }

  resetState(): void {
    this.delegate.resetState();
  }
}

export default RoocodeMdExporter;
