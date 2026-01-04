import crypto from "node:crypto";
import type { Redis } from "@upstash/redis";

import { getRedis, hasKvEnv } from "../kv/factory.js";

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
  return process.env["GITHUB_DISABLE_CACHING"] === "true";
}

function cacheKey(url: string): string {
  return `gh:fetch:${hashUrl(url)}`;
}

function ensureRedis(redis?: Redis | null): Redis | null {
  if (redis) return redis;
  if (!hasKvEnv()) return null;
  return getRedis();
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

  const client = ensureRedis(redis);
  if (!client) return null;

  const cached = await client.get<CachedResponse>(key);
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

  const client = ensureRedis(redis);
  if (!client) return;
  await client.set(key, value, { ex: ttlSeconds });
}

export function createCachingFetch(
  redis: Redis | null,
  options?: { token?: string; ttlSeconds?: number; userAgent?: string },
): Fetcher {
  const ttlSeconds = options?.ttlSeconds ?? 3600;
  const token = options?.token;
  const userAgent = options?.userAgent ?? "aligntrue-app-infra";

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
    headers.set("User-Agent", userAgent);
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
      const init: ResponseInit = {
        status: cached.status,
        headers: cachedHeaders,
      };
      if (cached.statusText) {
        init.statusText = cached.statusText;
      }
      return new Response(cached.body, init);
    }

    // Read body once and reuse: clone for caching, return original response.
    const cloned = response.clone();
    const bodyText = await cloned.text();
    const etag = cloned.headers.get("etag") ?? undefined;
    const contentType = cloned.headers.get("content-type") ?? undefined;

    if (response.ok) {
      const cacheValue: CachedResponse = {
        status: response.status,
        statusText: response.statusText,
        body: bodyText,
      };
      if (etag) cacheValue.etag = etag;
      if (contentType) cacheValue.contentType = contentType;

      await writeCache(key, cacheValue, ttlSeconds, redis);
    }

    return response;
  };
}
