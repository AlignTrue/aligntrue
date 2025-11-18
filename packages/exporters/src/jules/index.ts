/**
 * Jules exporter (uses AGENTS.md format)
 */

import { AgentsExporter } from "../agents/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Jules exporter - wraps AgentsExporter with jules-specific metadata
 */
export class JulesExporter implements ExporterPlugin {
  name = "jules";
  version = "1.0.0";

  private delegate = new AgentsExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default JulesExporter;
