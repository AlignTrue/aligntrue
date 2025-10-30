/**
 * Shared types for all exporters
 *
 * NOTE: These types have been moved to @aligntrue/plugin-contracts.
 * This file now re-exports them for backwards compatibility.
 */

// Re-export all exporter types from plugin-contracts
export type {
  ResolvedScope,
  ScopedExportRequest,
  ExportOptions,
  ExportResult,
  ExporterPlugin,
  AdapterManifest,
} from "@aligntrue/plugin-contracts";
