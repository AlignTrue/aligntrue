import { describe, it, expect, beforeEach } from "vitest";
import { MockAlignStore } from "./mockStore";
import type { AlignRecord } from "./types";

function makeRecord(
  id: string,
  overrides: Partial<AlignRecord> = {},
): AlignRecord {
  return {
    schemaVersion: 1,
    id,
    url: `https://github.com/org/repo/blob/main/rules/${id}.md`,
    normalizedUrl: `https://github.com/org/repo/blob/main/rules/${id}.md`,
    provider: "github",
    kind: "rule",
    title: `Title ${id}`,
    description: `Description ${id}`,
    fileType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    lastViewedAt: "2024-01-02T00:00:00.000Z",
    viewCount: 0,
    installClickCount: 0,
    ...overrides,
  };
}

describe("MockAlignStore.search", () => {
  let store: MockAlignStore;

  beforeEach(() => {
    store = new MockAlignStore();
  });

  it("filters by text across title and description", async () => {
    await store.upsert(makeRecord("a1", { title: "Alpha rule" }));
    await store.upsert(makeRecord("b1", { description: "Contains beta info" }));

    const res = await store.search({
      query: "beta",
      kind: undefined,
      sortBy: "recent",
      limit: 10,
      offset: 0,
    });

    expect(res.total).toBe(1);
    expect(res.items.map((r) => r.id)).toEqual(["b1"]);
  });

  it("filters by kind", async () => {
    await store.upsert(makeRecord("r1", { kind: "rule" }));
    await store.upsert(makeRecord("p1", { kind: "pack" }));

    const res = await store.search({
      query: undefined,
      kind: "pack",
      sortBy: "recent",
      limit: 10,
      offset: 0,
    });

    expect(res.total).toBe(1);
    expect(res.items[0]?.id).toBe("p1");
  });

  it("sorts by recent createdAt", async () => {
    await store.upsert(
      makeRecord("old", { createdAt: "2023-01-01T00:00:00.000Z" }),
    );
    await store.upsert(
      makeRecord("new", { createdAt: "2024-05-01T00:00:00.000Z" }),
    );

    const res = await store.search({
      query: undefined,
      kind: undefined,
      sortBy: "recent",
      limit: 10,
      offset: 0,
    });

    expect(res.items.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("sorts by popular installClickCount", async () => {
    await store.upsert(makeRecord("low", { installClickCount: 1 }));
    await store.upsert(makeRecord("high", { installClickCount: 5 }));

    const res = await store.search({
      query: undefined,
      kind: undefined,
      sortBy: "popular",
      limit: 10,
      offset: 0,
    });

    expect(res.items.map((r) => r.id)).toEqual(["high", "low"]);
  });

  it("supports pagination with limit and offset", async () => {
    await store.upsert(
      makeRecord("r1", { createdAt: "2024-05-03T00:00:00.000Z" }),
    );
    await store.upsert(
      makeRecord("r2", { createdAt: "2024-05-02T00:00:00.000Z" }),
    );
    await store.upsert(
      makeRecord("r3", { createdAt: "2024-05-01T00:00:00.000Z" }),
    );

    const res = await store.search({
      query: undefined,
      kind: undefined,
      sortBy: "recent",
      limit: 1,
      offset: 1,
    });

    expect(res.total).toBe(3);
    expect(res.items.map((r) => r.id)).toEqual(["r2"]);
  });

  it("returns empty items with total zero when nothing matches", async () => {
    await store.upsert(makeRecord("r1", { title: "Alpha" }));

    const res = await store.search({
      query: "zzz",
      kind: undefined,
      sortBy: "recent",
      limit: 5,
      offset: 0,
    });

    expect(res.total).toBe(0);
    expect(res.items).toEqual([]);
  });
});
