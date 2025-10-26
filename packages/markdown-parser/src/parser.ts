/**
 * Extract fenced ```aligntrue blocks from literate markdown
 */

export interface FencedBlock {
  content: string;
  startLine: number;
  endLine: number;
  sectionTitle?: string;
  guidanceBefore?: string;
}

export interface ParseResult {
  blocks: FencedBlock[];
  errors: Array<{ line: number; message: string }>;
}

export function parseMarkdown(markdown: string): ParseResult {
  throw new Error('Not implemented');
}

export function validateSingleBlockPerSection(blocks: FencedBlock[]): boolean {
  throw new Error('Not implemented');
}

