import { KvAlignStore } from "./kvStore";
import { MockAlignStore } from "./mockStore";
import type { AlignStore } from "./store";

function hasKvEnv(): boolean {
  return Boolean(process.env.KV_REST_API_URL);
}

let singleton: AlignStore | null = null;

export function getAlignStore(): AlignStore {
  if (singleton) return singleton;
  if (hasKvEnv()) {
    singleton = new KvAlignStore();
    return singleton;
  }
  console.warn(
    "[aligns] Using in-memory mock store (KV_REST_API_URL not set). Data will reset on restart.",
  );
  singleton = new MockAlignStore();
  return singleton;
}
