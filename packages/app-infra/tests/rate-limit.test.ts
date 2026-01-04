import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const originalEnv = process.env;
const redisStore = new Map<string, number>();

vi.mock("@upstash/redis", () => {
  class Redis {
    static fromEnv() {
      return new Redis();
    }
    async incr(key: string): Promise<number> {
      const next = (redisStore.get(key) ?? 0) + 1;
      redisStore.set(key, next);
      return next;
    }
    async expire(): Promise<number> {
      return 1;
    }
  }
  return { Redis };
});

async function importModule() {
  vi.resetModules();
  return await import("../src/rate-limit/limiter.js");
}

describe("createRateLimiter", () => {
  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: "development" };
    redisStore.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.useRealTimers();
  });

  it("enforces limits with in-memory fallback when KV is absent", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    const { createRateLimiter } = await importModule();
    const allow = createRateLimiter({ maxRequests: 2, windowSeconds: 10 });

    expect(await allow("ip-1")).toBe(true);
    expect(await allow("ip-1")).toBe(true);
    expect(await allow("ip-1")).toBe(false);

    // After window expires, should reset
    vi.advanceTimersByTime(11_000);
    expect(await allow("ip-1")).toBe(true);
  });

  it("persists counters in Redis when KV is available", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://redis";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";

    const { createRateLimiter } = await importModule();
    const allow = createRateLimiter({
      maxRequests: 2,
      windowSeconds: 30,
      prefix: "test:ratelimit",
    });

    expect(await allow("client-1")).toBe(true);
    expect(await allow("client-1")).toBe(true);
    expect(await allow("client-1")).toBe(false);

    // Counter should be stored in Redis mock
    expect(redisStore.get("test:ratelimit:client-1")).toBe(3);
  });
});
