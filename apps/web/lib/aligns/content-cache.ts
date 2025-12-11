import { Redis } from "@upstash/redis";
import { hasKvEnv } from "./storeFactory";
import { githubBlobToRawUrl } from "./normalize";

const CONTENT_TTL_SECONDS = 3600; // 1 hour
const MAX_BYTES = 256 * 1024;

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

// In-memory content cache for local dev
const localContentCache = new Map<
  string,
  { payload: CachedContent; expiresAt: number }
>();

export type CachedPackFile = {
  path: string;
  size: number;
  content: string;
};

export type CachedContent =
  | { kind: "single"; content: string }
  | { kind: "pack"; files: CachedPackFile[] };

async function fetchWithLimit(
  url: string,
  maxBytes: number = MAX_BYTES,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;

    const reader = response.body?.getReader();
    if (!reader) {
      return null;
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    }

    const combined = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
  } catch {
    return null;
  }
}

export async function setCachedContent(
  id: string,
  payload: CachedContent,
): Promise<void> {
  const cacheKey = `v1:align:content:${id}`;
  if (!hasKvEnv()) {
    localContentCache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + CONTENT_TTL_SECONDS * 1000,
    });
    return;
  }
  await getRedis().set(cacheKey, JSON.stringify(payload), {
    ex: CONTENT_TTL_SECONDS,
  });
}

export async function getCachedContent(
  id: string,
  fallback?: () => Promise<CachedContent | null>,
): Promise<CachedContent | null> {
  const cacheKey = `v1:align:content:${id}`;

  if (!hasKvEnv()) {
    const entry = localContentCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.payload;
    }
  } else {
    const cached = await getRedis().get<string>(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as CachedContent;
      } catch {
        // fall through to fetch
      }
    }
  }

  if (!fallback) return null;

  const fetched = await fallback();
  if (!fetched) return null;

  await setCachedContent(id, fetched);
  return fetched;
}

export async function fetchRawWithCache(
  id: string,
  normalizedUrl: string,
  maxBytes: number = MAX_BYTES,
  options?: { fetchImpl?: typeof fetch },
): Promise<CachedContent | null> {
  return await getCachedContent(id, async () => {
    const rawUrl = githubBlobToRawUrl(normalizedUrl);
    if (!rawUrl) return null;
    const content = await fetchWithLimit(
      rawUrl,
      maxBytes,
      options?.fetchImpl ?? fetch,
    );
    if (!content) return null;
    return { kind: "single", content };
  });
}
