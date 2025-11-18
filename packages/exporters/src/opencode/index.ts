/**
 * OPENCODE.md exporter
 * Delegates to GenericMarkdownExporter with OpenCode-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class OpencodeExporter implements ExporterPlugin {
  name = "opencode";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "opencode",
    "OPENCODE.md",
    "OPENCODE.md",
    "for OpenCode",
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

export default OpencodeExporter;
