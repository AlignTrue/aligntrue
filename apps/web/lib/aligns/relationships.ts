import { Redis } from "@upstash/redis";
import { hasKvEnv } from "./storeFactory";

const PACK_MEMBERS_PREFIX = "rel:pack:";
const RULE_PACKS_PREFIX = "rel:rule:";

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}

// Local in-memory fallback for dev/test when KV is not configured.
const localSets = new Map<string, Set<string>>();

function getSet(key: string): Set<string> {
  let set = localSets.get(key);
  if (!set) {
    set = new Set<string>();
    localSets.set(key, set);
  }
  return set;
}

function packMembersKey(packId: string) {
  return `${PACK_MEMBERS_PREFIX}${packId}:members`;
}

function rulePacksKey(ruleId: string) {
  return `${RULE_PACKS_PREFIX}${ruleId}:packs`;
}

export async function addRuleToPack(
  ruleId: string,
  packId: string,
): Promise<void> {
  const packKey = packMembersKey(packId);
  const ruleKey = rulePacksKey(ruleId);

  if (!hasKvEnv()) {
    getSet(packKey).add(ruleId);
    getSet(ruleKey).add(packId);
    return;
  }

  const redis = getRedis();
  await Promise.all([redis.sadd(packKey, ruleId), redis.sadd(ruleKey, packId)]);
}

export async function removeRuleFromPack(
  ruleId: string,
  packId: string,
): Promise<void> {
  const packKey = packMembersKey(packId);
  const ruleKey = rulePacksKey(ruleId);

  if (!hasKvEnv()) {
    getSet(packKey).delete(ruleId);
    getSet(ruleKey).delete(packId);
    return;
  }

  const redis = getRedis();
  await Promise.all([redis.srem(packKey, ruleId), redis.srem(ruleKey, packId)]);
}

export async function getRulesForPack(packId: string): Promise<string[]> {
  const packKey = packMembersKey(packId);
  if (!hasKvEnv()) {
    return Array.from(getSet(packKey));
  }
  const redis = getRedis();
  const result = await redis.smembers<string[]>(packKey);
  return result ?? [];
}

export async function getPacksForRule(ruleId: string): Promise<string[]> {
  const ruleKey = rulePacksKey(ruleId);
  if (!hasKvEnv()) {
    return Array.from(getSet(ruleKey));
  }
  const redis = getRedis();
  const result = await redis.smembers<string[]>(ruleKey);
  return result ?? [];
}

export async function setPackMembers(
  packId: string,
  ruleIds: string[],
): Promise<void> {
  const packKey = packMembersKey(packId);
  const redis = getRedis();

  if (!hasKvEnv()) {
    const set = getSet(packKey);
    set.clear();
    ruleIds.forEach((id) => set.add(id));
  } else {
    await redis.del(packKey);
    if (ruleIds.length) {
      await redis.sadd(packKey, ruleIds[0], ...ruleIds.slice(1));
    }
  }
}

export async function setRuleMemberships(
  ruleId: string,
  packIds: string[],
): Promise<void> {
  const ruleKey = rulePacksKey(ruleId);
  const redis = getRedis();

  if (!hasKvEnv()) {
    const set = getSet(ruleKey);
    set.clear();
    packIds.forEach((id) => set.add(id));
  } else {
    await redis.del(ruleKey);
    if (packIds.length) {
      await redis.sadd(ruleKey, packIds[0], ...packIds.slice(1));
    }
  }
}
