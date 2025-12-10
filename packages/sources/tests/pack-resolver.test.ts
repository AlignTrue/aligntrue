/**
 * Tests for resolvePackFromGithub
 *
 * Uses mocked fetch to simulate GitHub API responses.
 */

import { describe, it, expect, vi } from "vitest";
import { resolvePackFromGithub } from "../src/pack-resolver.js";

/**
 * Create a mock fetch that returns predefined responses based on URL patterns
 */
function createMockFetch(
  responses: Record<string, { status: number; body: unknown }>,
) {
  return vi.fn(async (url: string) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return {
          ok: response.status >= 200 && response.status < 300,
          status: response.status,
          statusText: response.status === 200 ? "OK" : "Error",
          json: async () => response.body,
          text: async () =>
            typeof response.body === "string"
              ? response.body
              : JSON.stringify(response.body),
        } as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: async () => ({ message: "Not found" }),
      text: async () => "Not found",
    } as Response;
  });
}

describe("resolvePackFromGithub", () => {
  describe("manifest discovery", () => {
    it("finds manifest in root directory", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [
              { path: ".align.yaml", type: "blob", size: 100 },
              { path: "rules/global.md", type: "blob", size: 200 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/main/.align.yaml": {
          status: 200,
          body: `id: test/pack
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
        "raw.githubusercontent.com/test/repo/main/rules/global.md": {
          status: 200,
          body: "# Global Rules\n\nContent here.",
        },
      });

      const result = await resolvePackFromGithub(
        "https://github.com/test/repo",
        { fetchImpl: mockFetch },
      );

      expect(result.manifestPath).toBe(".align.yaml");
      expect(result.manifest.id).toBe("test/pack");
      expect(result.files).toHaveLength(1);
      expect(result.files[0].path).toBe("rules/global.md");
    });

    it("finds manifest in subdirectory", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [
              { path: "packs/starter/.align.yaml", type: "blob", size: 100 },
              { path: "packs/starter/rules/test.md", type: "blob", size: 150 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/main/packs/starter/.align.yaml": {
          status: 200,
          body: `id: test/starter
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
        "raw.githubusercontent.com/test/repo/main/packs/starter/rules/test.md":
          {
            status: 200,
            body: "# Test Rule",
          },
      });

      const result = await resolvePackFromGithub(
        "https://github.com/test/repo/tree/main/packs/starter",
        { fetchImpl: mockFetch },
      );

      expect(result.manifestPath).toBe("packs/starter/.align.yaml");
      expect(result.manifest.id).toBe("test/starter");
      expect(result.files).toHaveLength(1);
    });
  });

  describe("glob pattern resolution", () => {
    it("resolves glob patterns to matching files", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [
              { path: ".align.yaml", type: "blob", size: 100 },
              { path: "rules/global.md", type: "blob", size: 100 },
              { path: "rules/testing.md", type: "blob", size: 100 },
              { path: "rules/typescript.md", type: "blob", size: 100 },
              { path: "other/ignored.md", type: "blob", size: 100 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/main/.align.yaml": {
          status: 200,
          body: `id: test/pack
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
        "raw.githubusercontent.com/test/repo/main/rules/global.md": {
          status: 200,
          body: "# Global",
        },
        "raw.githubusercontent.com/test/repo/main/rules/testing.md": {
          status: 200,
          body: "# Testing",
        },
        "raw.githubusercontent.com/test/repo/main/rules/typescript.md": {
          status: 200,
          body: "# TypeScript",
        },
      });

      const result = await resolvePackFromGithub(
        "https://github.com/test/repo",
        { fetchImpl: mockFetch },
      );

      expect(result.files).toHaveLength(3);
      const paths = result.files.map((f) => f.path);
      expect(paths).toContain("rules/global.md");
      expect(paths).toContain("rules/testing.md");
      expect(paths).toContain("rules/typescript.md");
      expect(paths).not.toContain("other/ignored.md");
    });
  });

  describe("error cases", () => {
    it("throws when repository not found", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/nonexistent/git/trees/main": {
          status: 404,
          body: { message: "Not Found" },
        },
      });

      await expect(
        resolvePackFromGithub("https://github.com/test/nonexistent", {
          fetchImpl: mockFetch,
        }),
      ).rejects.toThrow(/not found/i);
    });

    it("throws when no manifest exists", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [{ path: "README.md", type: "blob", size: 100 }],
          },
        },
      });

      await expect(
        resolvePackFromGithub("https://github.com/test/repo", {
          fetchImpl: mockFetch,
        }),
      ).rejects.toThrow(/no .align.yaml found/i);
    });

    it("throws when manifest is invalid", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [{ path: ".align.yaml", type: "blob", size: 50 }],
          },
        },
        "raw.githubusercontent.com/test/repo/main/.align.yaml": {
          status: 200,
          body: `version: 1.0.0`, // missing id
        },
      });

      await expect(
        resolvePackFromGithub("https://github.com/test/repo", {
          fetchImpl: mockFetch,
        }),
      ).rejects.toThrow(/missing required 'id'/i);
    });

    it("throws when no files match includes", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/main": {
          status: 200,
          body: {
            tree: [
              { path: ".align.yaml", type: "blob", size: 100 },
              { path: "other/file.txt", type: "blob", size: 100 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/main/.align.yaml": {
          status: 200,
          body: `id: test/pack
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
      });

      await expect(
        resolvePackFromGithub("https://github.com/test/repo", {
          fetchImpl: mockFetch,
        }),
      ).rejects.toThrow(/no files matched/i);
    });

    it("rejects non-GitHub hosts", async () => {
      const mockFetch = createMockFetch({});

      await expect(
        resolvePackFromGithub("https://gitlab.com/test/repo", {
          fetchImpl: mockFetch,
        }),
      ).rejects.toThrow(/only github is supported/i);
    });
  });

  describe("ref handling", () => {
    it("uses ref from URL", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/v1.0.0": {
          status: 200,
          body: {
            tree: [
              { path: ".align.yaml", type: "blob", size: 100 },
              { path: "rules/test.md", type: "blob", size: 100 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/v1.0.0/.align.yaml": {
          status: 200,
          body: `id: test/pack
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
        "raw.githubusercontent.com/test/repo/v1.0.0/rules/test.md": {
          status: 200,
          body: "# Test",
        },
      });

      const result = await resolvePackFromGithub(
        "https://github.com/test/repo/tree/v1.0.0",
        { fetchImpl: mockFetch },
      );

      expect(result.ref).toBe("v1.0.0");
    });

    it("uses ref option override", async () => {
      const mockFetch = createMockFetch({
        "api.github.com/repos/test/repo/git/trees/custom-branch": {
          status: 200,
          body: {
            tree: [
              { path: ".align.yaml", type: "blob", size: 100 },
              { path: "rules/test.md", type: "blob", size: 100 },
            ],
          },
        },
        "raw.githubusercontent.com/test/repo/custom-branch/.align.yaml": {
          status: 200,
          body: `id: test/pack
version: 1.0.0
includes:
  rules:
    - "rules/*.md"
`,
        },
        "raw.githubusercontent.com/test/repo/custom-branch/rules/test.md": {
          status: 200,
          body: "# Test",
        },
      });

      const result = await resolvePackFromGithub(
        "https://github.com/test/repo",
        { fetchImpl: mockFetch, ref: "custom-branch" },
      );

      expect(result.ref).toBe("custom-branch");
    });
  });
});
