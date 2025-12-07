import { kv } from "@vercel/kv";
import type { AlignStore } from "./store";
import type { AlignRecord } from "./types";

const ALIGN_KEY_PREFIX = "v1:align:";
const CREATED_ZSET = "v1:align:by-created";
const INSTALLS_ZSET = "v1:align:by-installs";

function alignKey(id: string) {
  return `${ALIGN_KEY_PREFIX}${id}`;
}

export class KvAlignStore implements AlignStore {
  async get(id: string): Promise<AlignRecord | null> {
    return (await kv.get<AlignRecord>(alignKey(id))) ?? null;
  }

  async upsert(align: AlignRecord): Promise<void> {
    await kv.set(alignKey(align.id), align);
    await kv.zadd(CREATED_ZSET, {
      score: new Date(align.createdAt).getTime(),
      member: align.id,
    });
    await kv.zadd(INSTALLS_ZSET, {
      score: align.installClickCount,
      member: align.id,
    });
  }

  async increment(
    id: string,
    field: "viewCount" | "installClickCount",
  ): Promise<void> {
    const key = alignKey(id);
    const existing = await kv.get<AlignRecord>(key);
    if (!existing) return;

    if (field === "viewCount") {
      const updated: AlignRecord = {
        ...existing,
        viewCount: (existing.viewCount ?? 0) + 1,
        lastViewedAt: new Date().toISOString(),
      };
      await kv.set(key, updated);
      return;
    }

    const updated: AlignRecord = {
      ...existing,
      installClickCount: (existing.installClickCount ?? 0) + 1,
    };
    await kv.set(key, updated);
    await kv.zincrby(INSTALLS_ZSET, 1, id);
  }

  async listRecent(limit: number): Promise<AlignRecord[]> {
    const ids = await kv.zrange<string>(CREATED_ZSET, 0, limit - 1, {
      rev: true,
    });
    if (!ids.length) return [];
    const records = await kv.mget<AlignRecord>(ids.map((id) => alignKey(id)));
    return records.filter(Boolean) as AlignRecord[];
  }

  async listPopular(limit: number): Promise<AlignRecord[]> {
    const ids = await kv.zrange<string>(INSTALLS_ZSET, 0, limit - 1, {
      rev: true,
    });
    if (!ids.length) return [];
    const records = await kv.mget<AlignRecord>(ids.map((id) => alignKey(id)));
    return records.filter(Boolean) as AlignRecord[];
  }
}
