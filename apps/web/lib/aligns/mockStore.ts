import type { AlignRecord } from "./types";
import type { AlignStore } from "./store";

export class MockAlignStore implements AlignStore {
  private records = new Map<string, AlignRecord>();

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
}
