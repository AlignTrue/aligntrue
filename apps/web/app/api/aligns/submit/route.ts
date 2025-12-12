import crypto from "node:crypto";
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
  type CachedPackFile,
} from "@/lib/aligns/content-cache";
import { buildPackAlignRecord } from "@/lib/aligns/records";
import type { AlignRecord } from "@/lib/aligns/types";
import { getAuthToken } from "@/lib/aligns/github-app";
import { createCachingFetch } from "@/lib/aligns/caching-fetch";
import { getCachedAlignId, setCachedAlignId } from "@/lib/aligns/url-cache";

export const dynamic = "force-dynamic";

const store = getAlignStore();
const ALLOWED_EXTENSIONS = [
  ".md",
  ".mdc",
  ".mdx",
  ".markdown",
  ".yaml",
  ".yml",
] as const;
const ALLOWED_FILENAMES = [
  ".clinerules",
  ".cursorrules",
  ".goosehints",
] as const;

function hasAllowedExtension(url: string): boolean {
  const lower = url.toLowerCase();
  const filename = lower.split("/").pop() || "";
  if (
    ALLOWED_FILENAMES.includes(filename as (typeof ALLOWED_FILENAMES)[number])
  )
    return true;
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
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

function hashString(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function hashPackFiles(files: CachedPackFile[]): string {
  const ordered = [...files].sort((a, b) => a.path.localeCompare(b.path));
  const payload = JSON.stringify(
    ordered.map((file) => ({ path: file.path, content: file.content })),
  );
  return hashString(payload);
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

    const trimmedUrl = body.url.trim();
    const cachedId = await getCachedAlignId(trimmedUrl);
    if (cachedId) {
      return Response.json({ id: cachedId });
    }

    const githubToken = await getAuthToken();
    const cachingFetch = createCachingFetch(hasKvEnv() ? getRedis() : null, {
      token: githubToken ?? undefined,
      ttlSeconds: 3600,
    });

    // 1) Try pack (.align.yaml) first
    try {
      const pack = await fetchPackForWeb(trimmedUrl, {
        fetchImpl: cachingFetch,
      });
      const id = alignIdFromNormalizedUrl(pack.manifestUrl);
      const existing = await store.get(id);
      const now = new Date().toISOString();
      const contentHash = hashPackFiles(pack.files);

      const record = buildPackAlignRecord({
        id,
        pack,
        sourceUrl: body.url,
        existing,
        now,
        contentHash,
        contentHashUpdatedAt: now,
      });

      await store.upsert(record);
      await setCachedContent(id, { kind: "pack", files: pack.files });
      await Promise.all([
        setCachedAlignId(trimmedUrl, id),
        setCachedAlignId(pack.manifestUrl, id),
      ]);

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
    const { provider, normalizedUrl } = normalizeGitUrl(trimmedUrl);
    if (provider !== "github" || !normalizedUrl) {
      return Response.json(
        {
          error:
            "Only GitHub URLs are supported. Paste a link to a file (blob) or directory (tree).",
        },
        { status: 400 },
      );
    }

    if (!hasAllowedExtension(normalizedUrl)) {
      const filename =
        normalizedUrl.split("/").pop() || "the provided file path";
      return Response.json(
        {
          error: `Unsupported file type: ${filename}`,
          hint: "We support .md, .mdc, .mdx, .markdown, .yaml, .yml, and agent-specific files like .clinerules, .cursorrules, and .goosehints.",
          issueUrl:
            "https://github.com/AlignTrue/aligntrue/issues/new?title=Support%20new%20file%20type&labels=enhancement",
        },
        { status: 400 },
      );
    }

    const id = alignIdFromNormalizedUrl(normalizedUrl);
    const cached = await fetchRawWithCache(id, normalizedUrl, 256 * 1024, {
      fetchImpl: cachingFetch,
    });
    if (!cached || cached.kind !== "single") {
      return Response.json(
        {
          error:
            "File too large (max 256KB) or could not be fetched. Try a smaller file.",
        },
        { status: 413 },
      );
    }

    const meta = extractMetadata(normalizedUrl, cached.content);
    const existing = await store.get(id);
    const now = new Date().toISOString();
    const contentHash = hashString(cached.content);

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
      contentHash,
      contentHashUpdatedAt: now,
      createdAt: existing?.createdAt ?? now,
      lastViewedAt: now,
      viewCount: existing?.viewCount ?? 0,
      installClickCount: existing?.installClickCount ?? 0,
    };

    await store.upsert(record);
    // Ensure cache refreshed (fetchRawWithCache already populated)
    await setCachedContent(id, cached);
    await Promise.all([
      setCachedAlignId(trimmedUrl, id),
      setCachedAlignId(normalizedUrl, id),
    ]);

    return Response.json({ id });
  } catch (error) {
    console.error("submit error", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
