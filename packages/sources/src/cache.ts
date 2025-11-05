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
  constructor(private cachePath: string) {
    // SECURITY NOTE (Step 20):
    // When implementing cache operations in Step 27, ensure cachePath is validated
    // against directory traversal attacks using validateScopePath from @aligntrue/core.
    //
    // Required validations:
    // 1. Reject paths containing '..' (parent directory traversal)
    // 2. Reject absolute paths (must be relative to workspace)
    // 3. Normalize Windows backslashes to forward slashes
    // 4. Use join() from 'path' to safely construct cache file paths
    //
    // Example:
    //   import { validateScopePath } from '@aligntrue/core'
    //   validateScopePath(cachePath) // Throws on invalid path
    //
    // See packages/core/tests/security/path-traversal.test.ts for test patterns.
  }

  async get(_key: string): Promise<CacheEntry | null> {
    throw new Error("Not implemented");
  }

  async set(
    _key: string,
    _content: string,
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    throw new Error("Not implemented");
  }

  async clear(): Promise<void> {
    throw new Error("Not implemented");
  }
}
