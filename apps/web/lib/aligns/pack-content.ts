import type { AlignStore } from "./store";
import type { AlignRecord } from "./types";
import { filenameFromUrl } from "./urlUtils";
import { findSeedContent } from "./seedData";
import { isCatalogPack } from "./pack-helpers";
import {
  fetchRawWithCache,
  getCachedContent,
  setCachedContent,
  type CachedContent,
} from "./content-cache";

const MAX_BYTES = 256 * 1024;

export { isCatalogPack } from "./pack-helpers";

async function fetchCatalogPackContent(
  align: AlignRecord,
  store: AlignStore,
  options?: { maxBytes?: number; fetchImpl?: typeof fetch },
): Promise<CachedContent | null> {
  const ruleIds = align.containsAlignIds ?? [];
  const rules = await store.getMultiple(ruleIds);
  let hadError = false;
  const filesResult = await Promise.all(
    rules.filter(Boolean).map(async (rule) => {
      try {
        const raw = await fetchRawWithCache(
          rule!.id,
          rule!.normalizedUrl || rule!.url,
          options?.maxBytes ?? MAX_BYTES,
          { fetchImpl: options?.fetchImpl },
        );
        if (raw?.kind !== "single") return null;
        return {
          path: filenameFromUrl(rule!.normalizedUrl || rule!.url),
          size: new TextEncoder().encode(raw.content).length,
          content: raw.content,
        };
      } catch (err) {
        console.error("failed to fetch rule content", err);
        hadError = true;
        return null;
      }
    }),
  );

  const files = filesResult.filter(Boolean) as {
    path: string;
    size: number;
    content: string;
  }[];

  if (hadError) {
    return null;
  }

  const content = { kind: "pack" as const, files };
  try {
    await setCachedContent(align.id, content);
  } catch (error) {
    console.error("failed to cache align pack content", error);
  }
  return content;
}

export async function fetchPackContent(
  align: AlignRecord,
  store: AlignStore,
  options?: {
    maxBytes?: number;
    forceRefresh?: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<CachedContent | null> {
  // 1) Seed content (always wins)
  const seedContent = findSeedContent(align.id);
  if (seedContent) return seedContent;

  // 2) Align packs
  if (isCatalogPack(align)) {
    try {
      const content = await fetchCatalogPackContent(align, store, options);
      if (content) return content;
      throw new Error("failed to fetch align pack content");
    } catch (error) {
      console.error("failed to fetch align pack content", error);
      return await getCachedContent(align.id);
    }
  }

  // 3) Legacy packs: serve cached content if present
  if (align.kind === "pack") {
    return await getCachedContent(align.id);
  }

  // 4) Single rule/file
  return await fetchRawWithCache(
    align.id,
    align.normalizedUrl || align.url,
    options?.maxBytes ?? MAX_BYTES,
    {
      fetchImpl: options?.fetchImpl,
      forceRefresh: options?.forceRefresh,
    },
  );
}
