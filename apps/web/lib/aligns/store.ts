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
  markSourceRemoved(id: string, removedAt: string): Promise<void>;
  resetSourceRemoved(id: string): Promise<void>;
  search(options: {
    query?: string;
    kind?: "rule" | "pack";
    sortBy: "recent" | "popular";
    limit: number;
    offset: number;
  }): Promise<{ items: AlignRecord[]; total: number }>;
}
