import crypto from "node:crypto";

export type NormalizedGitSource = {
  provider: "github" | "unknown";
  normalizedUrl: string | null; // canonical blob URL for GitHub
};

/**
 * v1: only GitHub is fully supported.
 * - Accepts github.com blob URLs and raw.githubusercontent.com URLs.
 * - Normalizes to: https://github.com/{owner}/{repo}/blob/{branch}/{path}
 */
export function normalizeGitUrl(input: string): NormalizedGitSource {
  const trimmed = input.trim();

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { provider: "unknown", normalizedUrl: null };
  }

  // GitHub blob URLs
  if (url.hostname === "github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, maybeBlob, branch, ...rest] = parts;
    if (owner && repo && maybeBlob === "blob" && branch && rest.length > 0) {
      const path = rest.join("/");
      const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      return { provider: "github", normalizedUrl: normalized };
    }
    return { provider: "github", normalizedUrl: null };
  }

  // GitHub raw URLs
  if (url.hostname === "raw.githubusercontent.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const [owner, repo, branch, ...rest] = parts;
    if (owner && repo && branch && rest.length > 0) {
      const path = rest.join("/");
      const normalized = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;
      return { provider: "github", normalizedUrl: normalized };
    }
    return { provider: "github", normalizedUrl: null };
  }

  // v1: treat everything else as unsupported
  return { provider: "unknown", normalizedUrl: null };
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
