import type { AlignRecord } from "./types";
import type { AlignStore } from "./store";
import { generateSeedRecords, findSeedContent } from "./seedData";
import { setCachedContent } from "./content-cache";

export class MockAlignStore implements AlignStore {
  private records = new Map<string, AlignRecord>();

  constructor(seed = true) {
    if (seed) {
      for (const record of generateSeedRecords()) {
        this.records.set(record.id, record);
        const content = findSeedContent(record.id);
        if (content) {
          void setCachedContent(record.id, content);
        }
      }
    }
  }

  async get(id: string): Promise<AlignRecord | null> {
    return this.records.get(id) ?? null;
  }

  async upsert(align: AlignRecord): Promise<void> {
    this.records.set(align.id, align);
  }

  async increment(
    id: string,
    field: "viewCount" | "installClickCount",
  ): Promise<void> {
    const existing = this.records.get(id);
    if (!existing) return;

    if (field === "viewCount") {
      const updated: AlignRecord = {
        ...existing,
        viewCount: (existing.viewCount ?? 0) + 1,
        lastViewedAt: new Date().toISOString(),
      };
      this.records.set(id, updated);
      return;
    }

    const updated: AlignRecord = {
      ...existing,
      installClickCount: (existing.installClickCount ?? 0) + 1,
    };
    this.records.set(id, updated);
  }

  async listRecent(limit: number): Promise<AlignRecord[]> {
    return Array.from(this.records.values())
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, limit);
  }

  async listPopular(limit: number): Promise<AlignRecord[]> {
    return Array.from(this.records.values())
      .sort((a, b) => b.installClickCount - a.installClickCount)
      .slice(0, limit);
  }

  async search(options: {
    query?: string;
    kind?: "rule" | "pack";
    sortBy: "recent" | "popular";
    limit: number;
    offset: number;
  }): Promise<{ items: AlignRecord[]; total: number }> {
    const { query, kind, sortBy, limit, offset } = options;
    const q = query?.toLowerCase().trim();

    const filtered = Array.from(this.records.values()).filter((record) => {
      if (kind && record.kind !== kind) return false;
      if (q) {
        const haystack =
          `${record.title ?? ""} ${record.description ?? ""}`.toLowerCase();
        return haystack.includes(q);
      }
      return true;
    });

    const sorted = filtered.sort((a, b) => {
      if (sortBy === "popular") {
        return b.installClickCount - a.installClickCount;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    const total = sorted.length;
    const items = sorted.slice(offset, offset + limit);
    return { items, total };
  }
}
