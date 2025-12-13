import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const URL = "https://github.com/AlignTrue/aligntrue/blob/main/.align.yaml";

const redisStore = new Map<string, unknown>();

async function importModule(hasKv: boolean) {
  vi.resetModules();
  vi.doMock("@upstash/redis", () => {
    class Redis {
      static fromEnv() {
        return new Redis();
      }
      async get<T>(key: string): Promise<T | null> {
        return (redisStore.get(key) as T) ?? null;
      }
      async set(key: string, value: unknown): Promise<string> {
        redisStore.set(key, value);
        return "OK";
      }

      async del(key: string): Promise<number> {
        const existed = redisStore.delete(key);
        return existed ? 1 : 0;
      }
    }
    return { Redis };
  });

  vi.doMock("./storeFactory", () => ({
    hasKvEnv: () => hasKv,
  }));

  return await import("./url-cache");
}

describe("url-cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    redisStore.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caches and reads from local memory when Redis is absent", async () => {
    const { getCachedAlignId, setCachedAlignId } = await importModule(false);

    await setCachedAlignId(URL, "align-123");
    const cached = await getCachedAlignId(URL);

    expect(cached).toBe("align-123");
  });

  it("expires entries after TTL", async () => {
    const { getCachedAlignId, setCachedAlignId } = await importModule(false);

    await setCachedAlignId(URL, "align-expire");
    expect(await getCachedAlignId(URL)).toBe("align-expire");

    vi.advanceTimersByTime(3_600_000 + 1000); // just over 1 hour

    expect(await getCachedAlignId(URL)).toBeNull();
  });

  it("persists via Redis across module reloads", async () => {
    const { setCachedAlignId } = await importModule(true);
    await setCachedAlignId(URL, "align-redis");

    const { getCachedAlignId } = await importModule(true);
    const cached = await getCachedAlignId(URL);

    expect(cached).toBe("align-redis");
  });

  it("deletes cached entries from local memory and redis", async () => {
    const { setCachedAlignId, getCachedAlignId, deleteCachedAlignId } =
      await importModule(true);

    await setCachedAlignId(URL, "align-delete");
    expect(await getCachedAlignId(URL)).toBe("align-delete");

    await deleteCachedAlignId(URL);

    // local cache cleared
    expect(await getCachedAlignId(URL)).toBeNull();

    // redis entry cleared (re-import module to force redis read)
    const { getCachedAlignId: getAfterReload } = await importModule(true);
    expect(await getAfterReload(URL)).toBeNull();
  });
});
