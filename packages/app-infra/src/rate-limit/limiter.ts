import type { Redis } from "@upstash/redis";

import { getRedis, hasKvEnv } from "../kv/factory.js";

export interface RateLimiterOptions {
  windowSeconds?: number;
  maxRequests?: number;
  /**
   * Redis key prefix used for counting.
   */
  prefix?: string;
  /**
   * Optional Redis client override. When omitted, defaults to `Redis.fromEnv()`.
   */
  redis?: Redis | null;
}

type LocalEntry = { count: number; expiresAt: number };

/**
 * Creates an at-least-once rate limiter with Redis persistence and an
 * in-memory fallback for local development.
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowSeconds = options.windowSeconds ?? 60;
  const maxRequests = options.maxRequests ?? 10;
  const prefix = options.prefix ?? "v1:ratelimit:generic";
  const localEntries = new Map<string, LocalEntry>();

  return async function allow(id: string): Promise<boolean> {
    if (process.env["NODE_ENV"] === "test") return true;

    if (!hasKvEnv()) {
      const now = Date.now();
      const current = localEntries.get(id);
      if (!current || current.expiresAt < now) {
        localEntries.set(id, {
          count: 1,
          expiresAt: now + windowSeconds * 1000,
        });
        return true;
      }
      current.count += 1;
      return current.count <= maxRequests;
    }

    const redis = options.redis ?? getRedis();
    const key = `${prefix}:${id}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return count <= maxRequests;
  };
}

export const rateLimit = createRateLimiter();
