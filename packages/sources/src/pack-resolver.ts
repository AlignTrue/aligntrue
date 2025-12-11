import { posix } from "path";
import micromatch from "micromatch";
import { parseAlignManifest, parseSourceURL } from "@aligntrue/core";
import type { AlignManifest } from "@aligntrue/schema";

const MAX_FILES = 100;
const MAX_FILE_BYTES = 500 * 1024; // 500KB
const MAX_TOTAL_BYTES = 2 * 1024 * 1024; // 2MB

interface GitHubTreeEntry {
  path: string;
  type: "blob" | "tree";
  size?: number;
}

export interface PackFile {
  path: string;
  size: number;
  content: string;
}

export interface ResolvedPack {
  manifest: AlignManifest;
  manifestPath: string;
  files: PackFile[];
  ref: string;
  repo: { host: string; org: string; repo: string };
}

export interface PackResolverOptions {
  /**
   * Optional GitHub token to raise rate limits.
   */
  token?: string;
  /**
   * Ref override (branch/tag/commit). Defaults to ref in URL or 'main'.
   */
  ref?: string;
  /**
   * Custom fetch implementation (for tests or non-global fetch environments).
   */
  fetchImpl?: typeof fetch;
}

export async function resolvePackFromGithub(
  sourceUrl: string,
  options: PackResolverOptions = {},
): Promise<ResolvedPack> {
  const parsed = parseSourceURL(sourceUrl);
  if (parsed.host !== "github.com") {
    throw new Error(
      `Only GitHub is supported for .align.yaml packs right now (got ${parsed.host}).`,
    );
  }

  const ref = options.ref ?? parsed.ref ?? "main";
  const fetcher = options.fetchImpl ?? fetch;
  const tokenOpts = options.token ? { token: options.token } : {};

  const tree = await fetchGithubTree(parsed.org, parsed.repo, ref, {
    ...tokenOpts,
    fetcher,
  });

  const manifestPath = findManifestPath(parsed.path, tree);
  const manifestDir = manifestPath.includes("/")
    ? posix.dirname(manifestPath)
    : "";

  const manifestContent = await fetchGithubRaw(
    parsed.org,
    parsed.repo,
    ref,
    manifestPath,
    { ...tokenOpts, fetcher },
  );

  const { manifest } = parseAlignManifest(manifestContent, {
    manifestPath,
  });

  const { files, totalBytes } = await resolveIncludedFiles({
    manifest,
    manifestDir,
    tree,
    org: parsed.org,
    repo: parsed.repo,
    ref,
    ...(options.token ? { token: options.token } : {}),
    fetcher,
  });

  if (files.length === 0) {
    throw new Error(
      "No files matched the manifest includes. Add entries under includes.rules/skills/mcp.",
    );
  }

  if (files.length > MAX_FILES) {
    throw new Error(
      `Pack exceeds file limit: ${files.length} files (max ${MAX_FILES}).`,
    );
  }

  if (totalBytes > MAX_TOTAL_BYTES) {
    throw new Error(
      `Pack exceeds total size limit: ${(totalBytes / 1024).toFixed(1)}KB (max ${(MAX_TOTAL_BYTES / 1024).toFixed(0)}KB).`,
    );
  }

  return {
    manifest,
    manifestPath,
    files,
    ref,
    repo: { host: parsed.host, org: parsed.org, repo: parsed.repo },
  };
}

async function fetchGithubTree(
  org: string,
  repo: string,
  ref: string,
  opts: { token?: string; fetcher: typeof fetch },
): Promise<GitHubTreeEntry[]> {
  const url = `https://api.github.com/repos/${org}/${repo}/git/trees/${ref}?recursive=1`;
  const res = await opts.fetcher(url, {
    headers: buildGithubHeaders(opts.token),
  });

  if (res.status === 404) {
    throw new Error(
      `Repository or ref not found: ${org}/${repo}@${ref}. Check the URL and ref.`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `Failed to load repository tree (${res.status} ${res.statusText}).`,
    );
  }

  const body = (await res.json()) as { tree?: GitHubTreeEntry[] };
  if (!body.tree || !Array.isArray(body.tree)) {
    throw new Error("GitHub tree response missing 'tree' entries.");
  }
  return body.tree;
}

function findManifestPath(
  requestedPath: string | undefined,
  tree: GitHubTreeEntry[],
): string {
  const isManifestPath = (p: string) =>
    p.endsWith(".align.yaml") || p.endsWith(".align.yml");

  const treePaths = tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path);

  // If user pointed directly at a manifest file, validate and use it.
  if (requestedPath && isManifestPath(trimLeadingSlash(requestedPath))) {
    const normalized = trimLeadingSlash(requestedPath);
    if (!treePaths.includes(normalized)) {
      throw new Error(
        `Manifest not found at ${requestedPath}. Ensure the file exists on the target ref.`,
      );
    }
    return normalized;
  }

  // If user pointed at a directory, search within that directory.
  const baseDir = requestedPath ? trimLeadingSlash(requestedPath) : "";
  const candidate = treePaths.find((p) => {
    if (!isManifestPath(p)) return false;
    const dir = p.includes("/") ? posix.dirname(p) : "";
    return dir === baseDir;
  });

  if (candidate) return candidate;

  throw new Error(
    `No .align.yaml found${baseDir ? ` in ${baseDir}` : ""}. Add one or provide a direct file URL.`,
  );
}

