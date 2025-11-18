/**
 * WINDSURF.md exporter
 * Delegates to GenericMarkdownExporter with Windsurf-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class WindsurfExporter implements ExporterPlugin {
  name = "windsurf";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "windsurf",
    "WINDSURF.md",
    "WINDSURF.md",
    "for Windsurf",
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

export default WindsurfExporter;
