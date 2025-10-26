/**
 * Convert markdown fenced blocks to canonical IR
 */

import type { FencedBlock } from './parser.js';

export interface IRDocument {
  version: string;
  rules: unknown[];
  source_format: 'markdown' | 'yaml';
}

export function buildIR(blocks: FencedBlock[]): IRDocument {
  throw new Error('Not implemented');
}

export function normalizeWhitespace(yaml: string): string {
  throw new Error('Not implemented');
}

