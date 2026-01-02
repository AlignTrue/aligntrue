import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

const mockFetch = vi.fn();

vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/aligns/storeFactory", () => ({
  hasKvEnv: () => false,
}));

describe("POST /api/aligns/expand-directory", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("returns 400 when url is missing", async () => {
    const res = await POST(
      new Request("http://localhost/api/aligns/expand-directory", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-directory URLs", async () => {
    const res = await POST(
      new Request("http://localhost/api/aligns/expand-directory", {
        method: "POST",
        body: JSON.stringify({
          url: "https://github.com/org/repo/blob/main/file.md",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("expands directory and filters to allowed files", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { path: "rules/one.md", type: "file" },
        { path: "rules/two.xml", type: "file" },
        { path: "rules/notes.txt", type: "file" },
        { path: "rules/nested", type: "dir" },
      ],
    });

    const res = await POST(
      new Request("http://localhost/api/aligns/expand-directory", {
        method: "POST",
        body: JSON.stringify({
          url: "https://github.com/org/repo/tree/main/rules",
        }),
      }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.dirname).toBe("rules");
    expect(data.files).toHaveLength(2);
    expect(data.files[0].url).toContain("/blob/main/rules/one.md");
    expect(data.files[1].url).toContain("/blob/main/rules/two.xml");
  });

  it("handles unreadable directories", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const res = await POST(
      new Request("http://localhost/api/aligns/expand-directory", {
        method: "POST",
        body: JSON.stringify({
          url: "https://github.com/org/private/tree/main/rules",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
