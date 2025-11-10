/**
 * ZED.md exporter
 * Delegates to GenericMarkdownExporter with Zed-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class ZedMdExporter implements ExporterPlugin {
  name = "zed-md";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "zed-md",
    "ZED.md",
    "ZED.md",
    "for Zed",
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

export default ZedMdExporter;
