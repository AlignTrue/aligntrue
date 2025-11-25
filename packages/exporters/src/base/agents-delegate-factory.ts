/**
 * Factory for creating simple exporters that delegate to AgentsExporter
 * Reduces boilerplate for exporters that just wrap AGENTS.md format
 */

import type { ExporterPlugin } from "@aligntrue/plugin-contracts";
import { AgentsExporter } from "../agents/index.js";

/**
 * Create an exporter that delegates to AgentsExporter
 *
 * @param name - Exporter name (e.g., "copilot", "jules")
 * @returns Configured exporter instance that delegates to AgentsExporter
 *
 * @example
 * ```typescript
 * export default createAgentsDelegateExporter("copilot");
 * ```
 */
export function createAgentsDelegateExporter(name: string): ExporterPlugin {
  const delegate = new AgentsExporter();

  return {
    name,
    version: "1.0.0",
    async export(request, options) {
      return delegate.export(request, options);
    },
  };
}
