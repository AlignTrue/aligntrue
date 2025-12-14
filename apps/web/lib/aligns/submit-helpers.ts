import crypto from "node:crypto";
import { Redis } from "@upstash/redis";

import { hasKvEnv } from "./storeFactory";
import {
  MAX_FILE_BYTES,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW_SECONDS,
} from "./constants";
import type { CachedPackFile } from "./content-cache";

let redisClient: Redis | null = null;
export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

// In-memory rate limit for local dev (no persistence across restarts)
const localRateLimits = new Map<string, { count: number; expiresAt: number }>();

export async function rateLimit(ip: string): Promise<boolean> {
  if (process.env.NODE_ENV === "test") return true;

  if (!hasKvEnv()) {
    // In-memory rate limiting for local dev
    const now = Date.now();
    const entry = localRateLimits.get(ip);
    if (!entry || entry.expiresAt < now) {
      localRateLimits.set(ip, {
        count: 1,
        expiresAt: now + RATE_LIMIT_WINDOW_SECONDS * 1000,
      });
      return true;
    }
    entry.count += 1;
    return entry.count <= RATE_LIMIT_REQUESTS;
  }

  const key = `v1:ratelimit:submit:${ip}`;
  const count = await getRedis().incr(key);
  if (count === 1) {
    await getRedis().expire(key, RATE_LIMIT_WINDOW_SECONDS);
  }
  return count <= RATE_LIMIT_REQUESTS;
}

export function isPackNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("no .align.yaml") || message.includes("manifest not found")
  );
}

export function hashString(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function hashPackFiles(files: CachedPackFile[]): string {
  const ordered = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const payload = JSON.stringify(
    ordered.map((file) => ({ path: file.path, content: file.content })),
  );
  return hashString(payload);
}

export async function fetchWithLimit(
  url: string,
  maxBytes: number = MAX_FILE_BYTES,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const response = await fetchImpl(url);
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    let received = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.length;
        if (received > maxBytes) {
          reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    }
    const combined = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder("utf-8").decode(combined);
  } catch {
    return null;
  }
}
