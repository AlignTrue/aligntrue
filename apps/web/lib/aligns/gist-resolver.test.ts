import { describe, expect, it, vi } from "vitest";
import { resolveGistFiles, selectPrimaryFile } from "./gist-resolver";

const makeResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), { status: 200, ...init });

describe("resolveGistFiles", () => {
  it("returns files from gist response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      makeResponse({
        files: {
          "cursor_rule.xml": {
            filename: "cursor_rule.xml",
            raw_url:
              "https://gist.githubusercontent.com/user/abc/raw/cursor_rule.xml",
            size: 123,
          },
        },
      }),
    );

    const files = await resolveGistFiles("abc", {
      fetchImpl: fetchMock,
      token: null,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/gists/abc",
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: "application/vnd.github+json",
        }),
      }),
    );
    expect(files).toEqual([
      {
        filename: "cursor_rule.xml",
        rawUrl:
          "https://gist.githubusercontent.com/user/abc/raw/cursor_rule.xml",
        size: 123,
      },
    ]);
  });

  it("throws on non-OK response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response("nope", { status: 404, statusText: "Not Found" }),
      );

    await expect(
      resolveGistFiles("missing", { fetchImpl: fetchMock, token: null }),
    ).rejects.toThrow("Failed to load gist missing");
  });
});

describe("selectPrimaryFile", () => {
  const files = [
    {
      filename: "zeta.md",
      rawUrl: "https://example.com/zeta.md",
      size: 1,
    },
    {
      filename: "cursor_rule.xml",
      rawUrl: "https://example.com/cursor_rule.xml",
      size: 2,
    },
  ];

  it("returns requested filename when present", () => {
    const selected = selectPrimaryFile(files, "cursor_rule.xml");
    expect(selected?.filename).toBe("cursor_rule.xml");
  });

  it("returns first alphabetical when no request provided", () => {
    const selected = selectPrimaryFile(files);
    expect(selected?.filename).toBe("cursor_rule.xml");
  });

  it("returns null when no files", () => {
    const selected = selectPrimaryFile([]);
    expect(selected).toBeNull();
  });
});
