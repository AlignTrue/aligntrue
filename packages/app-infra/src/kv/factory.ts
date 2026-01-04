import { Redis } from "@upstash/redis";

export function hasKvEnv(): boolean {
  const hasUpstash =
    process.env["UPSTASH_REDIS_REST_URL"] &&
    process.env["UPSTASH_REDIS_REST_TOKEN"];
  const hasVercelKv =
    process.env["KV_REST_API_URL"] && process.env["KV_REST_API_TOKEN"];
  return Boolean(hasUpstash || hasVercelKv);
}

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = Redis.fromEnv();
  }
  return redisClient;
}
