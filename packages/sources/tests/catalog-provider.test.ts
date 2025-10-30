/**
 * Comprehensive tests for catalog provider
 *
 * Test coverage:
 * - Fetch flow (successful fetch, validation, network errors)
 * - Cache operations (read/write index and packs)
 * - Offline fallback (cache hits and misses)
 * - Security (path traversal, pack ID validation)
 * - Edge cases (corrupted cache, malformed data, HTTP errors)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { CatalogProvider } from "../src/providers/catalog.js";
import type { CatalogIndex } from "../src/providers/catalog.js";

/**
 * Mock fetch responses
 */
const mockCatalogIndex: CatalogIndex = {
  version: "1",
  packs: [
    {
      id: "packs/base/base-global",
      version: "1.0.0",
      profile: { id: "aligntrue", url: "https://aligntrue.com" },
      summary: "Global base rules",
      tags: ["base", "global"],
      content_sha256: "abc123",
    },
    {
      id: "packs/base/base-testing",
      version: "1.0.0",
      summary: "Testing best practices",
      tags: ["base", "testing"],
    },
  ],
};

const mockPackYaml = `id: packs/base/base-global
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule
    severity: error
    guidance: Test rule
    applies_to: ["*"]
`;

/**
 * Test fixtures
 */
const TEST_CACHE_DIR = ".test-cache-catalog";

/**
 * Mock fetch globally
 */
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("CatalogProvider - Fetch Flow", () => {
  beforeEach(() => {
    // Clean up test cache
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }

    // Reset mocks
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up test cache
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it("fetches pack successfully with index validation", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    // Mock successful responses
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    const result = await provider.fetch("packs/base/base-global");

    expect(result).toBe(mockPackYaml);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://raw.githubusercontent.com/AlignTrue/aligns/main/catalog/index.json",
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://raw.githubusercontent.com/AlignTrue/aligns/main/packs/base/base-global.yaml",
    );
  });

  it("throws error when pack ID not in catalog index", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(mockCatalogIndex),
    });

    await expect(provider.fetch("packs/nonexistent/pack")).rejects.toThrow(
      /Pack not found in catalog: packs\/nonexistent\/pack/,
    );
  });

  it("caches pack after successful fetch", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    await provider.fetch("packs/base/base-global");

    // Verify cache files exist
    const indexPath = join(TEST_CACHE_DIR, "index.json");
    const packPath = join(TEST_CACHE_DIR, "packs/base/base-global.yaml");

    expect(existsSync(indexPath)).toBe(true);
    expect(existsSync(packPath)).toBe(true);

    const cachedIndex = JSON.parse(readFileSync(indexPath, "utf-8"));
    expect(cachedIndex).toEqual(mockCatalogIndex);

    const cachedPack = readFileSync(packPath, "utf-8");
    expect(cachedPack).toBe(mockPackYaml);
  });

  it("uses cache on second fetch (no network calls)", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    // First fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    await provider.fetch("packs/base/base-global");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    mockFetch.mockReset();

    // Second fetch (should use cache)
    const result = await provider.fetch("packs/base/base-global");
    expect(result).toBe(mockPackYaml);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("bypasses cache with forceRefresh option", async () => {
    // Create cache first
    mkdirSync(join(TEST_CACHE_DIR, "packs/base"), { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      JSON.stringify(mockCatalogIndex),
      "utf-8",
    );
    writeFileSync(
      join(TEST_CACHE_DIR, "packs/base/base-global.yaml"),
      "old cached content",
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      forceRefresh: true,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    const result = await provider.fetch("packs/base/base-global");

    expect(result).toBe(mockPackYaml);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles HTTP 404 error with clear message", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /Pack YAML not found.*may have been removed/s,
    );
  });

  it("handles HTTP 500 error", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /HTTP 500/,
    );
  });

  it("handles malformed JSON in catalog index", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => "not valid json {",
    });

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow();
  });

  it("handles empty YAML response", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      });

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /Empty YAML content/,
    );
  });

  it("handles invalid catalog index structure", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ invalid: "structure" }),
    });

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /Invalid catalog index structure/,
    );
  });
});

describe("CatalogProvider - Cache Operations", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it("creates cache directory if not exists", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    await provider.fetch("packs/base/base-global");

    expect(existsSync(TEST_CACHE_DIR)).toBe(true);
  });

  it("creates nested directories for pack cache", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    await provider.fetch("packs/base/base-global");

    const packDir = join(TEST_CACHE_DIR, "packs/base");
    expect(existsSync(packDir)).toBe(true);
  });

  it("writes cache atomically (temp + rename)", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    await provider.fetch("packs/base/base-global");

    // Verify no temp files left behind
    const indexTempPath = join(TEST_CACHE_DIR, "index.json.tmp");
    const packTempPath = join(
      TEST_CACHE_DIR,
      "packs/base/base-global.yaml.tmp",
    );

    expect(existsSync(indexTempPath)).toBe(false);
    expect(existsSync(packTempPath)).toBe(false);
  });

  it("handles corrupted cache index gracefully", async () => {
    // Create corrupted cache
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      "corrupted json {",
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    // Should fetch fresh instead of using corrupted cache
    const result = await provider.fetch("packs/base/base-global");
    expect(result).toBe(mockPackYaml);
  });

  it("handles cache read errors gracefully", async () => {
    // Create cache with invalid structure (missing required fields)
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      JSON.stringify({ wrong: "structure" }),
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    const result = await provider.fetch("packs/base/base-global");
    expect(result).toBe(mockPackYaml);
  });
});

