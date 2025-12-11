/**
 * Tests for fetchPackForWeb
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ResolvedPack } from "@aligntrue/sources";

// Mock the sources module
vi.mock("@aligntrue/sources", () => ({
  resolvePackFromGithub: vi.fn(),
}));

import { fetchPackForWeb } from "./pack-fetcher";
import { resolvePackFromGithub } from "@aligntrue/sources";

const mockResolvePackFromGithub = vi.mocked(resolvePackFromGithub);

describe("fetchPackForWeb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns WebPackResult with correct structure", async () => {
    const mockResolved: ResolvedPack = {
      manifest: {
        id: "aligntrue/example-starter",
        version: "1.0.0",
        summary: "Example starter pack",
        author: "@aligntrue",
        description: "Example starter description",
      },
      manifestPath: ".align.yaml",
      files: [
        { path: "rules/global.md", size: 150, content: "# Global Rules" },
        { path: "rules/testing.md", size: 200, content: "# Testing" },
      ],
      ref: "main",
      repo: { host: "github.com", org: "AlignTrue", repo: "aligntrue" },
    };

    mockResolvePackFromGithub.mockResolvedValue(mockResolved);

    const result = await fetchPackForWeb(
      "https://github.com/AlignTrue/aligntrue/tree/main/examples/example-pack",
    );

    expect(result.manifestUrl).toBe(
      "https://github.com/AlignTrue/aligntrue/blob/main/.align.yaml",
    );
    expect(result.info.manifestId).toBe("aligntrue/example-starter");
    expect(result.info.manifestVersion).toBe("1.0.0");
    expect(result.info.manifestSummary).toBe("Example starter pack");
    expect(result.info.manifestAuthor).toBe("@aligntrue");
    expect(result.info.manifestDescription).toBe("Example starter description");
    expect(result.info.ref).toBe("main");
    expect(result.info.totalBytes).toBe(350);
    expect(result.files).toHaveLength(2);
  });

  it("populates file info correctly", async () => {
    const mockResolved: ResolvedPack = {
      manifest: {
        id: "test/pack",
        version: "1.0.0",
      },
      manifestPath: "packs/starter/.align.yaml",
      files: [
        { path: "packs/starter/rules/a.md", size: 100, content: "# A" },
        { path: "packs/starter/rules/b.md", size: 200, content: "# B" },
        { path: "packs/starter/rules/c.md", size: 300, content: "# C" },
      ],
      ref: "v1.0.0",
      repo: { host: "github.com", org: "test", repo: "repo" },
    };

    mockResolvePackFromGithub.mockResolvedValue(mockResolved);

    const result = await fetchPackForWeb("https://github.com/test/repo");

    expect(result.info.files).toHaveLength(3);
    expect(result.info.files[0]).toEqual({
      path: "packs/starter/rules/a.md",
      size: 100,
    });
    expect(result.info.totalBytes).toBe(600);

    // Verify cached files include content
    expect(result.files[0].content).toBe("# A");
    expect(result.files[1].content).toBe("# B");
    expect(result.files[2].content).toBe("# C");
  });

  it("handles null summary and author", async () => {
    const mockResolved: ResolvedPack = {
      manifest: {
        id: "test/minimal",
        version: "1.0.0",
        // No summary or author
      },
      manifestPath: ".align.yaml",
      files: [{ path: "rules/test.md", size: 50, content: "# Test" }],
      ref: "main",
      repo: { host: "github.com", org: "test", repo: "repo" },
    };

    mockResolvePackFromGithub.mockResolvedValue(mockResolved);

    const result = await fetchPackForWeb("https://github.com/test/repo");

    expect(result.info.manifestSummary).toBeNull();
    expect(result.info.manifestAuthor).toBeNull();
    expect(result.info.manifestDescription).toBeNull();
  });

  it("propagates errors from resolver", async () => {
    mockResolvePackFromGithub.mockRejectedValue(
      new Error("No .align.yaml found"),
    );

    await expect(
      fetchPackForWeb("https://github.com/test/no-manifest"),
    ).rejects.toThrow("No .align.yaml found");
  });

  it("constructs correct manifestUrl for subdirectory packs", async () => {
    const mockResolved: ResolvedPack = {
      manifest: {
        id: "test/subdir",
        version: "1.0.0",
      },
      manifestPath: "examples/starter/.align.yaml",
      files: [
        {
          path: "examples/starter/rules/test.md",
          size: 100,
          content: "# Test",
        },
      ],
      ref: "develop",
      repo: { host: "github.com", org: "org", repo: "project" },
    };

    mockResolvePackFromGithub.mockResolvedValue(mockResolved);

    const result = await fetchPackForWeb(
      "https://github.com/org/project/tree/develop/examples/starter",
    );

    expect(result.manifestUrl).toBe(
      "https://github.com/org/project/blob/develop/examples/starter/.align.yaml",
    );
  });
});
