import { NextRequest } from "next/server";

import { ALLOWED_EXTENSIONS, ALLOWED_FILENAMES } from "@/lib/aligns/constants";
import { getRedis } from "@/lib/aligns/submit-helpers";
import { hasKvEnv } from "@/lib/aligns/storeFactory";
import { normalizeGitUrl } from "@/lib/aligns/normalize";

type GitHubContentItem = {
  path: string;
  type: "file" | "dir";
};

type ExpandResponse = {
  files: Array<{ url: string; filename: string }>;
  dirname: string;
};

const CACHE_TTL_SECONDS = 300;

function hasAllowedExtension(path: string): boolean {
  const lower = path.toLowerCase();
  const filename = lower.split("/").pop() || "";
  if (
    ALLOWED_FILENAMES.includes(filename as (typeof ALLOWED_FILENAMES)[number])
  )
    return true;
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

async function fetchDirectoryItems(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GitHubContentItem[] | null> {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`;
  const res = await fetchImpl(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      }),
      "User-Agent": "aligntrue-directory-expand",
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as GitHubContentItem[];
  return Array.isArray(data) ? data : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const url = typeof body?.url === "string" ? body.url : "";
    if (!url) {
      return Response.json(
        { error: "Missing URL in request body." },
        { status: 400 },
      );
    }

    const normalized = normalizeGitUrl(url);
    if (
      normalized.provider !== "github" ||
      normalized.kind !== "directory" ||
      !normalized.normalizedUrl ||
      !normalized.owner ||
      !normalized.repo ||
      !normalized.ref ||
      !normalized.path
    ) {
      return Response.json(
        { error: "URL must be a GitHub directory path (tree)." },
        { status: 400 },
      );
    }

    const cacheKey = `v1:aligns:expand:${normalized.normalizedUrl}`;
    const canCache = hasKvEnv();
    if (canCache) {
      const cached = await getRedis().get<ExpandResponse>(cacheKey);
      if (cached) {
        return Response.json(cached);
      }
    }

    const items = await fetchDirectoryItems(
      normalized.owner,
      normalized.repo,
      normalized.ref,
      normalized.path,
    );

    if (!items) {
      return Response.json(
        {
          error:
            "Could not read directory contents (permission or rate limit).",
        },
        { status: 400 },
      );
    }

    const files = items
      .filter((item) => item.type === "file" && hasAllowedExtension(item.path))
      .map((item) => {
        const filename = item.path.split("/").pop() ?? item.path;
        return {
          url: `https://github.com/${normalized.owner}/${normalized.repo}/blob/${normalized.ref}/${item.path}`,
          filename,
        };
      });

    const dirname =
      normalized.path.split("/").filter(Boolean).pop() ?? normalized.path;

    const payload: ExpandResponse = { files, dirname };

    if (canCache) {
      await getRedis().set(cacheKey, payload, { ex: CACHE_TTL_SECONDS });
    }

    return Response.json(payload);
  } catch {
    return Response.json(
      { error: "Failed to expand directory." },
      { status: 500 },
    );
  }
}
