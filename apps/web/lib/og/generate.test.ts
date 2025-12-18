import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlignRecord } from "@/lib/aligns/types";

const jpegOptionsMock = vi.fn();
const toBufferMock = vi.fn().mockResolvedValue(Buffer.from("jpeg-output"));
const fetchMock = vi.fn();

vi.mock("@/app/api/og/AlignTrueLogoOG", () => ({
  AlignTrueLogoOG: () => null,
}));

vi.mock("@vercel/og", () => ({
  ImageResponse: class extends Response {
    constructor(_body: unknown, init?: ResponseInit) {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      super(pngHeader, {
        status: 200,
        headers: {
          "content-type": "image/png",
          ...(init?.headers ?? {}),
        },
      });
    }
  },
}));

vi.mock("sharp", () => ({
  default: () => ({
    jpeg: (options: unknown) => {
      jpegOptionsMock(options);
      return { toBuffer: toBufferMock };
    },
  }),
}));

function makeRecord(overrides: Partial<AlignRecord> = {}): AlignRecord {
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
    ...overrides,
  };
}

describe("generateOgImage", () => {
  beforeEach(() => {
    jpegOptionsMock.mockClear();
    toBufferMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from("font"),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.BLOB_READ_WRITE_TOKEN = "token";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis";
    process.env.UPSTASH_REDIS_REST_TOKEN = "secret";
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.BLOB_READ_WRITE_TOKEN;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("renders PNG then optimizes to JPEG with crisp settings", async () => {
    const { generateOgImage } = await import("./generate");
    const buffer = await generateOgImage({
      align: makeRecord(),
      id: "align-1",
    });

    expect(buffer).toEqual(Buffer.from("jpeg-output"));
    expect(jpegOptionsMock).toHaveBeenCalledWith({
      quality: 88,
      chromaSubsampling: "4:4:4",
      progressive: true,
      mozjpeg: true,
    });
    expect(toBufferMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const fetchArg = fetchMock.mock.calls[0][0];
    expect(fetchArg instanceof URL).toBe(true);
    expect((fetchArg as URL).pathname).toContain(
      "/public/fonts/NotoSans-Regular.ttf",
    );
  });
});
