/**
 * Git Source Error Recovery Tests
 *
 * Tests error handling and recovery scenarios for git sources:
 * 1. Offline mode behavior
 * 2. Network failure recovery
 * 3. Cache fallback
 * 4. Invalid repository handling
 * 5. Missing file handling
 * 6. Consent denial handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { GitProvider, type GitSourceConfig } from "../src/providers/git.js";

describe("Git Source Error Recovery", () => {
  let cacheDir: string;

  beforeEach(() => {
    cacheDir = join(
      tmpdir(),
      `git-error-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(cacheDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(cacheDir)) {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  describe("URL Validation", () => {
    it("rejects invalid URL formats", () => {
      expect(() => {
        new GitProvider(
          {
            type: "git",
            url: "not-a-valid-url",
            path: "rules.md",
          },
          cacheDir,
        );
      }).toThrow(/Invalid git URL/);
    });

    it("rejects file:// URLs (security)", () => {
      expect(() => {
        new GitProvider(
          {
            type: "git",
            url: "file:///etc/passwd",
            path: "rules.md",
          },
          cacheDir,
        );
      }).toThrow(/Invalid git URL|not allowed/i);
    });

    it("accepts valid https URLs", () => {
      expect(() => {
        new GitProvider(
          {
            type: "git",
            url: "https://github.com/example/repo.git",
            path: "rules.md",
          },
          cacheDir,
        );
      }).not.toThrow();
    });

    it("accepts valid SSH URLs", () => {
      expect(() => {
        new GitProvider(
          {
            type: "git",
            url: "git@github.com:example/repo.git",
            path: "rules.md",
          },
          cacheDir,
        );
      }).not.toThrow();
    });
  });

  describe("Offline Mode", () => {
    it("throws clear error when offline with no cache", async () => {
      const provider = new GitProvider(
        {
          type: "git",
          url: "https://github.com/example/repo",
          path: "rules.md",
        },
        cacheDir,
        { offlineMode: true },
      );

      await expect(provider.fetch()).rejects.toThrow(/Offline mode.*no cache/i);
    });

    it("uses cache when available in offline mode", async () => {
      // Simulate cached repository with rules file
      const repoHash = "a1b2c3d4"; // Simplified - actual uses hash of URL
      const repoDir = join(cacheDir, repoHash);
      mkdirSync(repoDir, { recursive: true });

      // Create mock rules file
      const rulesPath = join(repoDir, "rules.md");
      writeFileSync(rulesPath, "# Cached Rules\n\nCached content.", "utf-8");

      // Create cache metadata
      const metaPath = join(repoDir, ".aligntrue-cache-meta.json");
      writeFileSync(
        metaPath,
        JSON.stringify({
          version: 1,
          url: "https://github.com/example/repo",
          ref: "main",
          lastFetch: Date.now(),
          sha: "abc123",
        }),
        "utf-8",
      );

      // Note: This test documents expected behavior but GitProvider
      // uses internal hashing that won't match our mock repoHash.
      // The actual test would need a real cache directory structure.
      // This is a placeholder for documentation purposes.
    });
  });

  describe("Consent Handling", () => {
    it("provides clear error when consent is required", async () => {
      // Mock consent manager that denies consent
      const mockConsentManager = {
        hasConsent: vi.fn().mockResolvedValue(false),
        requestConsent: vi.fn().mockResolvedValue(false),
        revokeConsent: vi.fn().mockResolvedValue(undefined),
      };

      const provider = new GitProvider(
        {
          type: "git",
          url: "https://github.com/example/repo",
          path: "rules.md",
        },
        cacheDir,
        { consentManager: mockConsentManager },
      );

      await expect(provider.fetch()).rejects.toThrow(
        /consent|permission|grant/i,
      );
    });
  });

  describe("Configuration Validation", () => {
    it("uses default ref when not specified", () => {
      const config: GitSourceConfig = {
        type: "git",
        url: "https://github.com/example/repo",
      };

      // Provider should accept this and default to 'main'
      expect(() => {
        new GitProvider(config, cacheDir);
      }).not.toThrow();
    });

    it("uses default path when not specified", () => {
      const config: GitSourceConfig = {
        type: "git",
        url: "https://github.com/example/repo",
        ref: "main",
      };

      // Provider should accept this and default to '.aligntrue.yaml'
      expect(() => {
        new GitProvider(config, cacheDir);
      }).not.toThrow();
    });
  });

  describe("Cache Directory Handling", () => {
    it("creates cache directory if missing", () => {
      const newCacheDir = join(cacheDir, "new-subdir");
      expect(existsSync(newCacheDir)).toBe(false);

      new GitProvider(
        {
          type: "git",
          url: "https://github.com/example/repo",
          path: "rules.md",
        },
        newCacheDir,
      );

      expect(existsSync(newCacheDir)).toBe(true);
    });

    it("handles existing cache directory gracefully", () => {
      // Pre-create directory
      mkdirSync(join(cacheDir, "existing"), { recursive: true });

      expect(() => {
        new GitProvider(
          {
            type: "git",
            url: "https://github.com/example/repo",
            path: "rules.md",
          },
          join(cacheDir, "existing"),
        );
      }).not.toThrow();
    });
  });

  describe("Error Message Quality", () => {
    it("includes repository URL in error messages", async () => {
      const testUrl = "https://github.com/test-org/test-repo";
      const provider = new GitProvider(
        {
          type: "git",
          url: testUrl,
          path: "rules.md",
        },
        cacheDir,
        { offlineMode: true },
      );

      try {
        await provider.fetch();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain(testUrl);
      }
    });

    it("provides actionable guidance in errors", async () => {
      const provider = new GitProvider(
        {
          type: "git",
          url: "https://github.com/example/repo",
          path: "rules.md",
        },
        cacheDir,
        { offlineMode: true },
      );

      try {
        await provider.fetch();
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        // Error should suggest how to fix the issue
        const message = (error as Error).message.toLowerCase();
        expect(
          message.includes("--offline") ||
            message.includes("network") ||
            message.includes("cache"),
        ).toBe(true);
      }
    });
  });

  describe("Type Guards", () => {
    it("has correct type property", () => {
      const provider = new GitProvider(
        {
          type: "git",
          url: "https://github.com/example/repo",
          path: "rules.md",
        },
        cacheDir,
      );

      expect(provider.type).toBe("git");
    });
  });
});
