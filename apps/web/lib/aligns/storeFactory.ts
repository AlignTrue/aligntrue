import { KvAlignStore } from "./kvStore";
import { MockAlignStore } from "./mockStore";
import type { AlignStore } from "./store";

export function hasKvEnv(): boolean {
  const hasUpstash =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasVercelKv =
    process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
  return Boolean(hasUpstash || hasVercelKv);
}

let singleton: AlignStore | null = null;

export function getAlignStore(): AlignStore {
  if (singleton) return singleton;
  if (hasKvEnv()) {
    singleton = new KvAlignStore();
    return singleton;
  }
  console.warn(
    "[aligns] Using in-memory mock store (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or KV_REST_API_URL/KV_REST_API_TOKEN not set). Data will reset on restart.",
  );
  singleton = new MockAlignStore();
  return singleton;
}
