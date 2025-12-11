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
});
