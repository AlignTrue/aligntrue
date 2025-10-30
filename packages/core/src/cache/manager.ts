/**
 * Cache manager for expensive operations
 *
 * Caches:
 * - Git clone results (key: repo URL + ref)
 * - Catalog fetches (key: pack id + version)
 * - Validation results (key: content hash)
 *
 * Features:
 * - TTL (time-to-live) expiration
 * - Size limits with LRU eviction
 * - In-memory caching (future: persistent cache)
 *
 * Phase 3 Session 10: Performance optimization
 */

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  size: number; // bytes (approximate)
  accessCount: number;
  lastAccess: number;
}

export interface CacheOptions {
  ttl?: number; // milliseconds (default: 1 hour)
  maxSize?: number; // bytes (default: 100MB)
  maxEntries?: number; // max entries (default: 1000)
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  entries: number;
  totalSize: number;
  hitRate: number;
}

/**
 * Simple in-memory cache with TTL and size limits
 *
 * Usage:
 * ```typescript
 * const cache = new CacheManager({ ttl: 3600000, maxSize: 100 * 1024 * 1024 });
 *
 * // Set value
 * cache.set('key', { data: 'value' }, 100);
 *
 * // Get value
 * const value = cache.get<{ data: string }>('key');
 * ```
 */
export class CacheManager {
  private cache: Map<string, CacheEntry<any>>;
  private ttl: number;
  private maxSize: number;
  private maxEntries: number;
  private stats: CacheStats;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.ttl = options.ttl ?? 3600000; // 1 hour default
    this.maxSize = options.maxSize ?? 100 * 1024 * 1024; // 100MB default
    this.maxEntries = options.maxEntries ?? 1000; // 1000 entries default
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      entries: 0,
      totalSize: 0,
      hitRate: 0,
    };
  }

  /**
   * Get value from cache
   *
   * Returns undefined if:
   * - Key not found
   * - Entry expired (also removes it)
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return undefined;
    }

    // Check TTL (>= for TTL=0 case)
    const now = Date.now();
    if (now - entry.timestamp >= this.ttl) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.entries--;
      this.stats.misses++;
      return undefined;
    }

    // Update access tracking
    entry.accessCount++;
    entry.lastAccess = now;
    this.stats.hits++;
    this.updateHitRate();

    return entry.value as T;
  }

  /**
   * Set value in cache
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param size - Approximate size in bytes
   */
  set<T>(key: string, value: T, size: number): void {
    // Check if entry would exceed max size on its own
    if (size > this.maxSize) {
      // Don't cache entries larger than max size
      return;
    }

    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this.stats.totalSize -= existing.size;
      this.stats.entries--;
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      size,
      accessCount: 0,
      lastAccess: now,
    };

    // Check size limits before adding
    this.evictIfNeeded(size);

    this.cache.set(key, entry);
    this.stats.totalSize += size;
    this.stats.entries++;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Invalidate specific key
   */
  invalidate(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    this.cache.delete(key);
    this.stats.totalSize -= entry.size;
    this.stats.entries--;
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.entries = 0;
    this.stats.totalSize = 0;
  }

  /**
   * Get current cache size in bytes
   */
  size(): number {
    return this.stats.totalSize;
  }

  /**
   * Get number of entries
   */
  count(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
    this.stats.evictions = 0;
    this.updateHitRate();
  }

  /**
   * Evict expired entries
   *
   * Returns number of entries evicted
   */
  evictExpired(): number {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        this.stats.entries--;
        this.stats.evictions++;
        evicted++;
      }
    }

    return evicted;
  }

  /**
   * Evict entries if needed to make room for new entry
   *
   * Uses LRU (Least Recently Used) strategy
   */
  private evictIfNeeded(neededSize: number): void {
    // Check entry count limit
    while (this.cache.size >= this.maxEntries) {
      this.evictLru();
    }

    // Check size limit
    while (
      this.stats.totalSize + neededSize > this.maxSize &&
      this.cache.size > 0
    ) {
      this.evictLru();
    }
  }

  /**
   * Evict least recently used entry
   */
  private evictLru(): void {
    let lruKey: string | null = null;
    let lruAccess = Infinity;

    // Find LRU entry
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < lruAccess) {
        lruAccess = entry.lastAccess;
        lruKey = key;
      }
    }

    if (lruKey) {
      const entry = this.cache.get(lruKey)!;
      this.cache.delete(lruKey);
      this.stats.totalSize -= entry.size;
      this.stats.entries--;
      this.stats.evictions++;
    }
  }

  /**
   * Update hit rate statistic
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

/**
 * Create cache key from URL and ref
 */
export function gitCacheKey(url: string, ref: string): string {
  return `git:${url}@${ref}`;
}

/**
 * Create cache key from pack ID and version
 */
export function catalogCacheKey(id: string, version: string): string {
  return `catalog:${id}@${version}`;
}

/**
 * Create cache key from content hash
 */
export function validationCacheKey(contentHash: string): string {
  return `validation:${contentHash}`;
}

/**
 * Estimate size of value in bytes (approximate)
 */
export function estimateSize(value: any): number {
  if (value === null || value === undefined) {
    return 8;
  }

  const type = typeof value;

  if (type === "boolean") return 4;
  if (type === "number") return 8;
  if (type === "string") return value.length * 2; // UTF-16
  if (type === "symbol") return 8;

  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateSize(item), 24); // Array overhead
  }

  if (type === "object") {
    let size = 24; // Object overhead
    for (const key in value) {
      size += key.length * 2; // Key string
      size += estimateSize(value[key]);
    }
    return size;
  }

  return 8; // Default
}
