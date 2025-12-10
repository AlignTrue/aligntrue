import { Redis } from "@upstash/redis";
import { getAlignStore, hasKvEnv } from "@/lib/aligns/storeFactory";
import { extractMetadata } from "@/lib/aligns/metadata";
import {
  alignIdFromNormalizedUrl,
  normalizeGitUrl,
} from "@/lib/aligns/normalize";
import { fetchPackForWeb } from "@/lib/aligns/pack-fetcher";
import {
  fetchRawWithCache,
  setCachedContent,
} from "@/lib/aligns/content-cache";
import type { AlignRecord } from "@/lib/aligns/types";

export const dynamic = "force-dynamic";

const store = getAlignStore();
let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

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
  const count = await getRedis().incr(key);
  if (count === 1) {
    await getRedis().expire(key, 60);
  }
  return count <= 10;
}

function isPackNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("no .align.yaml") || message.includes("manifest not found")
  );
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

    // 1) Try pack (.align.yaml) first
    try {
      const pack = await fetchPackForWeb(body.url);
      const id = alignIdFromNormalizedUrl(pack.manifestUrl);
      const existing = await store.get(id);
      const now = new Date().toISOString();

      const record: AlignRecord = {
        schemaVersion: 1,
        id,
        url: body.url,
        normalizedUrl: pack.manifestUrl,
        provider: "github",
        kind: "pack",
        title: pack.info.manifestSummary ?? pack.info.manifestId,
        // Avoid duplicating the title; only surface a secondary field if present
        description: pack.info.manifestAuthor ?? null,
        fileType: "markdown",
        createdAt: existing?.createdAt ?? now,
        lastViewedAt: now,
        viewCount: existing?.viewCount ?? 0,
        installClickCount: existing?.installClickCount ?? 0,
        pack: pack.info,
      };

      await store.upsert(record);
      await setCachedContent(id, { kind: "pack", files: pack.files });

      return Response.json({ id });
    } catch (packError) {
      if (!isPackNotFoundError(packError)) {
        const message =
          packError instanceof Error ? packError.message : "Pack import failed";
        console.error("submit pack error", packError);
        return Response.json({ error: message }, { status: 400 });
      }
      // Otherwise fall through to single-file handling
    }

    // 2) Single file fallback
    const { provider, normalizedUrl } = normalizeGitUrl(body.url);
    if (provider !== "github" || !normalizedUrl) {
      return Response.json(
        { error: "Only GitHub blob/raw URLs are supported" },
        { status: 400 },
      );
    }

    const id = alignIdFromNormalizedUrl(normalizedUrl);
    const cached = await fetchRawWithCache(id, normalizedUrl);
    if (!cached || cached.kind !== "single") {
      return Response.json(
        { error: "Failed to fetch content or file too large (>256KB)" },
        { status: 413 },
      );
    }

    const meta = extractMetadata(normalizedUrl, cached.content);
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
    // Ensure cache refreshed (fetchRawWithCache already populated)
    await setCachedContent(id, cached);

    return Response.json({ id });
  } catch (error) {
    console.error("submit error", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
