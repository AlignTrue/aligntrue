/**
 * Shared types for all exporters
 */

import type { AlignRule } from '@aligntrue/schema'

/**
 * Resolved scope information
 * Represents a validated and normalized scope configuration
 */
export interface ResolvedScope {
  path: string              // Relative path from workspace root
  normalizedPath: string    // Forward-slash normalized path
  include?: string[]        // Glob patterns to include
  exclude?: string[]        // Glob patterns to exclude
  rulesets?: string[]       // Rule IDs to apply (optional)
  isDefault: boolean        // True if this is a default scope (path: ".")
}

/**
 * Request for scoped export operation
 * 
 * Exporters receive pre-merged rules for each scope separately.
 * This allows per-scope output generation (e.g., .cursor/rules/apps-web.mdc).
 * 
 * The outputPath is a suggestion based on scope path - exporters can override
 * if their format requires different organization.
 * 
 * Multiple scopes = multiple export calls, one per scope.
 */
export interface ScopedExportRequest {
  scope: ResolvedScope      // Scope this export is for
  rules: AlignRule[]        // Pre-merged rules for this scope
  outputPath: string        // Suggested output path (e.g., .cursor/rules/apps-web.mdc)
}

export interface ExportOptions {
  outputDir: string;
  dryRun?: boolean;
  backup?: boolean;
}

export interface ExportResult {
  success: boolean;
  filesWritten: string[];
  fidelityNotes?: string[];
  contentHash: string;
}

/**
 * Exporter plugin interface
 * 
 * Exporters implement this interface to convert AlignTrue IR to agent-specific formats.
 * For scoped exports, the export method will be called once per scope.
 */
export interface ExporterPlugin {
  name: string
  version: string
  export(request: ScopedExportRequest, options: ExportOptions): Promise<ExportResult>
}

/**
 * Adapter manifest metadata
 * 
 * Declarative manifest.json file that describes an adapter's capabilities,
 * outputs, and optional handler for community-scalable contributions.
 */
export interface AdapterManifest {
  name: string              // Adapter name (lowercase alphanumeric with hyphens)
  version: string           // Semantic version (e.g., 1.0.0)
  description: string       // Human-readable description
  outputs: string[]         // File patterns produced (e.g., [".cursor/rules/*.mdc"])
  handler?: string          // Optional: relative path to TypeScript handler
  license?: string          // License identifier (default: MIT)
  fidelityNotes?: string[]  // Optional: semantic mapping limitations
}

