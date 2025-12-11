import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { alignIdFromNormalizedUrl } from "../../../../lib/aligns/normalize";
import type { AlignRecord } from "../../../../lib/aligns/types";
import { POST } from "./route";

var mockFetchPackForWeb: ReturnType<typeof vi.fn>;
var mockGetGitHubAppToken: ReturnType<typeof vi.fn>;
var mockCreateCachingFetch: ReturnType<typeof vi.fn>;
var mockGetCachedAlignId: ReturnType<typeof vi.fn>;
var mockSetCachedAlignId: ReturnType<typeof vi.fn>;
var mockSetCachedContent: ReturnType<typeof vi.fn>;

const storeData = new Map<string, AlignRecord>();
var mockStore: {
  get: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
};

vi.mock("@/lib/aligns/storeFactory", () => {
  mockStore = {
    get: vi.fn(async (id: string) => storeData.get(id) ?? null),
    upsert: vi.fn(async (record: AlignRecord) => {
      storeData.set(record.id, record);
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
  return {
    setCachedContent: mockSetCachedContent,
    fetchRawWithCache: vi.fn(),
  };
});

vi.mock(
  "@/lib/aligns/normalize",
  () => import("../../../../lib/aligns/normalize"),
);

vi.mock("@/lib/aligns/github-app", () => {
  mockGetGitHubAppToken = vi.fn();
  return { getGitHubAppToken: mockGetGitHubAppToken };
});

vi.mock("@/lib/aligns/caching-fetch", () => {
  mockCreateCachingFetch = vi.fn();
  return { createCachingFetch: mockCreateCachingFetch };
});

vi.mock("@/lib/aligns/url-cache", () => {
  mockGetCachedAlignId = vi.fn();
  mockSetCachedAlignId = vi.fn();
  return {
    getCachedAlignId: mockGetCachedAlignId,
    setCachedAlignId: mockSetCachedAlignId,
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
    mockGetGitHubAppToken.mockResolvedValue("token-123");
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
      info: {
        manifestPath: ".align.yaml",
        manifestId: "org/repo",
        manifestVersion: "1.0.0",
        manifestSummary: null,
        manifestAuthor: null,
        manifestDescription: null,
        ref: "main",
        files: [],
        totalBytes: 0,
      },
      files: [],
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

  it("returns cached ID without calling pack resolver", async () => {
    mockGetCachedAlignId.mockResolvedValueOnce("cached-id-1");

    const req = new Request("http://localhost/api/aligns/submit", {
      method: "POST",
      body: JSON.stringify({ url: "https://github.com/org/repo" }),
    });

    const res = await POST(req);
    const json = (await res.json()) as { id: string };

    expect(json.id).toBe("cached-id-1");
    expect(mockFetchPackForWeb).not.toHaveBeenCalled();
    expect(mockStore.upsert).not.toHaveBeenCalled();
  });
});
