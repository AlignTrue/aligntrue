/**
 * Schema validation for IR extracted from markdown
 */

import type { IRDocument } from './ir-builder.js';

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

export async function validateIR(ir: IRDocument): Promise<ValidationError[]> {
  throw new Error('Not implemented');
}

