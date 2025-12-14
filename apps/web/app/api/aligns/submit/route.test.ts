import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { alignIdFromNormalizedUrl } from "../../../../lib/aligns/normalize";
import type { AlignRecord } from "../../../../lib/aligns/types";
import { POST } from "./route";

var mockFetchPackForWeb: ReturnType<typeof vi.fn>;
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

vi.mock("@/lib/aligns/pack-fetcher", () => {
  mockFetchPackForWeb = vi.fn();
  return { fetchPackForWeb: mockFetchPackForWeb };
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

vi.mock("@/lib/aligns/relationships", () => ({
  addRuleToPack: vi.fn(),
}));

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

  it("submits a pack and caches URL to ID mapping", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);

    const manifestUrl =
      "https://github.com/org/repo/blob/main/examples/starter/.align.yaml";
    const expectedId = alignIdFromNormalizedUrl(manifestUrl);

    mockFetchPackForWeb.mockResolvedValue({
      manifestUrl,
      files: [],
      packFiles: [],
      totalBytes: 0,
      author: null,
      title: null,
      description: null,
    });

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { id: string };
    expect(json.id).toBe(expectedId);

    expect(mockFetchPackForWeb).toHaveBeenCalledWith(
      "https://github.com/org/repo",
      { fetchImpl: expect.any(Function) },
    );

    expect(mockSetCachedAlignId).toHaveBeenCalledWith(
      "https://github.com/org/repo",
      expectedId,
    );
    expect(mockSetCachedAlignId).toHaveBeenCalledWith(manifestUrl, expectedId);
    expect(mockStore.upsert).toHaveBeenCalledTimes(1);
  });

  it("re-imports when cached ID points to deleted align", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce("stale-id");

    const manifestUrl =
      "https://github.com/org/repo/blob/main/examples/starter/.align.yaml";
    const expectedId = alignIdFromNormalizedUrl(manifestUrl);

    mockFetchPackForWeb.mockResolvedValue({
      manifestUrl,
      files: [],
      packFiles: [],
      totalBytes: 0,
      author: null,
      title: null,
      description: null,
    });

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = (await res.json()) as { id: string };
    expect(json.id).toBe(expectedId);

    expect(mockDeleteCachedAlignId).toHaveBeenCalledWith(
      "https://github.com/org/repo",
    );
    expect(mockFetchPackForWeb).toHaveBeenCalledWith(
      "https://github.com/org/repo",
      { fetchImpl: expect.any(Function) },
    );
    expect(mockSetCachedAlignId).toHaveBeenCalledWith(
      "https://github.com/org/repo",
      expectedId,
    );
    expect(mockStore.upsert).toHaveBeenCalledTimes(1);
  });

  it("returns cached ID without calling pack resolver", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce("cached-id-1");

    const cachedRecord: AlignRecord = {
      id: "cached-id-1",
      url: "https://github.com/org/repo",
      normalizedUrl: "https://github.com/org/repo/blob/main/.align.yaml",
      provider: "github",
      kind: "pack",
      title: "Cached pack",
      description: null,
      author: null,
      fileType: "yaml",
      createdAt: "2024-01-01T00:00:00.000Z",
      lastViewedAt: "2024-01-01T00:00:00.000Z",
      viewCount: 0,
      installClickCount: 0,
      pack: {
        files: [],
        totalBytes: 0,
      },
    };
    storeData.set(cachedRecord.id, cachedRecord);

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    const json = (await res.json()) as { id: string };

    expect(json.id).toBe("cached-id-1");
    expect(mockFetchPackForWeb).not.toHaveBeenCalled();
    expect(mockStore.upsert).not.toHaveBeenCalled();
    expect(mockDeleteCachedAlignId).not.toHaveBeenCalled();
  });

  it("uses caching fetch for single-file fallback", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );

    mockCreateCachingFetch.mockReturnValue(() =>
      Promise.resolve(new Response("ok")),
    );

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

    expect(mockFetchRawWithCache).toHaveBeenCalledWith(
      expect.any(String),
      "https://github.com/org/repo/blob/main/rules/file.md",
      expect.any(Number),
      expect.objectContaining({ fetchImpl: expect.any(Function) }),
    );
    expect(mockSetCachedAlignId).toHaveBeenCalled();
  });

  it("submits a gist URL and resolves primary file", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );

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

    // Mock the caching fetch to return XML content
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

    expect(mockFetchPackForWeb).not.toHaveBeenCalled();
    expect(mockResolveGistFiles).toHaveBeenCalledWith(
      "abc123",
      expect.objectContaining({ token: "token-123" }),
    );
    expect(mockSelectPrimaryFile).toHaveBeenCalledWith(
      expect.any(Array),
      null, // no filename fragment
    );
    expect(mockStore.upsert).toHaveBeenCalledTimes(1);
    expect(mockSetCachedAlignId).toHaveBeenCalledWith(
      "https://gist.github.com/user/abc123",
      expectedId,
    );
    expect(mockSetCachedAlignId).toHaveBeenCalledWith(rawUrl, expectedId);
    // Ensure we do not cache the canonical gist URL separately (avoids fragment collisions)
    const cachedUrls = mockSetCachedAlignId.mock.calls.map((call) => call[0]);
    expect(cachedUrls).not.toContain(
      "https://gist.github.com/user/abc123#file-cursor_rule.xml",
    );
  });

  it("returns error when gist has no files", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );

    mockResolveGistFiles.mockResolvedValueOnce([]);
    mockSelectPrimaryFile.mockReturnValueOnce(null);

    mockCreateCachingFetch.mockReturnValue(vi.fn());

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://gist.github.com/user/empty" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    expect(mockFetchPackForWeb).not.toHaveBeenCalled();
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("no files");
  });

  it("returns error for unsupported gist file type", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );

    const rawUrl =
      "https://gist.githubusercontent.com/user/abc123/raw/script.py";
    mockResolveGistFiles.mockResolvedValueOnce([
      { filename: "script.py", rawUrl, size: 50 },
    ]);
    mockSelectPrimaryFile.mockReturnValueOnce({
      filename: "script.py",
      rawUrl,
      size: 50,
    });

    mockCreateCachingFetch.mockReturnValue(vi.fn());

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://gist.github.com/user/abc123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    expect(mockFetchPackForWeb).not.toHaveBeenCalled();
    const json = (await res.json()) as { error: string; hint: string };
    expect(json.error).toContain("Unsupported file type");
    expect(json.hint).toContain(".xml");
  });

  it("returns directory-specific error when no manifest and no file", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );

    mockCreateCachingFetch.mockReturnValue(vi.fn());

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const json = (await res.json()) as { error: string; hint: string };
    expect(json.error).toContain("repository or directory");
    expect(json.hint).toContain("direct link to a file");
  });

  it("returns directory error for tree URLs", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );
    mockCreateCachingFetch.mockReturnValue(vi.fn());

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({
        url: "https://github.com/org/repo/tree/main/folder",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string; hint: string };
    expect(json.error).toContain("repository or directory");
    expect(json.hint).toContain("direct link to a file");
  });

  it("returns gist error messages instead of internal error", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );
    mockCreateCachingFetch.mockReturnValue(vi.fn());
    mockResolveGistFiles.mockRejectedValueOnce(
      new Error("Gist not found. It may be private or deleted."),
    );

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://gist.github.com/user/missing" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Gist not found");
  });

  it("returns friendly error when raw fetch fails", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce(null);
    mockFetchPackForWeb.mockRejectedValueOnce(
      new Error("No .align.yaml found"),
    );
    mockCreateCachingFetch.mockReturnValue(vi.fn());
    mockFetchRawWithCache.mockRejectedValueOnce(
      new Error("Failed to fetch content"),
    );

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({
        url: "https://github.com/org/repo/blob/main/rules/file.md",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain("Could not fetch the file");
  });
});
