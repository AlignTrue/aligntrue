import type { AlignRecord } from "./types";

export interface AlignStore {
  get(id: string): Promise<AlignRecord | null>;
  upsert(align: AlignRecord): Promise<void>;
  increment(
    id: string,
    field: "viewCount" | "installClickCount",
  ): Promise<void>;
  listRecent(limit: number): Promise<AlignRecord[]>;
  listPopular(limit: number): Promise<AlignRecord[]>;
}
