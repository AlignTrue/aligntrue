import { describe, it, expect, beforeEach, vi } from "vitest";

import { fetchPackContent, isCatalogPack } from "./pack-content";
import type { AlignRecord } from "./types";
import type { AlignStore } from "./store";

vi.mock("./seedData", () => ({
  findSeedContent: vi.fn(),
}));

vi.mock("./content-cache", () => ({
  fetchRawWithCache: vi.fn(),
  getCachedContent: vi.fn(),
  setCachedContent: vi.fn(),
}));

const { findSeedContent } = await import("./seedData");
const { fetchRawWithCache, getCachedContent, setCachedContent } = await import(
  "./content-cache"
);

function makeAlign(
  id: string,
  overrides: Partial<AlignRecord> = {},
): AlignRecord {
  return {
    id,
    url: `https://github.com/org/repo/blob/main/${id}.md`,
    normalizedUrl: `https://github.com/org/repo/blob/main/${id}.md`,
    provider: "github",
    source: "github",
    kind: "rule",
    title: `${id} title`,
    description: `${id} desc`,
    fileType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    lastViewedAt: "2024-01-01T00:00:00.000Z",
    viewCount: 0,
    installClickCount: 0,
    ...overrides,
  };
}

function makeStore(records: Record<string, AlignRecord>): AlignStore {
  return {
    async get(id) {
      return records[id] ?? null;
    },
    async getMultiple(ids) {
      return ids.map((id) => records[id] ?? null);
    },
    async upsert() {},
    async upsertMultiple() {},
    async increment() {},
    async listRecent() {
      return [];
    },
    async listPopular() {
      return [];
    },
    async markSourceRemoved() {},
    async resetSourceRemoved() {},
    async search() {
      return { items: [], total: 0 };
    },
  };
}

describe("isCatalogPack", () => {
  it("returns true only for catalog packs", () => {
    expect(
      isCatalogPack(makeAlign("p1", { source: "catalog", kind: "pack" })),
    ).toBe(true);
    expect(
      isCatalogPack(makeAlign("p2", { source: "github", kind: "pack" })),
    ).toBe(false);
    expect(isCatalogPack(makeAlign("r1"))).toBe(false);
  });
});

describe("fetchPackContent", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns seed content when present", async () => {
    const seed = { kind: "single", content: "seed" } as const;
    vi.mocked(findSeedContent).mockReturnValue(seed);

    const store = makeStore({});
    const result = await fetchPackContent(makeAlign("seed"), store);

    expect(result).toBe(seed);
    expect(fetchRawWithCache).not.toHaveBeenCalled();
  });

  it("fetches catalog pack files and caches them", async () => {
    vi.mocked(findSeedContent).mockReturnValue(null);
    vi.mocked(fetchRawWithCache)
      .mockResolvedValueOnce({ kind: "single", content: "abc" })
      .mockResolvedValueOnce({ kind: "single", content: "def" });

    const a1 = makeAlign("a1");
    const a2 = makeAlign("a2");
    const pack = makeAlign("pack", {
      source: "catalog",
      kind: "pack",
      containsAlignIds: [a1.id, a2.id],
    });
    const store = makeStore({ [a1.id]: a1, [a2.id]: a2 });

    const content = await fetchPackContent(pack, store);

    expect(fetchRawWithCache).toHaveBeenCalledTimes(2);
    expect(setCachedContent).toHaveBeenCalledTimes(1);
    expect(content?.kind).toBe("pack");
    expect(content && "files" in content ? content.files.length : 0).toBe(2);
    expect(content && "files" in content ? content.files[0]?.path : null).toBe(
      "a1.md",
    );
  });

  it("falls back to cached content when catalog fetch fails", async () => {
    vi.mocked(findSeedContent).mockReturnValue(null);
    vi.mocked(fetchRawWithCache).mockRejectedValue(new Error("boom"));
    const cached = { kind: "pack" as const, files: [] };
    vi.mocked(getCachedContent).mockResolvedValue(cached);

    const pack = makeAlign("pack", {
      source: "catalog",
      kind: "pack",
      containsAlignIds: ["x"],
    });
    const store = makeStore({ x: makeAlign("x") });

    const content = await fetchPackContent(pack, store);

    expect(content).toStrictEqual(cached);
    expect(getCachedContent).toHaveBeenCalledWith("pack");
  });

  it("returns cached content for legacy packs", async () => {
    vi.mocked(findSeedContent).mockReturnValue(null);
    const cached = { kind: "pack" as const, files: [] };
    vi.mocked(getCachedContent).mockResolvedValue(cached);

    const pack = makeAlign("legacy-pack", { kind: "pack", source: "github" });
    const store = makeStore({});

    const content = await fetchPackContent(pack, store);
    expect(content).toBe(cached);
    expect(fetchRawWithCache).not.toHaveBeenCalled();
  });

  it("fetches single rule content with cache fallback on error", async () => {
    vi.mocked(findSeedContent).mockReturnValue(null);
    const rule = makeAlign("rule");
    const store = makeStore({ [rule.id]: rule });

    vi.mocked(fetchRawWithCache).mockResolvedValueOnce({
      kind: "single",
      content: "body",
    });
    const result = await fetchPackContent(rule, store);
    expect(result).toEqual({ kind: "single", content: "body" });

    vi.resetAllMocks();
    vi.mocked(findSeedContent).mockReturnValue(null);
    vi.mocked(fetchRawWithCache).mockRejectedValueOnce(new Error("fail"));

    await expect(fetchPackContent(rule, store)).rejects.toThrow("fail");
  });
});
