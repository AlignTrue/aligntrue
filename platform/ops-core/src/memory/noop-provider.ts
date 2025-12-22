import type {
  IndexResult,
  IndexableItem,
  MemoryProvider,
  MemoryReference,
  QueryContext,
} from "./types.js";

/**
 * Default MemoryProvider that returns no results.
 */
export class NoOpMemoryProvider implements MemoryProvider {
  async index(_items: IndexableItem[]): Promise<IndexResult> {
    return { indexed: 0, skipped: _items.length };
  }

  async query(_context: QueryContext): Promise<MemoryReference[]> {
    return [];
  }

  enabled(): boolean {
    return false;
  }
}
