/**
 * Tests for link command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { link } from "../../src/commands/link.js";

// Mock modules
vi.mock("@aligntrue/sources");
vi.mock("@aligntrue/core");
vi.mock("@aligntrue/core/telemetry/collector.js");

const TEST_DIR = join(process.cwd(), "test-link-workspace");
const VENDOR_DIR = join(TEST_DIR, "vendor", "test-rules");
const CACHE_DIR = join(TEST_DIR, ".aligntrue", ".cache", "git");
const CONFIG_PATH = join(TEST_DIR, ".aligntrue", "config.yaml");
const ALLOW_LIST_PATH = join(TEST_DIR, ".aligntrue", "allow.yaml");

describe("link command", () => {
  beforeEach(() => {
    // Create test workspace
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
    mkdirSync(join(TEST_DIR, ".aligntrue"), { recursive: true });
    mkdirSync(CACHE_DIR, { recursive: true });

    // Change to test directory
    process.chdir(TEST_DIR);

    // Create default config
    writeFileSync(
      CONFIG_PATH,
      `mode: solo
agents:
  - cursor
`,
    );

    // Clear mocks
    vi.clearAllMocks();

    // Mock console methods
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore mocks
    vi.restoreAllMocks();

    // Clean up test workspace
    process.chdir(process.cwd());
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe("help and validation", () => {
    it("shows help with --help flag", async () => {
      await link(["--help"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Vendor packs from git repositories"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue link <git-url>"),
      );
    });

    it("errors on missing git-url argument", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await link([]);

      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("git-url"),
      );
    });

    it("errors on invalid git URL format", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await link(["invalid-url"]);

      expect(exitSpy).toHaveBeenCalledWith(2);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("https://"),
      );
    });
  });

  describe("basic link operations", () => {
    it("links pack from git repository successfully", async () => {
      // Mock GitProvider
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-typescript"
  version: "1.0.0"
rules:
  - id: "org-typescript/prefer-const"
    severity: "MUST"
    description: "Use const for immutable variables"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      // Mock consent manager
      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        requestConsent: async () => true,
        hasConsent: () => true,
        revokeConsent: async () => {},
        getConsentStatus: () => ({ granted: true, timestamp: new Date() }),
      } as any);

      await link(["https://github.com/org/rules"]);

      expect(mockFetch).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✓ Linked successfully"),
      );
    });

    it("extracts pack metadata correctly", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "test-pack"
  version: "2.5.0"
rules:
  - id: "test-pack/rule1"
    severity: "SHOULD"
    description: "Test rule 1"
  - id: "test-pack/rule2"
    severity: "MAY"
    description: "Test rule 2"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/test/pack"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("test-pack-v2.5.0"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Rules: 2"),
      );
    });

    it("uses default vendor path when not specified", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/my-rules"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Location: vendor/my-rules"),
      );
    });

    it("uses custom vendor path when specified", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/rules", "--path", "lib/rules"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Location: lib/rules"),
      );
    });
  });

  describe("error cases", () => {
    it("errors when pack already vendored at path", async () => {
      // Create existing vendor directory with pack
      mkdirSync(VENDOR_DIR, { recursive: true });
      writeFileSync(
        join(VENDOR_DIR, ".aligntrue.yaml"),
        `
profile:
  id: "existing-pack"
  version: "1.0.0"
rules:
  - id: "existing-pack/rule1"
`,
      );

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Pack already vendored"),
      );
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("git rm -r"),
      );
    });

    it("errors when pack has invalid structure", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
invalid: yaml
no: profile
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await link(["https://github.com/org/rules"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Invalid pack"),
      );
    });

    it("handles network failure gracefully", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi
        .fn()
        .mockRejectedValue(new Error("Network connection failed"));

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await link(["https://github.com/org/rules"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining("Network connection failed"),
      );
    });
  });

  describe("team mode", () => {
    it("warns when source not in allow list (team mode)", async () => {
      // Set team mode config
      writeFileSync(
        CONFIG_PATH,
        `mode: team
agents:
  - cursor
`,
      );

      // Create allow list without this source
      writeFileSync(
        ALLOW_LIST_PATH,
        `version: 1
sources:
  - type: "id"
    value: "other-org/other-rules@1.0.0"
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/rules"]);

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Team mode warning"),
      );
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue team approve"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✓ Linked successfully"),
      );
    });

    it("does not warn in solo mode", async () => {
      // Solo mode (default)
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/rules"]);

      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("Team mode warning"),
      );
    });
  });

  describe("git submodule detection", () => {
    it("detects git submodule at vendor path", async () => {
      // Create .gitmodules file
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "vendor/test-rules"]
  path = vendor/test-rules
  url = https://github.com/org/rules
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git submodule"),
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git submodule update --remote"),
      );
    });

    it("does not false positive on non-submodule paths", async () => {
      // Create .gitmodules for different path
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "other/path"]
  path = other/path
  url = https://github.com/other/rules
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("git submodule detected"),
      );
    });

    it("shows appropriate update guidance for submodules", async () => {
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "vendor/test-rules"]
  path = vendor/test-rules
  url = https://github.com/org/rules
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(expect.stringContaining("ℹ️"));
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("To update:"),
      );
    });
  });

  describe("git subtree detection", () => {
    it("detects git subtree at vendor path", async () => {
      // Create vendor directory with .git (simulating subtree)
      mkdirSync(join(TEST_DIR, "vendor", "test-rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, "vendor", "test-rules", ".git"),
        "gitdir: ../.git",
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git subtree"),
      );
    });

    it("does not false positive when .git directory absent", async () => {
      // Vendor path exists but no .git directory
      mkdirSync(join(TEST_DIR, "vendor", "test-rules"), { recursive: true });

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("git subtree detected"),
      );
    });

    it("shows appropriate update guidance for subtrees", async () => {
      // Create vendor directory with .git (simulating subtree)
      mkdirSync(join(TEST_DIR, "vendor", "test-rules"), { recursive: true });
      writeFileSync(
        join(TEST_DIR, "vendor", "test-rules", ".git"),
        "gitdir: ../.git",
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git subtree pull"),
      );
    });
  });

  describe("manual git operations", () => {
    it("handles link without submodule setup", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/rules"]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Type: manual"),
      );
    });

    it("handles link without subtree setup", async () => {
      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link(["https://github.com/org/rules"]);

      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("git subtree"),
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("git submodule"),
      );
    });
  });

  describe("edge cases", () => {
    it("handles nested submodules correctly", async () => {
      // Create nested .gitmodules structure
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "vendor/test-rules"]
  path = vendor/test-rules
  url = https://github.com/org/rules

[submodule "vendor/test-rules/nested"]
  path = vendor/test-rules/nested
  url = https://github.com/org/nested
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git submodule"),
      );
    });

    it("handles Windows path separators in .gitmodules", async () => {
      // Windows-style path separators should still be detected
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "vendor/test-rules"]
  path = vendor\\test-rules
  url = https://github.com/org/rules
`,
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      // Note: We normalize to forward slashes in our detection logic
      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/test-rules",
      ]);

      // Should still detect even with Windows separators in .gitmodules
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("✓ Linked successfully"),
      );
    });

    it("handles mixed submodule and subtree strategies", async () => {
      // One submodule, one subtree in same workspace
      writeFileSync(
        join(TEST_DIR, ".gitmodules"),
        `[submodule "vendor/submodule-rules"]
  path = vendor/submodule-rules
  url = https://github.com/org/submodule
`,
      );

      // Create subtree directory
      mkdirSync(join(TEST_DIR, "vendor", "subtree-rules"), {
        recursive: true,
      });
      writeFileSync(
        join(TEST_DIR, "vendor", "subtree-rules", ".git"),
        "gitdir: ../.git",
      );

      const { GitProvider } = await import("@aligntrue/sources");
      const mockFetch = vi.fn().mockResolvedValue(`
profile:
  id: "org-rules"
rules:
  - id: "org-rules/rule1"
`);

      vi.mocked(GitProvider).mockImplementation(
        () =>
          ({
            fetch: mockFetch,
          }) as any,
      );

      const { createConsentManager } = await import("@aligntrue/core");
      vi.mocked(createConsentManager).mockReturnValue({
        needsConsent: () => false,
        hasConsent: () => true,
      } as any);

      // Link to the subtree path
      await link([
        "https://github.com/org/rules",
        "--path",
        "vendor/subtree-rules",
      ]);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("git subtree"),
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("git submodule"),
      );
    });
  });
});
