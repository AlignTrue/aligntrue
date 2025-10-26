/**
 * AGENTS.md universal formatter
 */

import type { Exporter, ExportOptions, ExportResult } from '../types.js';

export class AgentsMdExporter implements Exporter {
  name = 'agents-md';
  version = '1.0.0';
  
  async export(ir: unknown, options: ExportOptions): Promise<ExportResult> {
    throw new Error('Not implemented');
  }
}

export function formatAgentsMd(ir: unknown, version: string): string {
  throw new Error('Not implemented');
}

