import { resolvePackFromGithub } from "@aligntrue/sources";
import type { CachedPackFile } from "./content-cache";
import type { AlignPackFile } from "./types";

export interface WebPackResult {
  manifestUrl: string;
  manifestId: string; // e.g., "org/repo" from manifest.id
  files: CachedPackFile[]; // with content for caching
  packFiles: AlignPackFile[]; // without content for storage
  totalBytes: number;
  author: string | null;
  title: string | null;
  description: string | null;
}

export async function fetchPackForWeb(
  sourceUrl: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<WebPackResult> {
  const resolved = await resolvePackFromGithub(sourceUrl, {
    fetchImpl: options?.fetchImpl,
  });

  const manifestUrl = `https://github.com/${resolved.repo.org}/${resolved.repo.repo}/blob/${resolved.ref}/${resolved.manifestPath}`;

  const files: CachedPackFile[] = resolved.files.map((file) => ({
    path: file.path,
    size: file.size,
    content: file.content,
  }));

  const packFiles: AlignPackFile[] = resolved.files.map(
    (file): AlignPackFile => ({
      path: file.path,
      size: file.size,
    }),
  );

  const totalBytes = resolved.files.reduce((sum, file) => sum + file.size, 0);

  return {
    manifestUrl,
    manifestId: resolved.manifest.id,
    files,
    packFiles,
    totalBytes,
    author: resolved.manifest.author ?? null,
    title: resolved.manifest.summary ?? null,
    description: resolved.manifest.description ?? null,
  };
}
