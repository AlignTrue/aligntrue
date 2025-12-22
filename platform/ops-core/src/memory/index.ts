import type { MemoryProvider, MemoryReference, QueryContext } from "./types.js";

/**
 * Default MemoryProvider that always returns empty results.
 * Used when memory is disabled via OPS_MEMORY_PROVIDER_ENABLED.
 */
export class NoOpMemoryProvider implements MemoryProvider {
  async query(_context: QueryContext): Promise<MemoryReference[]> {
    return [];
  }

  enabled(): boolean {
    return false;
  }
}

export type { MemoryProvider, MemoryReference, QueryContext } from "./types.js";
