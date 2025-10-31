/**
 * Windsurf markdown exporter (uses AGENTS.md format)
 */

import { AgentsMdExporter } from "../agents-md/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Windsurf markdown exporter - wraps AgentsMdExporter with windsurf-md-specific metadata
 */
export class WindsurfMdExporter implements ExporterPlugin {
  name = "windsurf-md";
  version = "1.0.0";

  private delegate = new AgentsMdExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default WindsurfMdExporter;
