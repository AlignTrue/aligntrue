/**
 * WARP.md exporter
 * Delegates to GenericMarkdownExporter with Warp-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class WarpExporter implements ExporterPlugin {
  name = "warp";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "warp",
    "WARP.md",
    "WARP.md",
    "for Warp",
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

export default WarpExporter;
