export function getSubmittedUrlFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);

  // Preferred: ?url=<git-url>
  const explicit = params.get("url");
  if (explicit) return explicit;

  // Marketing mode: ?https://github.com/...
  const keys = Array.from(params.keys());
  if (keys.length === 1 && !params.get(keys[0])) {
    const candidate = keys[0];
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
      return candidate;
    }
  }

  return null;
}
