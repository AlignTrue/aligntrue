/**
 * Cache management for .aligntrue/.cache/
 */

export interface CacheEntry {
  key: string;
  content: string;
  fetchedAt: string;
  sourceUrl?: string;
}

export class SourceCache {
  constructor(private cachePath: string) {}
  
  async get(key: string): Promise<CacheEntry | null> {
    throw new Error('Not implemented');
  }
  
  async set(key: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    throw new Error('Not implemented');
  }
  
  async clear(): Promise<void> {
    throw new Error('Not implemented');
  }
}

