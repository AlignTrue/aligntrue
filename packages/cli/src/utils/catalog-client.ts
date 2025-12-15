import { setTimeout as delay } from "timers/promises";

const CATALOG_API_BASE = "https://aligntrue.ai/api/aligns";
const DEFAULT_TIMEOUT_MS = 30_000;

export type CatalogKind = "pack" | "rule" | string;

export interface CatalogRecord {
  id: string;
  kind: CatalogKind;
  title?: string | null;
  description?: string | null;
  normalizedUrl?: string | null;
  containsAlignIds?: string[];
  sourceRemoved?: boolean;
}

function isValidCatalogRecord(data: unknown): data is CatalogRecord {
  return (
    typeof data === "object" &&
    data !== null &&
    typeof (data as CatalogRecord).id === "string" &&
    typeof (data as CatalogRecord).kind === "string"
  );
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAlignRecord(id: string): Promise<CatalogRecord> {
  const res = await fetchWithTimeout(`${CATALOG_API_BASE}/${id}`);

  if (res.status === 404) {
    throw new Error(
      `Align not found: ${id}. Check the ID or URL and try again.`,
    );
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("retry-after");
    const retryHint = retryAfter
      ? `Wait ${retryAfter} seconds and try again.`
      : "";
    throw new Error(`Rate limited by catalog. ${retryHint}`.trim());
  }
  if (!res.ok) {
    throw new Error(
      `Catalog request failed (${res.status}): ${await res.text()}`,
    );
  }

  const data = await res.json();
  if (!isValidCatalogRecord(data)) {
    throw new Error(`Invalid catalog response for ${id}`);
  }
  return data;
}

export async function fetchPackRuleRecords(
  packId: string,
  opts?: { delayMsPerRequest?: number },
): Promise<{ pack: CatalogRecord; rules: CatalogRecord[] }> {
  const pack = await fetchAlignRecord(packId);
  if (pack.kind !== "pack") {
    throw new Error(`Align ${packId} is not a pack`);
  }
  const ruleIds = pack.containsAlignIds ?? [];
  if (ruleIds.length === 0) {
    throw new Error(`Pack "${pack.title ?? pack.id}" contains no rules`);
  }

  const rules: CatalogRecord[] = [];
  for (const ruleId of ruleIds) {
    const rule = await fetchAlignRecord(ruleId);
    rules.push(rule);
    if (opts?.delayMsPerRequest) {
      await delay(opts.delayMsPerRequest);
    }
  }

  return { pack, rules };
}
