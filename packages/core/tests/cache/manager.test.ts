/**
 * Tests for CacheManager
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CacheManager,
  gitCacheKey,
  catalogCacheKey,
  validationCacheKey,
  estimateSize,
} from "../../src/cache/manager.js";

describe("CacheManager", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ ttl: 1000, maxSize: 1024, maxEntries: 10 });
  });

  describe("basic operations", () => {
    it("stores and retrieves values", () => {
      cache.set("key1", { data: "value1" }, 100);
      const result = cache.get<{ data: string }>("key1");

      expect(result).toEqual({ data: "value1" });
    });

    it("returns undefined for missing keys", () => {
      const result = cache.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("has() checks key existence", () => {
      cache.set("key1", "value1", 10);

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
    });

    it("invalidate() removes key", () => {
      cache.set("key1", "value1", 10);
      expect(cache.has("key1")).toBe(true);

      const removed = cache.invalidate("key1");

      expect(removed).toBe(true);
      expect(cache.has("key1")).toBe(false);
    });

    it("clear() removes all entries", () => {
      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);

      expect(cache.count()).toBe(2);

      cache.clear();

      expect(cache.count()).toBe(0);
      expect(cache.size()).toBe(0);
    });
  });

  describe("TTL expiration", () => {
    it("expires entries after TTL", () => {
      vi.useFakeTimers();
      const cache = new CacheManager({ ttl: 1000 });

      cache.set("key1", "value1", 10);
      expect(cache.has("key1")).toBe(true);

      // Advance time past TTL
      vi.advanceTimersByTime(1001);

      expect(cache.get("key1")).toBeUndefined();

      vi.useRealTimers();
    });

    it("evictExpired() removes expired entries", () => {
      vi.useFakeTimers();
      const cache = new CacheManager({ ttl: 1000 });

      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);

      vi.advanceTimersByTime(1001);

      const evicted = cache.evictExpired();

      expect(evicted).toBe(2);
      expect(cache.count()).toBe(0);

      vi.useRealTimers();
    });

    it("keeps non-expired entries during eviction", () => {
      vi.useFakeTimers();
      const cache = new CacheManager({ ttl: 1000 });

      cache.set("old", "value1", 10);
      vi.advanceTimersByTime(500);
      cache.set("new", "value2", 10);
      vi.advanceTimersByTime(600); // old expires, new doesn't

      cache.evictExpired();

      expect(cache.has("old")).toBe(false);
      expect(cache.has("new")).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("size limits", () => {
    it("tracks total size", () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 200);

      expect(cache.size()).toBe(300);
    });

    it("evicts LRU when size limit exceeded", () => {
      const cache = new CacheManager({ ttl: 10000, maxSize: 250 });

      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 100);

      // This should evict key1 (LRU)
      cache.set("key3", "value3", 100);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(true);
      expect(cache.has("key3")).toBe(true);
    });

    it("evicts multiple entries if needed for size", () => {
      const cache = new CacheManager({ ttl: 10000, maxSize: 250 });

      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 100);

      // This should evict both key1 and key2
      cache.set("key3", "value3", 200);

      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key3")).toBe(true);
    });

    it("respects maxEntries limit", () => {
      const cache = new CacheManager({ ttl: 10000, maxEntries: 3 });

      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10);

      // This should evict key1 (LRU)
      cache.set("key4", "value4", 10);

      expect(cache.count()).toBe(3);
      expect(cache.has("key1")).toBe(false);
      expect(cache.has("key4")).toBe(true);
    });
  });

  describe("LRU eviction", () => {
    it("evicts least recently used entry", () => {
      vi.useFakeTimers();
      const cache = new CacheManager({ ttl: 10000, maxEntries: 3 });

      cache.set("key1", "value1", 10);
      vi.advanceTimersByTime(10);
      cache.set("key2", "value2", 10);
      vi.advanceTimersByTime(10);
      cache.set("key3", "value3", 10);
      vi.advanceTimersByTime(10);

      // Access key1 to make it recently used
      cache.get("key1");
      vi.advanceTimersByTime(10);

      // This should evict key2 (now LRU)
      cache.set("key4", "value4", 10);

      expect(cache.has("key1")).toBe(true);
      expect(cache.has("key2")).toBe(false);
      expect(cache.has("key4")).toBe(true);

      vi.useRealTimers();
    });

    it("tracks access count", () => {
      cache.set("key1", { data: "value" }, 10);

      cache.get("key1");
      cache.get("key1");
      cache.get("key1");

      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
    });
  });

  describe("statistics", () => {
    it("tracks hits and misses", () => {
      cache.set("key1", "value1", 10);

      cache.get("key1"); // hit
      cache.get("key2"); // miss
      cache.get("key1"); // hit

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });

    it("tracks evictions", () => {
      const cache = new CacheManager({ ttl: 10000, maxEntries: 2 });

      cache.set("key1", "value1", 10);
      cache.set("key2", "value2", 10);
      cache.set("key3", "value3", 10); // Evicts key1

      const stats = cache.getStats();

      expect(stats.evictions).toBe(1);
    });

    it("tracks entries and size", () => {
      cache.set("key1", "value1", 100);
      cache.set("key2", "value2", 200);

      const stats = cache.getStats();

      expect(stats.entries).toBe(2);
      expect(stats.totalSize).toBe(300);
    });

    it("resetStats() clears statistics", () => {
      cache.set("key1", "value1", 10);
      cache.get("key1");
      cache.get("missing");

      let stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("cache key helpers", () => {
    it("gitCacheKey() creates git cache key", () => {
      const key = gitCacheKey("https://github.com/org/repo", "main");
      expect(key).toBe("git:https://github.com/org/repo@main");
    });

    it("catalogCacheKey() creates catalog cache key", () => {
      const key = catalogCacheKey("base-global", "1.0.0");
      expect(key).toBe("catalog:base-global@1.0.0");
    });

    it("validationCacheKey() creates validation cache key", () => {
      const key = validationCacheKey("sha256:abc123");
      expect(key).toBe("validation:sha256:abc123");
    });
  });

  describe("size estimation", () => {
    it("estimates primitive sizes", () => {
      expect(estimateSize(null)).toBe(8);
      expect(estimateSize(undefined)).toBe(8);
      expect(estimateSize(true)).toBe(4);
      expect(estimateSize(42)).toBe(8);
      expect(estimateSize("hello")).toBe(10); // 5 chars * 2 bytes
    });

    it("estimates array sizes", () => {
      const arr = [1, 2, 3];
      const size = estimateSize(arr);

      expect(size).toBeGreaterThan(24); // Array overhead + items
    });

    it("estimates object sizes", () => {
      const obj = { name: "test", value: 42 };
      const size = estimateSize(obj);

      expect(size).toBeGreaterThan(24); // Object overhead + properties
    });
  });

  describe("edge cases", () => {
    it("handles replacing existing key", () => {
      cache.set("key1", "value1", 100);
      cache.set("key1", "value2", 50);

      expect(cache.get("key1")).toBe("value2");
      expect(cache.size()).toBe(50); // Old size removed
    });

    it("handles zero TTL gracefully", () => {
      const cache = new CacheManager({ ttl: 0 });

      cache.set("key1", "value1", 10);

      // Should expire immediately
      expect(cache.get("key1")).toBeUndefined();
    });

    it("handles zero maxSize gracefully", () => {
      const cache = new CacheManager({ maxSize: 0 });

      cache.set("key1", "value1", 10);

      // Nothing should be cached
      expect(cache.count()).toBe(0);
    });
  });
});
