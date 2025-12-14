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
    schemaVersion: 1,
    id,
    url: sourceUrl,
    normalizedUrl: pack.manifestUrl,
    provider: "github",
    kind: "pack",
    title: pack.info.manifestSummary ?? pack.info.manifestId,
    description: pack.info.manifestDescription ?? null,
    fileType: "yaml",
    ...(contentHash ? { contentHash } : {}),
    ...(contentHashUpdatedAt ? { contentHashUpdatedAt } : {}),
    createdAt: existing?.createdAt ?? now,
    lastViewedAt: now,
    viewCount: existing?.viewCount ?? 0,
    installClickCount: existing?.installClickCount ?? 0,
    pack: pack.info,
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
    schemaVersion: 1,
    id,
    url: sourceUrl,
    normalizedUrl,
    provider: "github",
    kind: meta.kind,
    title: meta.title,
    description: meta.description,
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
