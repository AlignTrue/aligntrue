/**
 * CLAUDE.md exporter
 * Delegates to GenericMarkdownExporter with Claude-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class ClaudeExporter implements ExporterPlugin {
  name = "claude";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "claude",
    "CLAUDE.md",
    "CLAUDE.md",
    "for Claude Code",
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

export default ClaudeExporter;
