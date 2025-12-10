import { Redis } from "@upstash/redis";
import type { AlignStore } from "./store";
import type { AlignRecord } from "./types";

const ALIGN_KEY_PREFIX = "v1:align:";
const CREATED_ZSET = "v1:align:by-created";
const INSTALLS_ZSET = "v1:align:by-installs";

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

function alignKey(id: string) {
  return `${ALIGN_KEY_PREFIX}${id}`;
}

export class KvAlignStore implements AlignStore {
  async get(id: string): Promise<AlignRecord | null> {
    return (await getRedis().get<AlignRecord>(alignKey(id))) ?? null;
  }

  async upsert(align: AlignRecord): Promise<void> {
    const key = alignKey(align.id);
    const [existing, zsetScore] = await Promise.all([
      getRedis().get<AlignRecord>(key),
      getRedis().zscore(INSTALLS_ZSET, align.id),
    ]);

    const mergedInstallCount = Math.max(
      align.installClickCount ?? 0,
      existing?.installClickCount ?? 0,
      zsetScore ?? 0,
    );

    const merged: AlignRecord = {
      ...align,
      createdAt: existing?.createdAt ?? align.createdAt,
      viewCount: existing?.viewCount ?? align.viewCount,
      installClickCount: mergedInstallCount,
    };

    await getRedis().set(key, merged);
    await getRedis().zadd(CREATED_ZSET, {
      score: new Date(merged.createdAt).getTime(),
      member: align.id,
    });

    if (!existing) {
      await getRedis().zadd(INSTALLS_ZSET, {
        score: mergedInstallCount,
        member: align.id,
      });
      return;
    }

    const currentInstallScore =
      zsetScore ?? existing.installClickCount ?? mergedInstallCount;
    if (mergedInstallCount > currentInstallScore) {
      await getRedis().zincrby(
        INSTALLS_ZSET,
        mergedInstallCount - currentInstallScore,
        align.id,
      );
    }
  }

  async increment(
    id: string,
    field: "viewCount" | "installClickCount",
  ): Promise<void> {
    const key = alignKey(id);
    const existing = await getRedis().get<AlignRecord>(key);
    if (!existing) return;

    if (field === "viewCount") {
      const updated: AlignRecord = {
        ...existing,
        viewCount: (existing.viewCount ?? 0) + 1,
        lastViewedAt: new Date().toISOString(),
      };
      await getRedis().set(key, updated);
      return;
    }

    const updated: AlignRecord = {
      ...existing,
      installClickCount: (existing.installClickCount ?? 0) + 1,
    };
    await getRedis().set(key, updated);
    await getRedis().zincrby(INSTALLS_ZSET, 1, id);
  }

  async listRecent(limit: number): Promise<AlignRecord[]> {
    const ids = (await getRedis().zrange(CREATED_ZSET, 0, limit - 1, {
      rev: true,
    })) as string[];
    if (!ids.length) return [];
    const records = (await getRedis().mget(
      ids.map((id) => alignKey(id)),
    )) as AlignRecord[];
    return records.filter(Boolean) as AlignRecord[];
  }

  async listPopular(limit: number): Promise<AlignRecord[]> {
    const ids = (await getRedis().zrange(INSTALLS_ZSET, 0, limit - 1, {
      rev: true,
    })) as string[];
    if (!ids.length) return [];
    const records = (await getRedis().mget(
      ids.map((id) => alignKey(id)),
    )) as AlignRecord[];
    return records.filter(Boolean) as AlignRecord[];
  }
}