async function resolveIncludedFiles(params: {
  manifest: AlignManifest;
  manifestDir: string;
  tree: GitHubTreeEntry[];
  org: string;
  repo: string;
  ref: string;
  token?: string;
  fetcher: typeof fetch;
}): Promise<{ files: PackFile[]; totalBytes: number }> {
  const includePatterns = [
    ...(params.manifest.includes?.rules ?? []),
    ...(params.manifest.includes?.skills ?? []),
    ...(params.manifest.includes?.mcp ?? []),
  ].map((p) => normalizeIncludePattern(p));

  if (includePatterns.length === 0) {
    throw new Error(
      "Manifest includes are empty. Add entries under includes.rules/skills/mcp.",
    );
  }

  const available = params.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => ({
      fullPath: entry.path,
      relative: toRelative(entry.path, params.manifestDir),
      size: entry.size ?? 0,
    }))
    .filter((entry) => entry.relative !== null) as {
    fullPath: string;
    relative: string;
    size: number;
  }[];

  const orderedPaths: string[] = [];
  const seen = new Set<string>();

  for (const pattern of includePatterns) {
    for (const entry of available) {
      if (micromatch.isMatch(entry.relative, pattern, { dot: true })) {
        if (!seen.has(entry.fullPath)) {
          orderedPaths.push(entry.fullPath);
          seen.add(entry.fullPath);
        }
      }
    }
  }

  if (orderedPaths.length === 0) {
    throw new Error(
      `No files matched manifest includes (${includePatterns.join(", ")}).`,
    );
  }

  if (orderedPaths.length > MAX_FILES) {
    throw new Error(
      `Pack exceeds file limit: ${orderedPaths.length} files (max ${MAX_FILES}).`,
    );
  }

  // Pre-check sizes using tree metadata
  let totalBytes = 0;
  const entriesByPath = new Map(
    available.map((entry) => [entry.fullPath, entry]),
  );

  for (const path of orderedPaths) {
    const entry = entriesByPath.get(path);
    if (!entry) {
      throw new Error(`Tree entry missing for ${path}`);
    }
    if (entry.size > MAX_FILE_BYTES) {
      throw new Error(
        `File ${path} is too large (${entry.size} bytes). Max per file is ${MAX_FILE_BYTES} bytes.`,
      );
    }
    totalBytes += entry.size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `Pack exceeds total size limit before download: ${(totalBytes / 1024).toFixed(1)}KB (max ${(MAX_TOTAL_BYTES / 1024).toFixed(0)}KB).`,
      );
    }
  }

  const files: PackFile[] = [];
  totalBytes = 0;

  for (const path of orderedPaths) {
    const content = await fetchGithubRaw(
      params.org,
      params.repo,
      params.ref,
      path,
      {
        ...(params.token ? { token: params.token } : {}),
        fetcher: params.fetcher,
      },
    );
    const size = Buffer.byteLength(content, "utf-8");

    if (size > MAX_FILE_BYTES) {
      throw new Error(
        `File ${path} exceeds 500KB after download (${size} bytes).`,
      );
    }

    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) {
      throw new Error(
        `Pack exceeds total size limit after download: ${(totalBytes / 1024).toFixed(1)}KB (max ${(MAX_TOTAL_BYTES / 1024).toFixed(0)}KB).`,
      );
    }

    files.push({ path, size, content });
  }

  return { files, totalBytes };
}

async function fetchGithubRaw(
  org: string,
  repo: string,
  ref: string,
  path: string,
  opts: { token?: string; fetcher: typeof fetch },
): Promise<string> {
  const url = `https://raw.githubusercontent.com/${org}/${repo}/${ref}/${path}`;
  const res = await opts.fetcher(url, {
    headers: buildGithubHeaders(opts.token),
  });

  if (res.status === 404) {
    throw new Error(
      `File not found in repository: ${path} (@${ref}). Check includes path.`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${path} (${res.status} ${res.statusText}).`,
    );
  }

  return await res.text();
}

function buildGithubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "aligntrue-cli",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function normalizeIncludePattern(pattern: string): string {
  const trimmed = pattern.trim().replace(/^\.\//, "");
  if (!trimmed) {
    throw new Error("Manifest includes contain an empty path.");
  }
  if (trimmed.includes("..")) {
    throw new Error(
      `Invalid include path '${pattern}': parent directory (..) is not allowed.`,
    );
  }
  if (trimmed.startsWith("/")) {
    throw new Error(
      `Invalid include path '${pattern}': absolute paths are not allowed.`,
    );
  }
  return trimmed;
}

function toRelative(path: string, baseDir: string): string | null {
  if (!baseDir) return path;
  if (path === baseDir) return null;
  if (path.startsWith(`${baseDir}/`)) {
    return path.slice(baseDir.length + 1);
  }
  return null;
}

function trimLeadingSlash(path: string): string {
  return path.replace(/^\/+/, "");
}
