import { KvAlignStore } from "./kvStore";
import { MockAlignStore } from "./mockStore";
import type { AlignStore } from "./store";

export function hasKvEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

let singleton: AlignStore | null = null;

export function getAlignStore(): AlignStore {
  if (singleton) return singleton;
  if (hasKvEnv()) {
    singleton = new KvAlignStore();
    return singleton;
  }
  console.warn(
    "[aligns] Using in-memory mock store (UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set). Data will reset on restart.",
  );
  singleton = new MockAlignStore();
  return singleton;
}
