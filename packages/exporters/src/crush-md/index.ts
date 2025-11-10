/**
 * CRUSH.md exporter
 * Delegates to GenericMarkdownExporter with Crush-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class CrushMdExporter implements ExporterPlugin {
  name = "crush-md";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "crush-md",
    "CRUSH.md",
    "CRUSH.md",
    "for Crush",
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

export default CrushMdExporter;
