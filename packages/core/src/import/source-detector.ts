/**
 * Source type detection and URL parsing
 * Determines whether a source is git, URL, or local path
 */

export type SourceType = "git" | "url" | "local";

/**
 * Parsed source URL with extracted components
 */
export interface ParsedSource {
  type: SourceType;
  url: string;
  ref?: string | undefined; // Git ref (branch/tag/commit)
  path?: string | undefined; // Path within repo or URL
  isDirectory: boolean; // Whether source points to a directory
}

/**
 * Detect source type from a URL or path string
 */
export function detectSourceType(source: string): SourceType {
  // Git SSH URLs
  if (source.startsWith("git@")) {
    return "git";
  }

  // SSH URLs
  if (source.startsWith("ssh://")) {
    return "git";
  }

  // Explicit .git suffix
  if (source.endsWith(".git")) {
    return "git";
  }

  // Check for known git hosting URLs
  try {
    const urlObj = new URL(source);
    const hostname = urlObj.hostname;

    // Known git hosts
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

    // HTTP/HTTPS URLs that aren't git hosts
    if (urlObj.protocol === "https:" || urlObj.protocol === "http:") {
      return "url";
    }
  } catch {
    // Not a valid URL, treat as local path
  }

  // Default to local path
  return "local";
}

/**
 * Parse a source URL/path into components
 *
 * Supports formats:
 * - https://github.com/org/repo
 * - https://github.com/org/repo@v1.0.0
 * - https://github.com/org/repo/path/to/rules
 * - https://github.com/org/repo@v1.0.0/path/to/rules
 * - https://github.com/org/repo/path/to/file.md
 * - git@github.com:org/repo.git
 * - /absolute/local/path
 * - ./relative/local/path
 * - https://example.com/rules.yaml
 */
export function parseSourceUrl(source: string): ParsedSource {
  const type = detectSourceType(source);

  if (type === "local") {
    return parseLocalPath(source);
  }

  if (type === "git") {
    return parseGitUrl(source);
  }

  // URL type
  return parseHttpUrl(source);
}

/**
 * Parse a local file/directory path
 */
function parseLocalPath(source: string): ParsedSource {
  // Check if it looks like a file (has extension) or directory
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(source);

  return {
    type: "local",
    url: source,
    isDirectory: !hasExtension,
  };
}

/**
 * Parse a git URL with optional ref and path
 *
 * Formats:
 * - https://github.com/org/repo
 * - https://github.com/org/repo@ref
 * - https://github.com/org/repo/path
 * - https://github.com/org/repo@ref/path
 * - git@github.com:org/repo.git
 */
function parseGitUrl(source: string): ParsedSource {
  let url = source;
  let ref: string | undefined;
  let path: string | undefined;

  // Handle SSH URLs (git@github.com:org/repo.git)
  if (source.startsWith("git@")) {
    return {
      type: "git",
      url: source,
      isDirectory: true, // SSH URLs point to repo root
    };
  }

  // Handle HTTPS URLs with optional @ref and /path
  try {
    const urlObj = new URL(source);
    const pathname = urlObj.pathname;

    // Extract org/repo from pathname
    // pathname: /org/repo or /org/repo@ref or /org/repo/path or /org/repo@ref/path
    const pathParts = pathname.split("/").filter(Boolean);

    if (pathParts.length < 2) {
      // Not enough path parts for org/repo
      return {
        type: "git",
        url: source,
        isDirectory: true,
      };
    }

    // First two parts are org/repo (possibly with @ref)
    let orgRepo = `${pathParts[0]}/${pathParts[1]}`;
    const remainingPath = pathParts.slice(2).join("/");

    // Check for @ref in repo part
    if (orgRepo.includes("@")) {
      const [orgRepoClean, refPart] = orgRepo.split("@");
      orgRepo = orgRepoClean!;
      ref = refPart;
    }

    // Check for @ref in remaining path (e.g., /org/repo@v1/path)
    // This shouldn't happen with proper URL format, but handle it
    if (!ref && remainingPath.includes("@")) {
      const atIndex = remainingPath.indexOf("@");
      const beforeAt = remainingPath.substring(0, atIndex);
      const afterAt = remainingPath.substring(atIndex + 1);
      const slashIndex = afterAt.indexOf("/");

      if (slashIndex === -1) {
        ref = afterAt;
        path = beforeAt || undefined;
      } else {
        ref = afterAt.substring(0, slashIndex);
        path = beforeAt
          ? `${beforeAt}/${afterAt.substring(slashIndex + 1)}`
          : afterAt.substring(slashIndex + 1);
      }
    } else if (remainingPath) {
      path = remainingPath;
    }

    // Reconstruct clean URL without ref and path
    url = `${urlObj.protocol}//${urlObj.host}/${orgRepo}`;

    // Determine if it's a directory or file
    const isDirectory = !path || !path.includes(".");

    return {
      type: "git",
      url,
      ref,
      path,
      isDirectory,
    };
  } catch {
    // Invalid URL, return as-is
    return {
      type: "git",
      url: source,
      isDirectory: true,
    };
  }
}

/**
 * Parse an HTTP/HTTPS URL
 */
function parseHttpUrl(source: string): ParsedSource {
  try {
    const urlObj = new URL(source);
    const pathname = urlObj.pathname;

    // Check if it looks like a file (has extension) or directory
    const hasExtension = /\.[a-zA-Z0-9]+$/.test(pathname);

    return {
      type: "url",
      url: source,
      isDirectory: !hasExtension,
    };
  } catch {
    return {
      type: "url",
      url: source,
      isDirectory: true,
    };
  }
}
