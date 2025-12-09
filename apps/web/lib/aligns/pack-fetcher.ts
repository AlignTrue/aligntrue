import { resolvePackFromGithub } from "@aligntrue/sources";
import type { CachedPackFile } from "./content-cache";
import type { AlignPackFile, AlignPackInfo } from "./types";

export interface WebPackResult {
  manifestUrl: string;
  info: AlignPackInfo;
  files: CachedPackFile[];
}

export async function fetchPackForWeb(
  sourceUrl: string,
): Promise<WebPackResult> {
  const resolved = await resolvePackFromGithub(sourceUrl);

  const manifestUrl = `https://github.com/${resolved.repo.org}/${resolved.repo.repo}/blob/${resolved.ref}/${resolved.manifestPath}`;

  const files: CachedPackFile[] = resolved.files.map((file) => ({
    path: file.path,
    size: file.size,
    content: file.content,
  }));

  const info: AlignPackInfo = {
    manifestPath: resolved.manifestPath,
    manifestId: resolved.manifest.id,
    manifestVersion: resolved.manifest.version,
    manifestSummary: resolved.manifest.summary ?? null,
    manifestAuthor: resolved.manifest.author ?? null,
    ref: resolved.ref,
    files: resolved.files.map(
      (file): AlignPackFile => ({
        path: file.path,
        size: file.size,
      }),
    ),
    totalBytes: resolved.files.reduce((sum, file) => sum + file.size, 0),
  };

  return { manifestUrl, info, files };
}
