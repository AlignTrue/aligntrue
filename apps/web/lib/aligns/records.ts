import type { AlignRecord } from "./types";
import { extractMetadata } from "./metadata";

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
    source: "github",
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

type BuildCatalogPackRecordParams = {
  id: string;
  title: string;
  description: string;
  author?: string | null;
  ruleIds: string[];
  now: string;
  existing?: AlignRecord | null;
};

export function buildCatalogPackRecord({
  id,
  title,
  description,
  author,
  ruleIds,
  now,
  existing,
}: BuildCatalogPackRecordParams): AlignRecord {
  const normalizedUrl = `https://aligntrue.ai/a/${id}`;
  return {
    id,
    url: normalizedUrl,
    normalizedUrl,
    provider: "unknown",
    source: "catalog",
    kind: "pack",
    title,
    description,
    author: author ?? null,
    fileType: "unknown",
    createdAt: existing?.createdAt ?? now,
    lastViewedAt: now,
    viewCount: existing?.viewCount ?? 0,
    installClickCount: existing?.installClickCount ?? 0,
    pack: { files: [], totalBytes: 0 },
    containsAlignIds: ruleIds,
  };
}
