import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AlignRecord } from "@/lib/aligns/types";

const getMock = vi.fn();
const readFileMock = vi.fn().mockResolvedValue(Buffer.alloc(1024));

vi.mock("@/lib/aligns/storeFactory", () => ({
  getAlignStore: () => ({ get: getMock }),
}));

vi.mock("node:fs/promises", () => ({
  readFile: readFileMock,
}));

function makeRecord(overrides: Partial<AlignRecord> = {}): AlignRecord {
  return {
    schemaVersion: 1,
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
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("returns 404 for missing align", async () => {
    getMock.mockResolvedValueOnce(undefined);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/og/missing"), {
      params: Promise.resolve({ id: "missing" }),
    });

    expect(res.status).toBe(404);
  });

  it("returns PNG for valid align", async () => {
    const record = makeRecord();
    getMock.mockResolvedValueOnce(record);
    const { GET } = await import("./route");

    const res = await GET(new Request("http://localhost/api/og/align-123"), {
      params: Promise.resolve({ id: "align-123" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("image/png");

    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // \x89PNG
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
    expect(buildInstallCommand("abc123")).toBe("npx aligntrue init a:abc123");
  });
});
