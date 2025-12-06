/**
 * Normalize path separators to forward slashes (POSIX style)
 * Handles Windows-style backslashes for cross-platform compatibility.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}
