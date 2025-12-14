import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockUpsert, mockGet, mockAddRuleToPack } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockGet: vi.fn(),
  mockAddRuleToPack: vi.fn(),
}));

vi.mock("@/lib/aligns/storeFactory", () => ({
  getAlignStore: () => ({
    upsert: mockUpsert,
    get: mockGet,
  }),
}));

vi.mock("@/lib/aligns/relationships", () => ({
  addRuleToPack: (...args: unknown[]) => mockAddRuleToPack(...args),
}));

import { POST } from "./route";

vi.mock("@/lib/aligns/submit-helpers", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    rateLimit: () => Promise.resolve(true),
    hashString: (input: string) => input, // deterministic for tests
  };
});

vi.mock("../submit/route", () => ({
  POST: vi.fn(async (req: Request) => {
    const body = await req.json();
    const url: string = body.url;
    if (url.includes("fail")) {
      return new Response(JSON.stringify({ error: "boom" }), { status: 400 });
    }
    const id = url.endsWith("a.md") ? "id-a" : "id-b";
    return new Response(JSON.stringify({ id }), { status: 200 });
  }),
}));

describe("POST /api/aligns/bulk-submit", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockGet.mockReset();
    mockAddRuleToPack.mockReset();
  });

  it("returns error when urls are missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/aligns/bulk-submit", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("imports multiple URLs and creates a pack", async () => {
    const res = await POST(
      new Request("http://localhost/api/aligns/bulk-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            "https://github.com/org/repo/blob/main/a.md",
            "https://github.com/org/repo/blob/main/b.md",
          ],
          createPack: {
            title: "My Pack",
            description: "Desc",
            author: "@me",
          },
        }),
      }),
    );

    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.results).toHaveLength(2);
    expect(data.results[0].status).toBe("success");
    expect(data.pack?.id).toBeDefined();
    expect(mockUpsert).toHaveBeenCalledTimes(1); // pack upsert
    expect(mockAddRuleToPack).toHaveBeenCalledTimes(2);
  });

  it("handles individual URL failure without blocking others", async () => {
    const res = await POST(
      new Request("http://localhost/api/aligns/bulk-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          urls: [
            "https://github.com/org/repo/blob/main/a.md",
            "https://github.com/org/repo/blob/main/fail.md",
          ],
        }),
      }),
    );
    const data = await res.json();
    expect(data.results[0].status).toBe("success");
    expect(data.results[1].status).toBe("error");
  });
});
