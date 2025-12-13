import { createHash } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const putMock = vi.fn(async (key: string, buffer: Buffer, _opts: unknown) => ({
  url: `https://blob.vercel-storage.com/${key}`,
  pathname: `/${key}`,
  size: buffer.length,
}));

class MockRedis {
  store = new Map<string, unknown>();
  static fromEnv() {
    return new MockRedis();
  }
  set(key: string, value: unknown) {
    this.store.set(key, value);
    return Promise.resolve("OK");
  }
  get<T>(key: string) {
    return Promise.resolve(this.store.get(key) as T | undefined);
  }
}

vi.mock("@vercel/blob", () => ({ put: putMock }));
vi.mock("@upstash/redis", () => ({ Redis: MockRedis }));

describe("OG storage", () => {
  beforeEach(() => {
    putMock.mockClear();
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

  it("uploads JPEG with hash-based key and stores metadata", async () => {
    const buffer = Buffer.from("og-data");
    const hex = createHash("sha256").update(buffer).digest("hex");

    const { putOgImage, getOgMetadata } = await import("./storage");

    const result = await putOgImage({
      buffer,
      alignId: "abc123",
      alignContentHash: "sha256:align-hash",
    });

    expect(result.url).toBe(`https://blob.vercel-storage.com/og/${hex}.jpg`);
    expect(result.contentHash).toBe(`sha256:${hex}`);
    expect(putMock).toHaveBeenCalledWith(
      `og/${hex}.jpg`,
      buffer,
      expect.objectContaining({
        access: "public",
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000, immutable",
      }),
    );

    const meta = await getOgMetadata("abc123");
    expect(meta?.url).toBe(result.url);
    expect(meta?.alignContentHash).toBe("sha256:align-hash");
    expect(meta?.contentHash).toBe(`sha256:${hex}`);
  });
});
