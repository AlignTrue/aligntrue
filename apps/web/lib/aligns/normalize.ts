import crypto from "node:crypto";

export type NormalizedGitSource = {
  provider: "github" | "unknown";
  normalizedUrl: string | null;
  kind: "single" | "directory" | "gist" | "unknown";
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  gistId?: string;
  filename?: string | null;
  revision?: string | null;
};

/**
 * v1: only GitHub is fully supported.
 * - Accepts github.com blob URLs and raw.githubusercontent.com URLs.
 * - Accepts gist.github.com and gist.githubusercontent.com URLs (primary file selection is handled upstream).
 * - Normalizes to: https://github.com/{owner}/{repo}/blob/{branch}/{path} for repos,
 *   or canonical gist URLs for gists.
 */
export function normalizeGitUrl(input: string): NormalizedGitSource {
  const trimmed = input.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { provider: "unknown", normalizedUrl: null, kind: "unknown" };
  }

  // GitHub gists (canonical UI URL)
  if (url.hostname === "gist.github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, gistId] = parts;
    if (owner && gistId) {
      const fragment = url.hash?.replace(/^#file-/, "") || null;
      return {
        provider: "github",
        normalizedUrl: `https://gist.github.com/${owner}/${gistId}`,
        kind: "gist",
        owner,
        gistId,
        filename: fragment,
        revision: null,
      };
    }
    return { provider: "github", normalizedUrl: null, kind: "unknown" };
  }

  // GitHub gists (raw host)
  if (url.hostname === "gist.githubusercontent.com") {
    // Example: /{owner}/{gistId}/raw/{revision?}/{filename}
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, gistId, maybeRaw, ...afterRaw] = parts;
    if (owner && gistId && (maybeRaw === "raw" || maybeRaw === "raw/")) {
      const hasRevision = afterRaw.length >= 2;
      const revision = hasRevision ? afterRaw[0] : null;
      const filename = hasRevision
        ? (afterRaw[afterRaw.length - 1] ?? null)
        : (afterRaw[0] ?? null);
      return {
        provider: "github",
        normalizedUrl: url.toString(),
        kind: "gist",
        owner,
        gistId,
        filename,
        revision,
      };
    }
    return { provider: "github", normalizedUrl: null, kind: "unknown" };
  }

  // GitHub blob URLs
  if (url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, maybeBlob, branch, ...rest] = parts;
    if (owner && repo) {
      if (maybeBlob === "blob" && branch && rest.length > 0) {
        const path = rest.join("/");
        const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
        return {
          provider: "github",
          normalizedUrl: normalized,
          kind: "single",
          owner,
          repo,
          ref: branch,
          path,
        };
      }
      if (maybeBlob === "tree" && branch) {
        const path = rest.join("/");
        const normalized = `https://github.com/${owner}/${repo}/tree/${branch}/${path}`;
        return {
          provider: "github",
          normalizedUrl: normalized,
          kind: "directory",
          owner,
          repo,
          ref: branch,
          path,
        };
      }
      // Repo root or unspecified path - treat as directory
      return {
        provider: "github",
        normalizedUrl: null,
        kind: "directory",
        owner,
        repo,
        ref: branch,
        path: rest.join("/"),
      };
    }
    return { provider: "github", normalizedUrl: null, kind: "unknown" };
  }

  // GitHub raw URLs
  if (url.hostname === "raw.githubusercontent.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, branch, ...rest] = parts;
    if (owner && repo && branch && rest.length > 0) {
      const path = rest.join("/");
      const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      return {
        provider: "github",
        normalizedUrl: normalized,
        kind: "single",
        owner,
        repo,
        ref: branch,
        path,
      };
    }
    return { provider: "github", normalizedUrl: null, kind: "unknown" };
  }

  // v1: treat everything else as unsupported
  return { provider: "unknown", normalizedUrl: null, kind: "unknown" };
}

/**
 * Compute an 11-char URL-safe base64 ID from normalizedUrl.
 * - Uses first 8 bytes (64 bits) of SHA-256 hash
 * - Encodes in base64, then makes it URL-safe and strips padding.
 */
export function alignIdFromNormalizedUrl(normalizedUrl: string): string {
  const hash = crypto.createHash("sha256").update(normalizedUrl).digest();
  const first8 = hash.subarray(0, 8);
  const b64 = first8.toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Convert a normalized GitHub blob URL back to a raw URL for fetching content.
 */
export function githubBlobToRawUrl(blobUrl: string): string | null {
  try {
    const url = new URL(blobUrl);
    if (url.hostname !== "github.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, maybeBlob, branch, ...rest] = parts;
    if (owner && repo && maybeBlob === "blob" && branch && rest.length > 0) {
      const path = rest.join("/");
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
    }
    return null;
  } catch {
    return null;
  }
}
