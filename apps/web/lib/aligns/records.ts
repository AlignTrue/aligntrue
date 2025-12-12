import type { AlignRecord } from "./types";
import type { WebPackResult } from "./pack-fetcher";

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
