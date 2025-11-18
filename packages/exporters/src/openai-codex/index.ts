/**
 * OpenAI Codex exporter (uses AGENTS.md format)
 */

import { AgentsExporter } from "../agents/index.js";
import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";

/**
 * OpenAI Codex exporter - wraps AgentsExporter with openai-codex-specific metadata
 */
export class OpenaiCodexExporter implements ExporterPlugin {
  name = "openai-codex";
  version = "1.0.0";

  private delegate = new AgentsExporter();

  async export(
    request: ScopedExportRequest,
    options: ExportOptions,
  ): Promise<ExportResult> {
    return this.delegate.export(request, options);
  }
}

export default OpenaiCodexExporter;
