/**
 * Aider markdown exporter (uses AGENTS.md format)
 */

import { AgentsExporter } from "../agents/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Aider markdown exporter - wraps AgentsExporter with aider-specific metadata
 */
export class AiderExporter implements ExporterPlugin {
  name = "aider";
  version = "1.0.0";

  private delegate = new AgentsExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default AiderExporter;
