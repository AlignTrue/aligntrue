/**
 * Firebase Studio exporter
 * Delegates to GenericMarkdownExporter with Firebase Studio-specific configuration
 */

import type {
  ExporterPlugin,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
} from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "../base/generic-markdown-exporter.js";

export class FirebaseStudioExporter implements ExporterPlugin {
  name = "firebase-studio";
  version = "1.0.0";

  private delegate = new GenericMarkdownExporter(
    "firebase-studio",
    ".idx/airules.md",
    "Firebase Studio Rules",
    "for Firebase Studio",
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

export default FirebaseStudioExporter;
