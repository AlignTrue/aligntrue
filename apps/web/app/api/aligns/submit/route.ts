import { Redis } from "@upstash/redis";
import { getAlignStore, hasKvEnv } from "@/lib/aligns/storeFactory";
import { setCachedContent } from "@/lib/aligns/content-cache";
import { extractMetadata } from "@/lib/aligns/metadata";
import {
  alignIdFromNormalizedUrl,
  githubBlobToRawUrl,
  normalizeGitUrl,
} from "@/lib/aligns/normalize";
import type { AlignRecord } from "@/lib/aligns/types";

export const dynamic = "force-dynamic";

const store = getAlignStore();
const MAX_BYTES = 256 * 1024;
const redis = Redis.fromEnv();

// In-memory rate limit for local dev (no persistence across restarts)
const localRateLimits = new Map<string, { count: number; expiresAt: number }>();

async function rateLimit(ip: string): Promise<boolean> {
  if (!hasKvEnv()) {
    // In-memory rate limiting for local dev
    const now = Date.now();
    const entry = localRateLimits.get(ip);
    if (!entry || entry.expiresAt < now) {
      localRateLimits.set(ip, { count: 1, expiresAt: now + 60_000 });
      return true;
    }
    entry.count += 1;
    return entry.count <= 10;
  }

  const key = `v1:ratelimit:submit:${ip}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 60);
  }
  return count <= 10;
}

async function fetchWithLimit(url: string): Promise<string | null> {
  const response = await fetch(url);
  if (!response.ok) return null;

  const reader = response.body?.getReader();
  if (!reader) return null;

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
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") ?? "unknown";
    const allowed = await rateLimit(ip);
    if (!allowed) {
      return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.url !== "string") {
      return Response.json({ error: "Missing url" }, { status: 400 });
    }

    const { provider, normalizedUrl } = normalizeGitUrl(body.url);
    if (provider !== "github" || !normalizedUrl) {
      return Response.json(
        { error: "Only GitHub blob/raw URLs are supported" },
        { status: 400 },
      );
    }

    const id = alignIdFromNormalizedUrl(normalizedUrl);
    const rawUrl = githubBlobToRawUrl(normalizedUrl);
    if (!rawUrl) {
      return Response.json(
        { error: "Unable to derive raw URL" },
        { status: 400 },
      );
    }

    const content = await fetchWithLimit(rawUrl);
    if (!content) {
      return Response.json(
        { error: "Failed to fetch content or file too large (>256KB)" },
        { status: 413 },
      );
    }

    const meta = extractMetadata(normalizedUrl, content);
    const existing = await store.get(id);
    const now = new Date().toISOString();

    const record: AlignRecord = {
      schemaVersion: 1,
      id,
      url: body.url,
      normalizedUrl,
      provider: "github",
      kind: meta.kind,
      title: meta.title,
      description: meta.description,
      fileType: meta.fileType,
      createdAt: existing?.createdAt ?? now,
      lastViewedAt: now,
      viewCount: existing?.viewCount ?? 0,
      installClickCount: existing?.installClickCount ?? 0,
    };

    await store.upsert(record);
    await setCachedContent(id, content);

    return Response.json({ id });
  } catch (error) {
    console.error("submit error", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
