/**
 * Qwen Code exporter (uses AGENTS.md format)
 */

import { AgentsExporter } from "../agents/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * Qwen Code exporter - wraps AgentsExporter with qwen-code-specific metadata
 */
export class QwenCodeExporter implements ExporterPlugin {
  name = "qwen-code";
  version = "1.0.0";

  private delegate = new AgentsExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default QwenCodeExporter;
