import { getAuthToken } from "./github-app";

export interface GistFile {
  filename: string;
  rawUrl: string;
  size: number;
}

export interface ResolveGistOptions {
  token?: string | null;
  fetchImpl?: typeof fetch;
}

function slugifyFilename(filename: string): string {
  return filename.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function selectPrimaryFile(
  files: GistFile[],
  requestedFilename?: string | null,
): GistFile | null {
  if (files.length === 0) return null;
  if (!requestedFilename) {
    return [...files].sort((a, b) => a.filename.localeCompare(b.filename))[0];
  }

  const requested = requestedFilename.toLowerCase();
  const requestedSlug = slugifyFilename(requestedFilename);

  const direct = files.find(
    (file) =>
      file.filename === requested ||
      file.filename.toLowerCase() === requested ||
      slugifyFilename(file.filename) === requestedSlug,
  );
  if (direct) return direct;

  return [...files].sort((a, b) => a.filename.localeCompare(b.filename))[0];
}

export async function resolveGistFiles(
  gistId: string,
  options?: ResolveGistOptions,
): Promise<GistFile[]> {
  const fetchImpl = options?.fetchImpl ?? fetch;
  const token =
    options?.token !== undefined
      ? options.token
      : await getAuthToken({ fetchImpl });

  const res = await fetchImpl(`https://api.github.com/gists/${gistId}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "User-Agent": "aligntrue-web",
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        "Gist not found. It may be private or deleted. Make sure the gist is public.",
      );
    }
    if (res.status === 403) {
      throw new Error(
        "GitHub rate limit exceeded. Try again in a few minutes.",
      );
    }
    const body = await res.text().catch(() => "");
    throw new Error(
      `Failed to load gist ${gistId}: ${res.status} ${res.statusText}${body ? ` - ${body}` : ""}`,
    );
  }

  const json = (await res.json()) as {
    files?: Record<
      string,
      {
        filename?: string;
        raw_url?: string;
        size?: number;
        truncated?: boolean;
      }
    >;
  };

  if (!json.files) return [];

  return Object.values(json.files)
    .filter((file): file is NonNullable<typeof file> =>
      Boolean(file?.filename && file?.raw_url),
    )
    .map((file) => ({
      filename: file.filename as string,
      rawUrl: file.raw_url as string,
      size: typeof file.size === "number" ? file.size : 0,
    }));
}
