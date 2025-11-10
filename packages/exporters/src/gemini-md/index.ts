/**
 * GEMINI.md exporter
 * Delegates to GenericMarkdownExporter with Gemini-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class GeminiMdExporter implements ExporterPlugin {
  name = "gemini-md";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "gemini-md",
    "GEMINI.md",
    "GEMINI.md",
    "for Google Gemini Code",
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

export default GeminiMdExporter;
