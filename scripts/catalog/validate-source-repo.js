/**
 * Source repository URL validation for catalog (Phase 4)
 *
 * Validates source_repo URLs for "Source Linked" badge.
 * Checks URL format and optionally verifies repo existence.
 */
/**
 * Supported source hosting platforms
 */
export const SUPPORTED_PLATFORMS = {
  github: /^https:\/\/github\.com\/[\w-]+\/[\w.-]+\/?$/,
  gitlab: /^https:\/\/gitlab\.com\/[\w-]+\/[\w.-]+\/?$/,
};
/**
 * Validate source repository URL format
 *
 * Checks:
 * - URL starts with https://
 * - Matches known platform patterns (GitHub, GitLab)
 * - Has org/user and repo name
 *
 * @param url - Source repository URL
 * @returns Validation result
 */
export function validateSourceRepoUrl(url) {
  if (!url) {
    return {
      valid: false,
      error: "Source repo URL is empty",
    };
  }
  // Must be HTTPS
  if (!url.startsWith("https://")) {
    return {
      valid: false,
      error: "Source repo URL must use HTTPS",
    };
  }
  // Check GitHub pattern
  if (SUPPORTED_PLATFORMS.github.test(url)) {
    return {
      valid: true,
      platform: "github",
    };
  }
  // Check GitLab pattern
  if (SUPPORTED_PLATFORMS.gitlab.test(url)) {
    return {
      valid: true,
      platform: "gitlab",
    };
  }
  // Unknown platform or invalid format
  return {
    valid: false,
    error: `Source repo URL must be a valid GitHub or GitLab repository URL (got: ${url})`,
  };
}
/**
 * Verify source repository exists (optional HEAD request)
 *
 * Makes HEAD request to repo URL. Fails gracefully if offline.
 * Only used during build if --verify-repos flag passed.
 *
 * @param url - Source repository URL
 * @param timeoutMs - Request timeout in milliseconds
 * @returns True if repo exists or check fails (graceful)
 */
export async function verifySourceRepoExists(url, timeoutMs = 5000) {
  try {
    // Remove trailing slash for HEAD request
    const cleanUrl = url.endsWith("/") ? url.slice(0, -1) : url;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(cleanUrl, {
      method: "HEAD",
      signal: controller.signal,
      // Don't follow redirects
      redirect: "manual",
    });
    clearTimeout(timeout);
    // 200 OK or 301/302 redirect means repo exists
    return (
      response.status === 200 ||
      response.status === 301 ||
      response.status === 302
    );
  } catch (err) {
    // Network error, timeout, or offline - fail gracefully
    // This is optional verification, not a hard requirement
    console.warn(
      `Could not verify source repo ${url} (network error, continuing)`,
    );
    return true; // Allow build to continue
  }
}
/**
 * Determine if pack should show "Source Linked" badge
 *
 * @param sourceRepo - Source repo URL (optional)
 * @returns True if badge should be shown
 */
export function shouldShowSourceLinkedBadge(sourceRepo) {
  if (!sourceRepo) {
    return false;
  }
  const validation = validateSourceRepoUrl(sourceRepo);
  return validation.valid;
}
