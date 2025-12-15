import { getAlignStore, hasKvEnv } from "@/lib/aligns/storeFactory";
import { extractMetadata } from "@/lib/aligns/metadata";
import {
  alignIdFromNormalizedUrl,
  normalizeGitUrl,
} from "@/lib/aligns/normalize";
import { hasAllowedExtension } from "@/lib/aligns/url-validation";
import {
  fetchWithLimit,
  hashString,
  getRedis,
  rateLimit,
} from "@/lib/aligns/submit-helpers";
import {
  resolveGistFiles,
  selectPrimaryFile,
} from "@/lib/aligns/gist-resolver";
import {
  fetchRawWithCache,
  setCachedContent,
  type CachedContent,
} from "@/lib/aligns/content-cache";
import { buildSingleRuleRecord } from "@/lib/aligns/records";
import type { AlignRecord } from "@/lib/aligns/types";
import { getAuthToken } from "@/lib/aligns/github-app";
import { createCachingFetch } from "@/lib/aligns/caching-fetch";
import {
  getCachedAlignId,
  setCachedAlignId,
  deleteCachedAlignId,
} from "@/lib/aligns/url-cache";
import { MAX_FILE_BYTES } from "@/lib/aligns/constants";

export const dynamic = "force-dynamic";

const store = getAlignStore();

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
      const existing = await store.get(cachedId);
      if (existing) {
        return Response.json({ id: cachedId, title: existing.title });
      }
      // Stale cache: align was deleted; clear and continue with fresh import
      await deleteCachedAlignId(trimmedUrl);
    }

    const githubToken = await getAuthToken();
    const cachingFetch = createCachingFetch(hasKvEnv() ? getRedis() : null, {
      token: githubToken ?? undefined,
      ttlSeconds: 3600,
    });

    // Single file flow
    const normalized = normalizeGitUrl(trimmedUrl);
    if (normalized.provider !== "github") {
      return Response.json(
        {
          error:
            "Only GitHub URLs are supported. Paste a link to a file (blob) or directory (tree).",
        },
        { status: 400 },
      );
    }

    if (normalized.kind === "directory") {
      return Response.json(
        {
          error:
            "This URL points to a repository or directory without a specific file.",
          hint: "Paste a direct link to a file (e.g., .../blob/main/rules/file.md).",
        },
        { status: 400 },
      );
    }

    if (!normalized.normalizedUrl) {
      return Response.json(
        {
          error:
            "Only GitHub URLs are supported. Paste a link to a file (blob) or directory (tree).",
        },
        { status: 400 },
      );
    }

    // 2a) Gist handling
    if (normalized.kind === "gist" && normalized.gistId) {
      let files;
      try {
        files = await resolveGistFiles(normalized.gistId, {
          token: githubToken,
          fetchImpl: cachingFetch,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not load gist";
        return Response.json({ error: message }, { status: 400 });
      }
      const primary = selectPrimaryFile(files, normalized.filename);
      if (!primary) {
        return Response.json(
          { error: "Gist has no files to import." },
          { status: 400 },
        );
      }

      if (!hasAllowedExtension(primary.filename || primary.rawUrl)) {
        const filename = primary.filename || "the provided file";
        return Response.json(
          {
            error: `Unsupported file type: ${filename}`,
            hint: "We support .md, .mdc, .mdx, .markdown, .xml, and agent-specific files like .clinerules, .cursorrules, and .goosehints.",
            issueUrl:
              "https://github.com/AlignTrue/aligntrue/issues/new?title=Support%20new%20file%20type&labels=enhancement",
          },
          { status: 400 },
        );
      }

      if (primary.size > MAX_FILE_BYTES) {
        return Response.json(
          {
            error: `File too large (max ${MAX_FILE_BYTES / 1024}KB) or could not be fetched. Try a smaller file.`,
          },
          { status: 413 },
        );
      }

      const content = await fetchWithLimit(
        primary.rawUrl,
        MAX_FILE_BYTES,
        cachingFetch,
      );
      if (content === null) {
        return Response.json(
          {
            error: `File too large (max ${MAX_FILE_BYTES / 1024}KB) or could not be fetched. Try a smaller file.`,
          },
          { status: 413 },
        );
      }

      const id = alignIdFromNormalizedUrl(primary.rawUrl);
      const meta = extractMetadata(primary.rawUrl, content);
      const existing = await store.get(id);
      const now = new Date().toISOString();
      const contentHash = hashString(content);

      const record: AlignRecord = buildSingleRuleRecord({
        id,
        sourceUrl: body.url,
        normalizedUrl: primary.rawUrl,
        meta,
        existing,
        now,
        contentHash,
        contentHashUpdatedAt: now,
      });

      await store.upsert(record);
      await setCachedContent(id, { kind: "single", content });
      await Promise.all([
        setCachedAlignId(trimmedUrl, id),
        setCachedAlignId(primary.rawUrl, id),
      ]);

      return Response.json({ id, title: record.title });
    }

    const normalizedUrl = normalized.normalizedUrl;

    if (!hasAllowedExtension(normalizedUrl)) {
      const filename =
        normalizedUrl.split("/").pop() || "the provided file path";
      return Response.json(
        {
          error: `Unsupported file type: ${filename}`,
          hint: "We support .md, .mdc, .mdx, .markdown, .xml, and agent-specific files like .clinerules, .cursorrules, and .goosehints.",
          issueUrl:
            "https://github.com/AlignTrue/aligntrue/issues/new?title=Support%20new%20file%20type&labels=enhancement",
        },
        { status: 400 },
      );
    }

    const id = alignIdFromNormalizedUrl(normalizedUrl);
    let cached: CachedContent | null = null;
    try {
      cached = await fetchRawWithCache(id, normalizedUrl, MAX_FILE_BYTES, {
        fetchImpl: cachingFetch,
      });
    } catch (error) {
      console.error("fetch raw error", error);
      return Response.json(
        {
          error:
            "Could not fetch the file. It may be private, deleted, or temporarily unavailable.",
        },
        { status: 400 },
      );
    }
    if (!cached || cached.kind !== "single") {
      return Response.json(
        {
          error: `File too large (max ${MAX_FILE_BYTES / 1024}KB) or could not be fetched. Try a smaller file.`,
        },
        { status: 413 },
      );
    }

    const meta = extractMetadata(normalizedUrl, cached.content);
    const existing = await store.get(id);
    const now = new Date().toISOString();
    const contentHash = hashString(cached.content);

    const record: AlignRecord = buildSingleRuleRecord({
      id,
      sourceUrl: body.url,
      normalizedUrl,
      meta,
      existing,
      now,
      contentHash,
      contentHashUpdatedAt: now,
    });

    await store.upsert(record);
    // Ensure cache refreshed (fetchRawWithCache already populated)
    await setCachedContent(id, cached);
    await Promise.all([
      setCachedAlignId(trimmedUrl, id),
      setCachedAlignId(normalizedUrl, id),
    ]);

    return Response.json({ id, title: record.title });
  } catch (error) {
    console.error("submit error", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
