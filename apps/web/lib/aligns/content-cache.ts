import { Redis } from "@upstash/redis";
import { githubBlobToRawUrl } from "./normalize";
import { hasKvEnv } from "./storeFactory";

const CONTENT_TTL_SECONDS = 3600; // 1 hour
const MAX_BYTES = 256 * 1024;

const redis = Redis.fromEnv();

// In-memory content cache for local dev
const localContentCache = new Map<
  string,
  { content: string; expiresAt: number }
>();

async function fetchWithLimit(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
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
        if (total > MAX_BYTES) {
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
  content: string,
): Promise<void> {
  const cacheKey = `v1:align:content:${id}`;
  if (!hasKvEnv()) {
    localContentCache.set(cacheKey, {
      content,
      expiresAt: Date.now() + CONTENT_TTL_SECONDS * 1000,
    });
    return;
  }
  await redis.set(cacheKey, content, { ex: CONTENT_TTL_SECONDS });
}

export async function getCachedContent(
  id: string,
  normalizedUrl: string,
): Promise<string | null> {
  const cacheKey = `v1:align:content:${id}`;

  if (!hasKvEnv()) {
    const entry = localContentCache.get(cacheKey);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.content;
    }
  } else {
    const cached = await redis.get<string>(cacheKey);
    if (cached) return cached;
  }

  const rawUrl = githubBlobToRawUrl(normalizedUrl);
  if (!rawUrl) return null;

  const content = await fetchWithLimit(rawUrl);
  if (!content) return null;

  await setCachedContent(id, content);
  return content;
}
