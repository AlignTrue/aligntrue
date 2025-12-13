import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";
import type { AlignStore } from "./store";
import type { AlignRecord } from "./types";
import { ensureOgImage } from "../og/service";

const ALIGN_KEY_PREFIX = "v1:align:";
const CREATED_ZSET = "v1:align:by-created";
const INSTALLS_ZSET = "v1:align:by-installs";
const KIND_RULE_SET = "idx:kind:rule";
const KIND_PACK_SET = "idx:kind:pack";

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

async function generateOgIfPossible(record: AlignRecord) {
  try {
    await ensureOgImage(record);
  } catch (error) {
    console.error("og generation failed", error);
  }
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
      sourceRemoved: align.sourceRemoved ?? existing?.sourceRemoved ?? false,
      sourceRemovedAt: align.sourceRemovedAt ?? existing?.sourceRemovedAt,
      fetchFailCount: align.fetchFailCount ?? existing?.fetchFailCount ?? 0,
    };

    await Promise.all([
      getRedis().set(key, merged),
      getRedis().zadd(CREATED_ZSET, {
        score: new Date(merged.createdAt).getTime(),
        member: align.id,
      }),
      this.addKindIndex(align.id, align.kind),
    ]);

    if (!existing) {
      await getRedis().zadd(INSTALLS_ZSET, {
        score: mergedInstallCount,
        member: align.id,
      });
      await generateOgIfPossible(merged);
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
    await generateOgIfPossible(merged);
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

  private async addKindIndex(id: string, kind: AlignRecord["kind"]) {
    if (kind === "rule") {
      await getRedis().sadd(KIND_RULE_SET, id);
      return;
    }
    if (kind === "pack") {
      await getRedis().sadd(KIND_PACK_SET, id);
    }
  }

  async search(options: {
    query?: string;
    kind?: "rule" | "pack";
    sortBy: "recent" | "popular";
    limit: number;
    offset: number;
  }): Promise<{ items: AlignRecord[]; total: number }> {
    const { query, kind, sortBy, limit, offset } = options;
    const sortKey = sortBy === "popular" ? INSTALLS_ZSET : CREATED_ZSET;
    const redis = getRedis();

    const hasTextQuery = Boolean(query && query.trim().length > 0);
    const kindSet =
      kind === "rule" ? KIND_RULE_SET : kind === "pack" ? KIND_PACK_SET : null;

    let workingKey = sortKey;
    let tempKeys: string[] = [];

    if (kindSet) {
      const tempSorted = `tmp:${randomUUID()}:sorted`;
      tempKeys.push(tempSorted);
      // Intersect sorted set with kind set, preserving scores from sortKey (weight 1 for sortKey, 0 for set)
      await redis.zinterstore(tempSorted, 2, [sortKey, kindSet], {
        weights: [1, 0],
      });
      workingKey = tempSorted;
    }

    try {
      if (hasTextQuery) {
        // For text queries, fetch all matching IDs then filter in memory (counts are small).
        const ids = (await redis.zrange(workingKey, 0, -1, {
          rev: true,
        })) as string[];
        if (!ids.length) return { items: [], total: 0 };
        const records = (await redis.mget(
          ids.map((id) => alignKey(id)),
        )) as AlignRecord[];
        const filtered = (records.filter(Boolean) as AlignRecord[]).filter(
          (record) =>
            (record.title ?? "")
              .toLowerCase()
              .concat(" ", (record.description ?? "").toLowerCase())
              .includes(query!.toLowerCase()),
        );
        const total = filtered.length;
        const paged = filtered.slice(offset, offset + limit);
        return { items: paged, total };
      }

      const [ids, total] = await Promise.all([
        redis.zrange(workingKey, offset, offset + limit - 1, {
          rev: true,
        }) as Promise<string[]>,
        redis.zcard(workingKey),
      ]);
      if (!ids.length) return { items: [], total: Number(total) };
      const records = (await redis.mget(
        ids.map((id) => alignKey(id)),
      )) as AlignRecord[];
      return {
        items: records.filter(Boolean) as AlignRecord[],
        total: Number(total),
      };
    } finally {
      if (tempKeys.length) {
        await Promise.all(tempKeys.map((key) => redis.del(key)));
      }
    }
  }

  async markSourceRemoved(id: string, removedAt: string): Promise<void> {
    const key = alignKey(id);
    const existing = await getRedis().get<AlignRecord>(key);
    if (!existing) return;
    const nextFailCount = (existing.fetchFailCount ?? 0) + 1;
    const updated: AlignRecord = {
      ...existing,
      sourceRemoved: true,
      sourceRemovedAt: removedAt,
      fetchFailCount: nextFailCount,
    };
    await getRedis().set(key, updated);
  }

  async resetSourceRemoved(id: string): Promise<void> {
    const key = alignKey(id);
    const existing = await getRedis().get<AlignRecord>(key);
    if (!existing) return;
    if (!existing.sourceRemoved && (existing.fetchFailCount ?? 0) === 0) return;
    const updated: AlignRecord = {
      ...existing,
      sourceRemoved: false,
      sourceRemovedAt: undefined,
      fetchFailCount: 0,
    };
    await getRedis().set(key, updated);
  }
}
