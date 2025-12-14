import type { AlignRecord } from "./types";
import type { WebPackResult } from "./pack-fetcher";
import { alignIdFromNormalizedUrl } from "./normalize";
import { extractMetadata } from "./metadata";
import type { CachedPackFile } from "./content-cache";

type BuildPackRecordParams = {
  id: string;
  pack: WebPackResult;
  sourceUrl: string;
  existing?: AlignRecord | null;
  now: string;
  contentHash?: string;
  contentHashUpdatedAt?: string;
};

export function buildPackAlignRecord({
  id,
  pack,
  sourceUrl,
  existing,
  now,
  contentHash,
  contentHashUpdatedAt,
}: BuildPackRecordParams): AlignRecord {
  return {
    id,
    url: sourceUrl,
    normalizedUrl: pack.manifestUrl,
    provider: "github",
    kind: "pack",
    title: pack.title ?? pack.manifestUrl,
    description: pack.description ?? null,
    author: pack.author,
    fileType: "yaml",
    ...(contentHash ? { contentHash } : {}),
    ...(contentHashUpdatedAt ? { contentHashUpdatedAt } : {}),
    createdAt: existing?.createdAt ?? now,
    lastViewedAt: now,
    viewCount: existing?.viewCount ?? 0,
    installClickCount: existing?.installClickCount ?? 0,
    pack: {
      files: pack.packFiles,
      totalBytes: pack.totalBytes,
    },
  };
}

type BuildRuleFromPackFileParams = {
  packId: string;
  file: CachedPackFile;
  repo: { org: string; repo: string; ref: string };
  sourceUrl: string;
  now: string;
  existing?: AlignRecord | null;
};

export function buildRuleFromPackFile({
  packId,
  file,
  repo,
  sourceUrl,
  now,
  existing,
}: BuildRuleFromPackFileParams): AlignRecord {
  const normalizedUrl = `https://github.com/${repo.org}/${repo.repo}/blob/${repo.ref}/${file.path}`;
  const id = alignIdFromNormalizedUrl(normalizedUrl);
  const meta = extractMetadata(normalizedUrl, file.content);

  const nextMemberOf = new Set(existing?.memberOfPackIds ?? []);
  nextMemberOf.add(packId);

  return {
    id,
    url: sourceUrl,
    normalizedUrl,
    provider: "github",
    kind: meta.kind,
    title: meta.title,
    description: meta.description,
    author: meta.author ?? null,
    fileType: meta.fileType,
    contentHash: existing?.contentHash,
    contentHashUpdatedAt: existing?.contentHashUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    lastViewedAt: now,
    viewCount: existing?.viewCount ?? 0,
    installClickCount: existing?.installClickCount ?? 0,
    memberOfPackIds: Array.from(nextMemberOf),
  };
}

type BuildSingleRuleRecordParams = {
  id: string;
  sourceUrl: string;
  normalizedUrl: string;
  meta: ReturnType<typeof extractMetadata>;
  existing: AlignRecord | null;
  now: string;
  contentHash: string;
  contentHashUpdatedAt: string;
};

export function buildSingleRuleRecord({
  id,
  sourceUrl,
  normalizedUrl,
  meta,
  existing,
  now,
  contentHash,
  contentHashUpdatedAt,
}: BuildSingleRuleRecordParams): AlignRecord {
  return {
    id,
    url: sourceUrl,
    normalizedUrl,
    provider: "github",
    kind: meta.kind,
    title: meta.title,
    description: meta.description,
    author: meta.author ?? null,
    fileType: meta.fileType,
    contentHash,
    contentHashUpdatedAt,
    createdAt: existing?.createdAt ?? now,
    lastViewedAt: now,
    viewCount: existing?.viewCount ?? 0,
    installClickCount: existing?.installClickCount ?? 0,
  };
}
