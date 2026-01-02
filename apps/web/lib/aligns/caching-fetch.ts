import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { hasKvEnv } from "./storeFactory";

type Fetcher = typeof fetch;

type CachedResponse = {
  status: number;
  statusText?: string;
  body: string;
  etag?: string;
  contentType?: string;
};

const localCache = new Map<
  string,
  { value: CachedResponse; expiresAt: number }
>();

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function isCacheDisabled(): boolean {
  return process.env.GITHUB_DISABLE_CACHING === "true";
}

function cacheKey(url: string): string {
  return `gh:fetch:${hashUrl(url)}`;
}

function getRedis(redis?: Redis | null): Redis {
  if (redis) return redis;
  return Redis.fromEnv();
}

async function readCache(
  key: string,
  ttlSeconds: number,
  redis?: Redis | null,
): Promise<CachedResponse | null> {
  if (isCacheDisabled()) return null;

  const now = Date.now();
  const local = localCache.get(key);
  if (local && local.expiresAt > now) {
    return local.value;
  }

  if (!hasKvEnv()) return null;

  const cached = await getRedis(redis).get<CachedResponse>(key);
  if (!cached) return null;

  localCache.set(key, {
    value: cached,
    expiresAt: now + ttlSeconds * 1000,
  });
  return cached;
}

async function writeCache(
  key: string,
  value: CachedResponse,
  ttlSeconds: number,
  redis?: Redis | null,
): Promise<void> {
  if (isCacheDisabled()) return;

  const expiresAt = Date.now() + ttlSeconds * 1000;
  localCache.set(key, { value, expiresAt });

  if (!hasKvEnv()) return;
  await getRedis(redis).set(key, value, { ex: ttlSeconds });
}

export function createCachingFetch(
  redis: Redis | null,
  options?: { token?: string; ttlSeconds?: number },
): Fetcher {
  const ttlSeconds = options?.ttlSeconds ?? 3600;
  const token = options?.token;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    const key = cacheKey(url);

    const headers = new Headers(init?.headers ?? {});
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("User-Agent", "aligntrue-web");
    if (!headers.has("Accept")) {
      headers.set("Accept", "application/vnd.github+json");
    }

    const cached = await readCache(key, ttlSeconds, redis);
    if (cached?.etag) {
      headers.set("If-None-Match", cached.etag);
    }

    const response = await fetch(url, { ...init, headers });

    if (response.status === 304 && cached) {
      const cachedHeaders = new Headers();
      if (cached.contentType) {
        cachedHeaders.set("Content-Type", cached.contentType);
      }
      if (cached.etag) {
        cachedHeaders.set("ETag", cached.etag);
      }
      return new Response(cached.body, {
        status: cached.status,
        statusText: cached.statusText,
        headers: cachedHeaders,
      });
    }

    // Read body once and reuse: clone for caching, return original response.
    const cloned = response.clone();
    const bodyText = await cloned.text();
    const etag = cloned.headers.get("etag") ?? undefined;
    const contentType = cloned.headers.get("content-type") ?? undefined;

    if (response.ok) {
      await writeCache(
        key,
        {
          status: response.status,
          statusText: response.statusText,
          body: bodyText,
          etag,
          contentType,
        },
        ttlSeconds,
        redis,
      );
    }

    return response;
  };
}
