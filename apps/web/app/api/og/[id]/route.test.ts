import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlignRecord } from "@/lib/aligns/types";

const getMock = vi.fn();
const readFileMock = vi.fn().mockResolvedValue(Buffer.alloc(1024));
const getOgMetadataMock = vi.fn();
const putOgImageMock = vi.fn();
const generateOgImageMock = vi.fn();

vi.mock("@/lib/aligns/storeFactory", () => ({
  getAlignStore: () => ({ get: getMock }),
  hasKvEnv: () => true,
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

vi.mock("@/lib/og/storage", () => ({
  getOgMetadata: getOgMetadataMock,
  putOgImage: putOgImageMock,
}));

vi.mock("@/lib/og/generate", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/og/generate")>(
      "@/lib/og/generate",
    );
  return {
    ...actual,
    generateOgImage: generateOgImageMock,
  };
});

vi.mock("@/lib/aligns/urlUtils", () => ({
  parseGitHubUrl: (url?: string | null) => ({
    owner: "@org",
    repo: "repo",
    ownerUrl: url ? "https://github.com/org" : null,
  }),
}));

function makeRecord(overrides: Partial<AlignRecord> = {}): AlignRecord {
  return {
    id: "align-123",
    url: "https://github.com/org/repo/blob/main/rules/file.md",
    normalizedUrl: "https://github.com/org/repo/blob/main/rules/file.md",
    provider: "github",
    kind: "rule",
    title: "Sample Align",
    description: "Sample description",
    fileType: "markdown",
    createdAt: "2024-01-01T00:00:00.000Z",
    lastViewedAt: "2024-01-02T00:00:00.000Z",
    viewCount: 1,
    installClickCount: 0,
    ...overrides,
  };
}

describe("GET /api/og/[id]", () => {
  beforeEach(() => {
    getMock.mockReset();
    readFileMock.mockClear();
    getOgMetadataMock.mockReset();
    putOgImageMock.mockReset();
    generateOgImageMock.mockReset();
    getOgMetadataMock.mockResolvedValue(null);
    generateOgImageMock.mockResolvedValue(Buffer.from("jpeg"));
    putOgImageMock.mockResolvedValue({
      url: "https://blob/new",
      contentHash: "sha256:abc",
      size: 10,
      key: "og/abc.jpg",
    });
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

  it("returns 404 for missing align", async () => {
    getMock.mockResolvedValueOnce(undefined);
    getOgMetadataMock.mockResolvedValueOnce(null);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/og/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("redirects to existing blob URL when metadata is present", async () => {
    const record = makeRecord();
    getOgMetadataMock.mockResolvedValueOnce({ url: "https://blob/og123" });
    getMock.mockResolvedValueOnce(record);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/og/align-123"), {
      params: Promise.resolve({ id: "align-123" }),
    });

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://blob/og123");
    expect(generateOgImageMock).not.toHaveBeenCalled();
  });

  it("generates and stores JPEG for valid align when no metadata", async () => {
    const record = makeRecord();
    getOgMetadataMock.mockResolvedValueOnce(null);
    getMock.mockResolvedValueOnce(record);
    generateOgImageMock.mockResolvedValueOnce(Buffer.from("jpeg-bytes"));
    putOgImageMock.mockResolvedValueOnce({
      url: "https://blob/new",
      contentHash: "sha256:abc",
      size: 10,
      key: "og/abc.jpg",
    });
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/og/align-123"), {
      params: Promise.resolve({ id: "align-123" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/jpeg");
    expect(res.headers.get("x-og-canonical")).toBe("https://blob/new");
    expect(generateOgImageMock).toHaveBeenCalledWith({
      align: record,
      id: "align-123",
    });
    expect(putOgImageMock).toHaveBeenCalledWith({
      buffer: Buffer.from("jpeg-bytes"),
      alignId: "align-123",
      alignContentHash: record.contentHash,
    });
  });

  it("uses fallback description when description matches title", async () => {
    const record = makeRecord({ title: "Same", description: "Same" });
    getMock.mockResolvedValueOnce(record);
    const { buildDescription } = await import("./route");

    const result = buildDescription(record.title, record.description);
    expect(result).toBe("Try these rules to guide your AI");
  });
});

describe("helper utilities", () => {
  it("buildInstallCommand returns npx init command with id", async () => {
    const { buildInstallCommand } = await import("./route");
    expect(buildInstallCommand("abc123")).toBe("npx aligntrue abc123");
  });
});
