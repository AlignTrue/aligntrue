/**
 * Jules exporter (uses AGENTS.md format)
 */

import { AgentsMdExporter } from "../agents-md/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Jules exporter - wraps AgentsMdExporter with jules-specific metadata
 */
export class JulesExporter implements ExporterPlugin {
  name = "jules";
  version = "1.0.0";

  private delegate = new AgentsMdExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default JulesExporter;
