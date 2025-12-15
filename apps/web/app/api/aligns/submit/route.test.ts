import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { alignIdFromNormalizedUrl } from "../../../../lib/aligns/normalize";
import type { AlignRecord } from "../../../../lib/aligns/types";
import { POST } from "./route";

var mockGetAuthToken: ReturnType<typeof vi.fn>;
var mockCreateCachingFetch: ReturnType<typeof vi.fn>;
var mockGetCachedAlignId: ReturnType<typeof vi.fn>;
var mockSetCachedAlignId: ReturnType<typeof vi.fn>;
var mockDeleteCachedAlignId: ReturnType<typeof vi.fn>;
var mockSetCachedContent: ReturnType<typeof vi.fn>;
var mockFetchRawWithCache: ReturnType<typeof vi.fn>;
var mockResolveGistFiles: ReturnType<typeof vi.fn>;
var mockSelectPrimaryFile: ReturnType<typeof vi.fn>;

const storeData = new Map<string, AlignRecord>();
var mockStore: {
  get: ReturnType<typeof vi.fn>;
  getMultiple: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  upsertMultiple: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/aligns/storeFactory", () => {
  mockStore = {
    get: vi.fn(async (id: string) => storeData.get(id) ?? null),
    getMultiple: vi.fn(async (ids: string[]) =>
      ids.map((id) => storeData.get(id) ?? null),
    ),
    upsert: vi.fn(async (record: AlignRecord) => {
      storeData.set(record.id, record);
    }),
    upsertMultiple: vi.fn(async (records: AlignRecord[]) => {
      records.forEach((r) => storeData.set(r.id, r));
    }),
  };
  return {
    getAlignStore: () => mockStore,
    hasKvEnv: () => false,
  };
});

vi.mock("@/lib/aligns/content-cache", () => {
  mockSetCachedContent = vi.fn();
  mockFetchRawWithCache = vi.fn();
  return {
    setCachedContent: mockSetCachedContent,
    fetchRawWithCache: mockFetchRawWithCache,
  };
});

vi.mock("@/lib/aligns/gist-resolver", () => {
  mockResolveGistFiles = vi.fn();
  mockSelectPrimaryFile = vi.fn();
  return {
    resolveGistFiles: mockResolveGistFiles,
    selectPrimaryFile: mockSelectPrimaryFile,
  };
});

vi.mock(
  "@/lib/aligns/normalize",
  () => import("../../../../lib/aligns/normalize"),
);

vi.mock("@/lib/aligns/github-app", () => {
  mockGetAuthToken = vi.fn();
  return { getAuthToken: mockGetAuthToken };
});

vi.mock("@/lib/aligns/caching-fetch", () => {
  mockCreateCachingFetch = vi.fn();
  return { createCachingFetch: mockCreateCachingFetch };
});

vi.mock("@/lib/aligns/url-cache", () => {
  mockGetCachedAlignId = vi.fn();
  mockSetCachedAlignId = vi.fn();
  mockDeleteCachedAlignId = vi.fn();
  return {
    getCachedAlignId: mockGetCachedAlignId,
    setCachedAlignId: mockSetCachedAlignId,
    deleteCachedAlignId: mockDeleteCachedAlignId,
  };
});

vi.mock(
  "@/lib/aligns/metadata",
  () => import("../../../../lib/aligns/metadata"),
);

vi.mock("@/lib/aligns/records", () => import("../../../../lib/aligns/records"));

describe("POST /api/aligns/submit", () => {
  beforeEach(() => {
    storeData.clear();
    vi.clearAllMocks();
    mockStore.get.mockClear();
    mockStore.upsert.mockClear();
    mockGetAuthToken.mockResolvedValue("token-123");
    mockCreateCachingFetch.mockReturnValue(vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns cached ID without re-importing", async () => {
    const cachedRecord: AlignRecord = {
      id: "cached-id-1",
      url: "https://github.com/org/repo/blob/main/rules/file.md",
      normalizedUrl: "https://github.com/org/repo/blob/main/rules/file.md",
      provider: "github",
      kind: "rule",
      title: "Cached rule",
      description: null,
      author: null,
      fileType: "markdown",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastViewedAt: "2024-01-01T00:00:00.000Z",
      viewCount: 0,
      installClickCount: 0,
    };
    storeData.set(cachedRecord.id, cachedRecord);
    mockGetCachedAlignId.mockResolvedValueOnce("cached-id-1");

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: cachedRecord.url }),
    });

    const res = await POST(req);
    const json = (await res.json()) as { id: string };

    expect(res.status).toBe(200);
    expect(json.id).toBe("cached-id-1");
    expect(mockFetchRawWithCache).not.toHaveBeenCalled();
  });

  it("imports a single file and caches URL", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchRawWithCache.mockResolvedValueOnce({
      kind: "single",
      content: "# file",
    });
    mockSetCachedContent.mockResolvedValueOnce(undefined);

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({
        url: "https://github.com/org/repo/blob/main/rules/file.md",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { id: string };
    const expectedId = alignIdFromNormalizedUrl(
      "https://github.com/org/repo/blob/main/rules/file.md",
    );
    expect(json.id).toBe(expectedId);
    expect(mockSetCachedAlignId).toHaveBeenCalledWith(
      "https://github.com/org/repo/blob/main/rules/file.md",
      expectedId,
    );
  });

  it("returns directory-specific error", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    const json = (await res.json()) as { error: string; hint: string };
    expect(res.status).toBe(400);
    expect(json.error).toContain("repository or directory");
    expect(json.hint).not.toContain(".align.yaml");
  });

  it("submits a gist URL and resolves primary file", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    const rawUrl =
      "https://gist.githubusercontent.com/user/abc123/raw/cursor_rule.xml";
    const expectedId = alignIdFromNormalizedUrl(rawUrl);

    mockResolveGistFiles.mockResolvedValueOnce([
      {
        filename: "cursor_rule.xml",
        rawUrl,
        size: 100,
      },
    ]);
    mockSelectPrimaryFile.mockReturnValueOnce({
      filename: "cursor_rule.xml",
      rawUrl,
      size: 100,
    });

    const mockCachingFetchFn = vi
      .fn()
      .mockResolvedValue(new Response("<rule>content</rule>"));
    mockCreateCachingFetch.mockReturnValue(mockCachingFetchFn);

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://gist.github.com/user/abc123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { id: string };
    expect(json.id).toBe(expectedId);
  });

  it("returns friendly error for unsupported file type", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({
        url: "https://github.com/org/repo/blob/main/script.py",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Unsupported file type");
  });
});
