import crypto from "node:crypto";
import { Redis } from "@upstash/redis";
import { hasKvEnv } from "./storeFactory";

const URL_CACHE_TTL_SECONDS = 3600; // 1 hour
const localCache = new Map<string, { id: string; expiresAt: number }>();

function hashUrl(url: string): string {
  return crypto.createHash("sha256").update(url).digest("hex");
}

function keyFor(url: string): string {
  return `gh:url:${hashUrl(url)}`;
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

export async function getCachedAlignId(url: string): Promise<string | null> {
  const key = keyFor(url);
  const now = Date.now();
  const local = localCache.get(key);
  if (local && local.expiresAt > now) {
    return local.id;
  }

  if (!hasKvEnv()) return null;
  const cached = await getRedis().get<{ id: string }>(key);
  if (!cached?.id) return null;

  localCache.set(key, {
    id: cached.id,
    expiresAt: now + URL_CACHE_TTL_SECONDS * 1000,
  });
  return cached.id;
}

export async function setCachedAlignId(url: string, id: string): Promise<void> {
  const key = keyFor(url);
  const expiresAt = Date.now() + URL_CACHE_TTL_SECONDS * 1000;
  localCache.set(key, { id, expiresAt });

  if (!hasKvEnv()) return;
  await getRedis().set(key, { id }, { ex: URL_CACHE_TTL_SECONDS });
}
