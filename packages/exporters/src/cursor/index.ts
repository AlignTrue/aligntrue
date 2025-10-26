/**
 * Cursor .mdc exporter
 */

import type { Exporter, ExportOptions, ExportResult } from '../types.js';

export class CursorExporter implements Exporter {
  name = 'cursor';
  version = '1.0.0';
  
  async export(ir: unknown, options: ExportOptions): Promise<ExportResult> {
    throw new Error('Not implemented');
  }
}

export function generateMdcFooter(contentHash: string, fidelityNotes: string[]): string {
  throw new Error('Not implemented');
}

