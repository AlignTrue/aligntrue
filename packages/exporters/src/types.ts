/**
 * Shared types for all exporters
 */

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

export interface Exporter {
  name: string;
  version: string;
  export(ir: unknown, options: ExportOptions): Promise<ExportResult>;
}

