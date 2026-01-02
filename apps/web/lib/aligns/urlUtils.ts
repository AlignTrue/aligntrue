export type ParsedGitHubUrl = {
  owner: string;
  repo: string;
  ownerUrl: string | null;
};

function safeParse(url?: string | null): URL | null {
  if (!url) return null;
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function parseGitHubUrl(url?: string | null): ParsedGitHubUrl {
  const parsed = safeParse(url);
  if (!parsed) {
    return { owner: "Unknown", repo: "unknown", ownerUrl: null };
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const ownerSegment = parts[0];
  const repoSegment = parts[1];

  const owner = ownerSegment ? `@${ownerSegment}` : "Unknown";
  const repo = repoSegment ?? "unknown";
  const ownerUrl = ownerSegment ? `${parsed.origin}/${ownerSegment}` : null;

  return { owner, repo, ownerUrl };
}

export function filenameFromUrl(url?: string | null): string {
  if (!url) return "rules.md";
  const parsed = safeParse(url);
  if (parsed) {
    const parts = parsed.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last;
  }

  const fallbackParts = url.split("/").filter(Boolean);
  return fallbackParts[fallbackParts.length - 1] || "rules.md";
}
