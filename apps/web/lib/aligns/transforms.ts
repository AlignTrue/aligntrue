import type { AlignRecord } from "./types";
import { filenameFromUrl, parseGitHubUrl } from "./urlUtils";

export type AlignSummary = {
  id: string;
  title: string | null;
  description: string | null;
  provider: string;
  normalizedUrl: string;
  kind: string;
  url: string;
  pack?: { files: { path: string; size: number }[]; totalBytes: number };
  source?: string;
  author?: string | null;
  // Precomputed display fields for UI
  displayAuthor: string | null;
  displayAuthorUrl: string | null;
  displayFilename: string;
  externalUrl: string | null;
};

export function toAlignSummary(record: AlignRecord): AlignSummary {
  const isCatalogPack = record.source === "catalog" && record.kind === "pack";

  let displayAuthor: string | null;
  let displayAuthorUrl: string | null;
  let displayFilename: string;
  let externalUrl: string | null;

  if (isCatalogPack) {
    if (record.author) {
      displayAuthor = record.author;
      displayAuthorUrl = null;
    } else {
      displayAuthor = null;
      displayAuthorUrl = null;
    }
    displayFilename = "Align Pack";
    externalUrl = null;
  } else {
    const { owner, ownerUrl } = parseGitHubUrl(record.normalizedUrl);
    displayAuthor = owner;
    displayAuthorUrl = ownerUrl;
    displayFilename = filenameFromUrl(record.normalizedUrl || record.url);
    externalUrl = record.normalizedUrl || record.url;
  }

  return {
    id: record.id,
    title: record.title,
    description: record.description,
    provider: record.provider,
    normalizedUrl: record.normalizedUrl,
    kind: record.kind,
    url: record.url,
    pack: record.pack,
    source: record.source,
    author: record.author,
    displayAuthor,
    displayAuthorUrl,
    displayFilename,
    externalUrl,
  };
}
