/**
 * Hierarchical scope resolution with merge rules
 */

export interface Scope {
  path: string;
  include?: string[];
  exclude?: string[];
}

export type MergeOrder = Array<'root' | 'path' | 'local'>;

export function resolveScopes(workspacePath: string, scopes: Scope[]): Scope[] {
  throw new Error('Not implemented');
}

export function applyScopeMerge(scopes: Scope[], order: MergeOrder): Record<string, unknown> {
  throw new Error('Not implemented');
}

