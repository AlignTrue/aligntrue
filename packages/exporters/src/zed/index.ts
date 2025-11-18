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

export class ZedExporter implements ExporterPlugin {
  name = "zed";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "zed",
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

export default ZedExporter;
