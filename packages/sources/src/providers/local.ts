import type { SourceProvider } from './index.js';

export class LocalProvider implements SourceProvider {
  type = 'local' as const;
  
  constructor(private basePath: string) {}
  
  async fetch(ref: string): Promise<string> {
    throw new Error('Not implemented');
  }
}

