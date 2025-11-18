/**
 * GitHub Copilot exporter (uses AGENTS.md format)
 */

import { AgentsExporter } from "../agents/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Copilot exporter - wraps AgentsExporter with copilot-specific metadata
 */
export class CopilotExporter implements ExporterPlugin {
  name = "copilot";
  version = "1.0.0";

  private delegate = new AgentsExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    // Delegate to agents exporter
    return this.delegate.export(request, options);
  }
}

export default CopilotExporter;
