import type { SourceProvider } from './index.js';

export class CatalogProvider implements SourceProvider {
  type = 'catalog' as const;
  
  constructor(private catalogUrl: string) {}
  
  async fetch(ref: string): Promise<string> {
    throw new Error('Not implemented');
  }
}