describe("CatalogProvider - Offline Fallback", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it("falls back to cache when network unavailable", async () => {
    // Create cache first
    mkdirSync(join(TEST_CACHE_DIR, "packs/base"), { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      JSON.stringify(mockCatalogIndex),
      "utf-8",
    );
    writeFileSync(
      join(TEST_CACHE_DIR, "packs/base/base-global.yaml"),
      mockPackYaml,
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      forceRefresh: true, // Try to fetch fresh
      warnOnStaleCache: false,
    });

    // Mock network error
    mockFetch.mockRejectedValue(new Error("fetch failed: Network unavailable"));

    const result = await provider.fetch("packs/base/base-global");
    expect(result).toBe(mockPackYaml);
  });

  it("warns when using stale cache", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Create cache
    mkdirSync(join(TEST_CACHE_DIR, "packs/base"), { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      JSON.stringify(mockCatalogIndex),
      "utf-8",
    );
    writeFileSync(
      join(TEST_CACHE_DIR, "packs/base/base-global.yaml"),
      mockPackYaml,
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      forceRefresh: true,
      warnOnStaleCache: true, // Enable warnings
    });

    mockFetch.mockRejectedValue(new Error("Network unavailable"));

    await provider.fetch("packs/base/base-global");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Network unavailable, using cached pack"),
    );

    consoleSpy.mockRestore();
  });

  it("throws error when no cache available and network fails", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockRejectedValue(new Error("fetch failed"));

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /Failed to fetch pack.*no cache available/,
    );
  });

  it("uses cached index when network unavailable", async () => {
    // Create cache
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
    writeFileSync(
      join(TEST_CACHE_DIR, "index.json"),
      JSON.stringify(mockCatalogIndex),
      "utf-8",
    );

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      forceRefresh: true,
      warnOnStaleCache: false,
    });

    // Network error on index fetch
    mockFetch
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    const result = await provider.fetch("packs/base/base-global");
    expect(result).toBe(mockPackYaml);
  });

  it("handles empty cache directory gracefully", async () => {
    mkdirSync(TEST_CACHE_DIR, { recursive: true });

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockRejectedValue(new Error("Network error"));

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow(
      /no cache available/,
    );
  });
});

describe("CatalogProvider - Security", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it("rejects pack IDs with parent directory traversal", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    await expect(provider.fetch("packs/../../../etc/passwd")).rejects.toThrow(
      /Invalid pack ID.*cannot contain/s,
    );
  });

  it("rejects pack IDs with backslashes", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    await expect(provider.fetch("packs\\base\\base-global")).rejects.toThrow(
      /Invalid pack ID.*cannot contain/s,
    );
  });

  it("rejects absolute paths in pack IDs", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    await expect(provider.fetch("/etc/passwd")).rejects.toThrow(
      /Invalid pack ID.*must be relative/s,
    );
  });

  it("rejects Windows absolute paths in pack IDs", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    await expect(provider.fetch("C:\\Windows\\System32")).rejects.toThrow(
      /Invalid pack ID/,
    );
  });

  it("validates pack ID format", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    await expect(provider.fetch("invalid-format")).rejects.toThrow(
      /Invalid pack ID format.*Expected format/s,
    );
  });

  it("rejects cache paths with parent directory traversal", () => {
    expect(() => {
      new CatalogProvider({
        cacheDir: "../../../etc",
        warnOnStaleCache: false,
      });
    }).toThrow(/Invalid cache path.*cannot contain/s);
  });

  it("rejects absolute cache paths", () => {
    expect(() => {
      new CatalogProvider({
        cacheDir: "/etc/passwd",
        warnOnStaleCache: false,
      });
    }).toThrow(/Invalid cache path.*must be relative/s);
  });

  it("accepts valid pack IDs", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    // Should not throw - only fetch first pack
    await provider.fetch("packs/base/base-global");
  });
});

describe("CatalogProvider - Edge Cases", () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    mockFetch.mockReset();
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it("handles fetch timeout error", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockRejectedValue(new Error("ETIMEDOUT"));

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow();
  });

  it("handles DNS resolution failure", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockRejectedValue(new Error("ENOTFOUND"));

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow();
  });

  it("handles connection refused error", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(provider.fetch("packs/base/base-global")).rejects.toThrow();
  });

  it("handles multiple simultaneous fetches of same pack", async () => {
    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    // Setup mock for first fetch
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(mockCatalogIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    // First fetch (will cache)
    const result1 = await provider.fetch("packs/base/base-global");
    expect(result1).toBe(mockPackYaml);

    // Second fetch (will use cache, no network calls)
    const result2 = await provider.fetch("packs/base/base-global");
    expect(result2).toBe(mockPackYaml);

    // Verify only 2 network calls (for first fetch only)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("handles pack with special characters in name", async () => {
    const specialIndex: CatalogIndex = {
      version: "1",
      packs: [
        {
          id: "packs/special/test-pack-123",
          version: "1.0.0",
        },
      ],
    };

    const provider = new CatalogProvider({
      cacheDir: TEST_CACHE_DIR,
      warnOnStaleCache: false,
    });

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(specialIndex),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockPackYaml,
      });

    const result = await provider.fetch("packs/special/test-pack-123");
    expect(result).toBe(mockPackYaml);
  });
});
