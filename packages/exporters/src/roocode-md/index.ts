/**
 * Roocode markdown exporter (uses AGENTS.md format)
 */

import { AgentsMdExporter } from "../agents-md/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Roocode markdown exporter - wraps AgentsMdExporter with roocode-md-specific metadata
 */
export class RoocodeMdExporter implements ExporterPlugin {
  name = "roocode-md";
  version = "1.0.0";

  private delegate = new AgentsMdExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default RoocodeMdExporter;
