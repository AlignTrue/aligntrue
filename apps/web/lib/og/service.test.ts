import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlignRecord } from "@/lib/aligns/types";

const hasKvEnvMock = vi.fn(() => true);
const getOgMetadataMock = vi.fn();
const putOgImageMock = vi.fn();
const generateOgImageMock = vi.fn();

vi.mock("@/lib/aligns/storeFactory", () => ({
  hasKvEnv: hasKvEnvMock,
}));

vi.mock("./storage", () => ({
  getOgMetadata: getOgMetadataMock,
  putOgImage: putOgImageMock,
}));

vi.mock("./generate", () => ({
  generateOgImage: generateOgImageMock,
}));

function makeAlign(overrides: Partial<AlignRecord> = {}): AlignRecord {
  return {
    id: "align-1",
    url: "https://github.com/org/repo/blob/main/file.md",
    normalizedUrl: "https://github.com/org/repo/blob/main/file.md",
    provider: "github",
    kind: "rule",
    title: "Sample Align",
    description: "Sample description",
    fileType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    lastViewedAt: "2024-01-02T00:00:00.000Z",
    viewCount: 0,
    installClickCount: 0,
    contentHash: "sha256:content",
    ...overrides,
  };
}

describe("ensureOgImage", () => {
  beforeEach(() => {
    hasKvEnvMock.mockReturnValue(true);
    getOgMetadataMock.mockReset();
    putOgImageMock.mockReset();
    generateOgImageMock.mockReset();
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
  });

  afterEach(() => {
    vi.resetModules();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("returns null when blob env missing", async () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    const { ensureOgImage } = await import("./service");
    const result = await ensureOgImage(makeAlign());
    expect(result).toBeNull();
    expect(getOgMetadataMock).not.toHaveBeenCalled();
    expect(generateOgImageMock).not.toHaveBeenCalled();
    expect(putOgImageMock).not.toHaveBeenCalled();
  });

  it("returns null when kv env missing", async () => {
    hasKvEnvMock.mockReturnValue(false);
    const { ensureOgImage } = await import("./service");
    const result = await ensureOgImage(makeAlign());
    expect(result).toBeNull();
    expect(getOgMetadataMock).not.toHaveBeenCalled();
    expect(generateOgImageMock).not.toHaveBeenCalled();
    expect(putOgImageMock).not.toHaveBeenCalled();
  });

  it("returns existing metadata when hash matches", async () => {
    const meta = {
      url: "https://blob/existing",
      contentHash: "sha256:img",
      alignContentHash: "sha256:content",
      generatedAt: "2024-01-01T00:00:00.000Z",
    };
    getOgMetadataMock.mockResolvedValueOnce(meta);

    const { ensureOgImage } = await import("./service");
    const result = await ensureOgImage(makeAlign());

    expect(result).toEqual(meta);
    expect(generateOgImageMock).not.toHaveBeenCalled();
    expect(putOgImageMock).not.toHaveBeenCalled();
  });

  it("regenerates when hash is stale", async () => {
    const staleMeta = {
      url: "https://blob/old",
      contentHash: "sha256:old",
      alignContentHash: "sha256:stale",
      generatedAt: "2024-01-01T00:00:00.000Z",
    };
    getOgMetadataMock.mockResolvedValueOnce(staleMeta);
    generateOgImageMock.mockResolvedValueOnce(Buffer.from("jpeg"));
    putOgImageMock.mockResolvedValueOnce({
      url: "https://blob/new",
      contentHash: "sha256:new",
      size: 10,
      key: "og/new.jpg",
    });

    const { ensureOgImage } = await import("./service");
    const result = await ensureOgImage(
      makeAlign({ contentHash: "sha256:content" }),
    );

    expect(generateOgImageMock).toHaveBeenCalledTimes(1);
    expect(putOgImageMock).toHaveBeenCalledTimes(1);
    expect(result?.url).toBe("https://blob/new");
    expect(result?.contentHash).toBe("sha256:new");
  });

  it("generates when no prior metadata", async () => {
    getOgMetadataMock.mockResolvedValueOnce(null);
    generateOgImageMock.mockResolvedValueOnce(Buffer.from("jpeg"));
    putOgImageMock.mockResolvedValueOnce({
      url: "https://blob/new",
      contentHash: "sha256:new",
      size: 10,
      key: "og/new.jpg",
    });

    const { ensureOgImage } = await import("./service");
    const result = await ensureOgImage(makeAlign());

    expect(generateOgImageMock).toHaveBeenCalledTimes(1);
    expect(putOgImageMock).toHaveBeenCalledTimes(1);
    expect(result?.url).toBe("https://blob/new");
    expect(result?.contentHash).toBe("sha256:new");
  });
});
