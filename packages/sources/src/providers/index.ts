/**
 * Source providers for pulling rules from multiple locations
 */

export type SourceType = 'local' | 'catalog' | 'git' | 'url';

export interface SourceProvider {
  type: SourceType;
  fetch(ref: string): Promise<string>;
}

export interface SourceConfig {
  type: SourceType;
  path?: string;
  url?: string;
}

export function createProvider(config: SourceConfig): SourceProvider {
  throw new Error('Not implemented');
}

