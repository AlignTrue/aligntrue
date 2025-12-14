import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlignRecord } from "@/lib/aligns/types";

const searchMock = vi.fn();

vi.mock("@/lib/aligns/storeFactory", () => ({
  getAlignStore: () => ({ search: searchMock }),
}));

function makeRecord(overrides: Partial<AlignRecord> = {}): AlignRecord {
  return {
    id: "align-1",
    url: "https://github.com/org/repo/blob/main/rules/file.md",
    normalizedUrl: "https://github.com/org/repo/blob/main/rules/file.md",
    provider: "github",
    kind: "rule",
    title: "Sample title",
    description: "Sample description",
    fileType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    lastViewedAt: "2024-01-02T00:00:00.000Z",
    viewCount: 1,
    installClickCount: 5,
    ...overrides,
  };
}

describe("GET /api/aligns/search", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("uses default params when none provided", async () => {
    const record = makeRecord();
    searchMock.mockResolvedValueOnce({ items: [record], total: 1 });

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/aligns/search"));

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      items: Array<Record<string, unknown>>;
      total: number;
    };

    expect(searchMock).toHaveBeenCalledWith({
      query: undefined,
      kind: undefined,
      sortBy: "recent",
      limit: 9,
      offset: 0,
    });
    expect(json.total).toBe(1);
    expect(json.items).toEqual([
      {
        id: record.id,
        title: record.title,
        description: record.description,
        provider: record.provider,
        normalizedUrl: record.normalizedUrl,
        kind: record.kind,
        url: record.url,
        pack: record.pack,
      },
    ]);
  });

  it("parses and clamps query params", async () => {
    searchMock.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/aligns/search?query=foo&kind=pack&sort=popular&limit=500&offset=20000",
      ),
    );

    expect(res.status).toBe(200);
    expect(searchMock).toHaveBeenCalledWith({
      query: "foo",
      kind: "pack",
      sortBy: "popular",
      limit: 50, // clamped to max 50
      offset: 10000, // clamped to max 10000
    });
  });

  it("passes through kind and query values", async () => {
    searchMock.mockResolvedValueOnce({ items: [], total: 0 });

    const { GET } = await import("./route");
    const res = await GET(
      new Request(
        "http://localhost/api/aligns/search?query=bar&kind=rule&limit=5&offset=10&sort=recent",
      ),
    );

    expect(res.status).toBe(200);
    expect(searchMock).toHaveBeenCalledWith({
      query: "bar",
      kind: "rule",
      sortBy: "recent",
      limit: 5,
      offset: 10,
    });
  });

  it("returns 500 when search throws", async () => {
    searchMock.mockRejectedValueOnce(new Error("boom"));

    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/aligns/search"));

    expect(res.status).toBe(500);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toBe("Search failed");
  });
});
