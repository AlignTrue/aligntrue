/**
 * @aligntrue/plugin-contracts
 * 
 * Defines interfaces and contracts for all AlignTrue plugins.
 * This package contains no implementations, only type definitions.
 * 
 * Plugin types:
 * - Exporters: Convert IR to agent-specific formats
 * - Importers: Convert agent formats back to IR (future)
 * - Sources: Fetch rules from various locations (future)
 * - MCP Servers: Model Context Protocol integrations (future)
 */

// Exporter plugin contracts
export type {
  ResolvedScope,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterPlugin,
  AdapterManifest,
} from './exporter.js'

