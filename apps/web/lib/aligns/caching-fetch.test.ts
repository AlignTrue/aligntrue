import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;

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

  return await import("./caching-fetch");
}

describe("createCachingFetch", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.useFakeTimers();
    redisStore.clear();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("caches successful responses and reuses them on 304", async () => {
    const url = "https://api.github.com/repos/test/repo/git/trees/main";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("tree-data", {
          status: 200,
          headers: { etag: "etag-1", "content-type": "application/json" },
        }),
      )
      .mockImplementationOnce((_, init) => {
        const headers = new Headers(init?.headers as HeadersInit);
        expect(headers.get("If-None-Match")).toBe("etag-1");
        return Promise.resolve(new Response(null, { status: 304 }));
      });

    vi.stubGlobal("fetch", fetchMock);

    const { createCachingFetch } = await importModule(false);
    const cachingFetch = createCachingFetch(null, {
      token: "token-123",
      ttlSeconds: 3600,
    });

    const res1 = await cachingFetch(url);
    expect(await res1.text()).toBe("tree-data");

    const res2 = await cachingFetch(url);
    expect(await res2.text()).toBe("tree-data");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Authorization header should be present on requests
    const firstHeaders = new Headers(
      fetchMock.mock.calls[0][1]?.headers as HeadersInit,
    );
    expect(firstHeaders.get("Authorization")).toBe("Bearer token-123");
  });

  it("expires cache after TTL and refetches", async () => {
    const url = "https://api.github.com/repos/test/repo/git/trees/main";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("first", { status: 200, headers: { etag: "etag-a" } }),
      )
      .mockResolvedValueOnce(
        new Response(null, { status: 304 }), // within TTL, should reuse
      )
      .mockResolvedValueOnce(
        new Response("second", { status: 200, headers: { etag: "etag-b" } }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { createCachingFetch } = await importModule(false);
    const cachingFetch = createCachingFetch(null, { ttlSeconds: 1 });

    const res1 = await cachingFetch(url);
    expect(await res1.text()).toBe("first");

    const res2 = await cachingFetch(url);
    expect(await res2.text()).toBe("first");

    // Advance beyond TTL to force refetch
    vi.advanceTimersByTime(2000);

    const res3 = await cachingFetch(url);
    expect(await res3.text()).toBe("second");

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("bypasses caching when GITHUB_DISABLE_CACHING is true", async () => {
    process.env.GITHUB_DISABLE_CACHING = "true";
    const url = "https://api.github.com/repos/test/repo/git/trees/main";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("fresh", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const { createCachingFetch } = await importModule(false);
    const cachingFetch = createCachingFetch(null, { ttlSeconds: 3600 });

    await cachingFetch(url);
    await cachingFetch(url);

    // Without caching, both calls hit fetch
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("persists cache through Redis when available", async () => {
    const url = "https://api.github.com/repos/test/repo/git/trees/main";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("from-redis", {
          status: 200,
          headers: { etag: "etag-redis" },
        }),
      )
      .mockImplementationOnce((_, init) => {
        const headers = new Headers(init?.headers as HeadersInit);
        // Should still send If-None-Match after reload
        expect(headers.get("If-None-Match")).toBe("etag-redis");
        return Promise.resolve(new Response(null, { status: 304 }));
      });

    vi.stubGlobal("fetch", fetchMock);

    // First import writes to Redis mock
    const { createCachingFetch } = await importModule(true);
    const cachingFetch = createCachingFetch(null, { ttlSeconds: 3600 });
    await cachingFetch(url);

    // Reload modules to clear local cache but keep Redis mock store
    const { createCachingFetch: reloaded } = await importModule(true);
    const cachingFetchReloaded = reloaded(null, { ttlSeconds: 3600 });
    const res = await cachingFetchReloaded(url);

    expect(await res.text()).toBe("from-redis");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
