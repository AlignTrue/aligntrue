import { exitWithError } from "../../utils/error-formatter.js";

export function isPrivateSource(url: string): boolean {
  if (url.startsWith("git@")) return true;
  if (url.startsWith("ssh://")) return true;
  return false;
}

export function detectSourceType(url: string): "git" | "local" {
  if (url.startsWith("./") || url.startsWith("../") || url.startsWith("/")) {
    return "local";
  }
  if (
    url.startsWith("git@") ||
    url.startsWith("ssh://") ||
    url.endsWith(".git")
  ) {
    return "git";
  }

  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (
      hostname === "github.com" ||
      hostname.endsWith(".github.com") ||
      hostname === "gitlab.com" ||
      hostname.endsWith(".gitlab.com") ||
      hostname === "bitbucket.org" ||
      hostname.endsWith(".bitbucket.org")
    ) {
      return "git";
    }

    if (urlObj.protocol === "https:" || urlObj.protocol === "http:") {
      exitWithError(
        {
          title: "Unsupported URL format",
          message: `Plain HTTP/HTTPS URLs are not supported for remote rules.\n  URL: ${url}`,
          hint: "Use a git repository instead (GitHub, GitLab, Bitbucket, or self-hosted).\n  Example: https://github.com/org/rules",
          code: "UNSUPPORTED_URL",
        },
        2,
      );
    }
  } catch {
    return "local";
  }

  return "local";
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return trimmed;
  }
}
