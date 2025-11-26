/**
 * URL parser for include syntax
 * Parses URLs like: https://github.com/org/repo[@ref][/path]
 */

export interface ParsedSourceURL {
  host: string; // github.com, gitlab.com, etc.
  org: string; // organization
  repo: string; // repository name
  ref?: string; // branch, tag, or commit (optional)
  path?: string; // file or directory path within repo (optional)
  isFile: boolean; // true if path has .md extension or has no extension but looks like file
}

/**
 * Parse a git source URL into components
 * Format: https://github.com/org/repo[@ref][/path]
 *
 * Examples:
 *   https://github.com/company/rules
 *   https://github.com/company/rules@v2.0.0
 *   https://github.com/company/rules/packs
 *   https://github.com/company/rules/packs/security.md
 *   https://github.com/company/rules@v2.0.0/packs/security.md
 */
export function parseSourceURL(url: string): ParsedSourceURL {
  // Return type explicitly set to avoid type inference issues
  // Validate basic structure
  if (!url || typeof url !== "string") {
    throw new Error("Source URL must be a non-empty string");
  }

  // Remove protocol if present
  let workingUrl = url.trim();
  const protocolMatch = workingUrl.match(/^(https?|git):\/\//);
  if (!protocolMatch) {
    throw new Error(
      `Invalid source URL format: ${url}\n` +
        `Expected format: https://github.com/{org}/{repo}[@{ref}][/{path}]\n` +
        `Examples:\n` +
        `  - https://github.com/company/rules\n` +
        `  - https://github.com/company/rules@v2.0.0\n` +
        `  - https://github.com/company/rules/packs/security.md`,
    );
  }

  workingUrl = workingUrl.slice(protocolMatch[0].length);

  // Extract host (github.com, gitlab.com, etc.)
  const hostMatch = workingUrl.match(/^([^\/]+)\//);
  if (!hostMatch) {
    throw new Error(`Invalid source URL: could not extract host from ${url}`);
  }

  const host = hostMatch[1];
  workingUrl = workingUrl.slice(hostMatch[0].length);

  // Split path into components: [org, repo, ...pathParts]
  const parts = workingUrl.split("/").filter((p) => p);

  if (parts.length < 2) {
    throw new Error(`Invalid source URL: expected {org}/{repo} in ${url}`);
  }

  const org = parts[0];
  const repoAndRef = parts[1];

  if (!repoAndRef) {
    throw new Error(`Invalid source URL: could not extract repo from ${url}`);
  }

  // Extract ref from repo if present (repo@ref format)
  let repo = repoAndRef;
  let ref: string | undefined;

  const refMatch = repoAndRef.match(/^([^@]+)@(.+)$/);
  if (refMatch && refMatch[1] && refMatch[2]) {
    repo = refMatch[1];
    ref = refMatch[2];
  }

  // Remove .git suffix if present
  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  if (!repo) {
    throw new Error(`Invalid source URL: repo name is empty in ${url}`);
  }

  // Rest is path
  const pathParts = parts.slice(2);
  let path: string | undefined;
  if (pathParts.length > 0) {
    path = pathParts.join("/");
  }

  // Check if path looks like a file
  let isFile = false;
  if (path) {
    // Path is a file if it has .md extension
    isFile = path.endsWith(".md") || path.endsWith(".markdown");
  }

  return {
    host,
    org,
    repo,
    ref: ref || undefined,
    path: path || undefined,
    isFile,
  } as ParsedSourceURL;
}

/**
 * Generate a git clone URL from parsed components
 */
export function generateGitCloneURL(parsed: ParsedSourceURL): string {
  return `https://${parsed.host}/${parsed.org}/${parsed.repo}.git`;
}

/**
 * Generate a file URL for a specific path
 */
export function generateFileURL(
  parsed: ParsedSourceURL,
  filePath: string,
): string {
  return `https://${parsed.host}/${parsed.org}/${parsed.repo}/-/raw/${parsed.ref || "main"}/${filePath}`;
}

/**
 * Validate that parsed URL has minimum required fields
 */
export function validateParsedURL(parsed: ParsedSourceURL): void {
  if (!parsed.host || !parsed.org || !parsed.repo) {
    throw new Error(
      "Invalid parsed URL: missing required fields (host, org, repo)",
    );
  }
}
