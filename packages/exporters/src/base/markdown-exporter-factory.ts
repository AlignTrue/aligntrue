/**
 * Factory for creating simple markdown exporters
 * Reduces boilerplate for exporters that just delegate to GenericMarkdownExporter
 */

import type { ExporterPlugin } from "@aligntrue/plugin-contracts";
import { GenericMarkdownExporter } from "./generic-markdown-exporter.js";

export interface MarkdownExporterConfig {
  name: string;
  filename: string;
  title: string;
  description: string;
}

/**
 * Create a standard markdown exporter instance
 *
 * @param config - Configuration for the exporter
 * @returns Configured exporter instance
 */
export function createMarkdownExporter(
  config: MarkdownExporterConfig,
): ExporterPlugin {
  return new GenericMarkdownExporter(
    config.name,
    config.filename,
    config.title,
    config.description,
  );
}
