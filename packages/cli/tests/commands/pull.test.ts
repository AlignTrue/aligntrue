/**
 * Tests for pull command
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as clack from "@clack/prompts";

// Mock dependencies
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));
vi.mock("@aligntrue/markdown-parser", () => ({
  parseMarkdown: vi.fn(),
  buildIR: vi.fn(),
}));
vi.mock("@aligntrue/sources", () => ({
  GitProvider: vi.fn(),
}));
vi.mock("@aligntrue/core", () => ({
  createConsentManager: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
    rules: `${cwd}/.aligntrue/rules.md`,
    lockfile: `${cwd}/.aligntrue.lock.json`,
    bundle: `${cwd}/.aligntrue.bundle.yaml`,
    cursorRules: (scope: string) => `${cwd}/.cursor/rules/${scope}.mdc`,
    agentsMd: () => `${cwd}/AGENTS.md`,
    vscodeMcp: () => `${cwd}/.vscode/mcp.json`,
    cache: (type: string) => `${cwd}/.aligntrue/.cache/${type}`,
    privacyConsent: () => `${cwd}/.aligntrue/privacy-consent.json`,
    telemetryEvents: () => `${cwd}/.aligntrue/telemetry-events.json`,
    aligntrueDir: `${cwd}/.aligntrue`,
    exporterOutput: (exporterName: string, filename: string) =>
      `${cwd}/${filename}`,
  })),
}));

import { pull } from "../../src/commands/pull.js";
import { GitProvider } from "@aligntrue/sources";
import { createConsentManager, loadConfig, saveConfig } from "@aligntrue/core";
import { parseMarkdown, buildIR } from "@aligntrue/markdown-parser";

describe("pull command", () => {
  let mockGitProvider: unknown;
  let mockConsentManager: unknown;
  let mockLoadConfig: unknown;
  let mockSaveConfig: unknown;
  let mockParseMarkdown: unknown;
  let mockBuildIR: unknown;
  let mockSpinner: unknown;
  let consoleLogSpy: unknown;
  let consoleErrorSpy: unknown;
  let processExitSpy: unknown;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock clack
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
    };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner);
    vi.mocked(clack.intro).mockImplementation(vi.fn());
    vi.mocked(clack.outro).mockImplementation(vi.fn());
    vi.mocked(clack.log.error).mockImplementation(vi.fn());
    vi.mocked(clack.log.success).mockImplementation(vi.fn());
    vi.mocked(clack.log.warn).mockImplementation(vi.fn());
    vi.mocked(clack.log.step).mockImplementation(vi.fn());
    vi.mocked(clack.confirm).mockResolvedValue(true);
    vi.mocked(clack.isCancel).mockReturnValue(false);

    // Mock GitProvider
    mockGitProvider = {
      fetch: vi.fn().mockResolvedValue("# Rules\nrules: []"),
    };
    vi.mocked(GitProvider).mockImplementation(function (this: unknown) {
      return mockGitProvider;
    } as new () => typeof mockGitProvider);

    // Mock ConsentManager
    mockConsentManager = {
      checkConsent: vi.fn(() => true),
      grantConsent: vi.fn(),
    };
    vi.mocked(createConsentManager).mockReturnValue(mockConsentManager as any);

    // Mock config functions
    mockLoadConfig = vi.mocked(loadConfig);
    mockSaveConfig = vi.mocked(saveConfig);

    // Mock parseIR
    mockParseMarkdown = vi.mocked(parseMarkdown);
    mockParseMarkdown.mockReturnValue({
      blocks: [],
      errors: [],
    } as any);

    mockBuildIR = vi.mocked(buildIR);
    mockBuildIR.mockReturnValue({
      document: {
        id: "test-profile",
        version: "1.0.0",
        spec_version: "1",
        rules: [{ id: "rule1" }, { id: "rule2" }],
      },
      errors: [],
    } as any);

    // Mock console
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Default: config exists and loads successfully
    mockLoadConfig.mockResolvedValue({
      mode: "solo",
      version: "1",
      performance: { max_file_size_mb: 10 },
    } as any);

    // Default git fetch is already mocked above
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("help and validation", () => {
    it("should show help when --help flag provided", async () => {
      await pull(["--help"]);
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should error when no URL provided", async () => {
      await pull([]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should validate ref format (no spaces)", async () => {
      await pull([
        "https://github.com/test/repo",
        "--ref",
        "invalid ref with spaces",
      ]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should validate ref format (max length)", async () => {
      const longRef = "a".repeat(201);
      await pull(["https://github.com/test/repo", "--ref", longRef]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should error when --sync used without --save", async () => {
      await pull(["https://github.com/test/repo", "--sync"]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should error when --dry-run used with --save", async () => {
      await pull(["https://github.com/test/repo", "--dry-run", "--save"]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("should error when --dry-run used with --sync", async () => {
      await pull(["https://github.com/test/repo", "--dry-run", "--sync"]);
      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("basic pull", () => {
    it("should pull from valid git URL", async () => {
      mockGitProvider.fetch.mockResolvedValue("rules:\n  - id: test");

      await pull(["https://github.com/test/repo"]);

      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockGitProvider.fetch).toHaveBeenCalled();
      expect(mockParseMarkdown).toHaveBeenCalled();
      expect(mockBuildIR).toHaveBeenCalled();
      expect(mockSpinner.stop).toHaveBeenCalled();
      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining("temporary"),
      );
    });

    it("should display pull results with rule count", async () => {
      await pull(["https://github.com/test/repo"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Pull results"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Rules: 2"),
      );
    });

    it("should display profile ID when present", async () => {
      await pull(["https://github.com/test/repo"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Profile: test-profile"),
      );
    });

    it("should use default ref (main) when not specified", async () => {
      await pull(["https://github.com/test/repo"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "main" }),
        expect.any(String),
        expect.any(Object),
      );
    });

    it("should use custom ref when specified", async () => {
      await pull(["https://github.com/test/repo", "--ref", "v1.2.0"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.objectContaining({ ref: "v1.2.0" }),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  describe("flags", () => {
    it("should save to config when --save flag used", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        version: "1",
        sources: [],
      } as any);

      await pull(["https://github.com/test/repo", "--save"]);

      expect(mockSaveConfig).toHaveBeenCalled();
      const savedConfig = mockSaveConfig.mock.calls[0][0]; // First argument is config
      expect(savedConfig.sources).toHaveLength(1);
      expect(savedConfig.sources[0]).toMatchObject({
        type: "git",
        url: "https://github.com/test/repo",
        ref: "main",
      });
      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining("saved to config"),
      );
    });

    it("should not duplicate existing source in config", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        version: "1",
        sources: [
          {
            type: "git",
            url: "https://github.com/test/repo",
            ref: "main",
          },
        ],
      } as any);

      await pull(["https://github.com/test/repo", "--save"]);

      expect(clack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("already in config"),
      );
    });

    it("should handle --sync flag with --save", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        version: "1",
        sources: [],
      } as any);

      // Mock sync command to prevent execution
      const syncMock = vi.fn();
      vi.doMock("../../src/commands/sync.js", () => ({
        sync: syncMock,
      }));

      await pull(["https://github.com/test/repo", "--save", "--sync"]);

      expect(mockSaveConfig).toHaveBeenCalled();
      expect(clack.log.step).toHaveBeenCalledWith(
        expect.stringContaining("sync"),
      );
    });

    it("should show dry-run preview without pulling", async () => {
      await pull(["https://github.com/test/repo", "--dry-run"]);

      expect(mockGitProvider.fetch).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Dry run preview"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Would pull"),
      );
      expect(clack.outro).toHaveBeenCalledWith(
        expect.stringContaining("Dry run complete"),
      );
    });

    it("should use offline mode when --offline flag provided", async () => {
      await pull(["https://github.com/test/repo", "--offline"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ offlineMode: true }),
      );
    });

    it("should use custom config path when --config flag provided", async () => {
      const customConfigPath = ".aligntrue/custom-config.yaml";
      mockLoadConfig.mockResolvedValue({
        mode: "team",
        version: "1",
      } as any);

      await pull([
        "https://github.com/test/repo",
        "--config",
        customConfigPath,
      ]);

      expect(mockLoadConfig).toHaveBeenCalledWith(customConfigPath);
    });
  });

  describe("privacy consent", () => {
    it("should check consent before pulling", async () => {
      mockConsentManager.checkConsent.mockReturnValue(true);

      await pull(["https://github.com/test/repo"]);

      expect(mockConsentManager.checkConsent).toHaveBeenCalledWith("git");
    });

    it("should prompt for consent when not granted", async () => {
      mockConsentManager.checkConsent.mockReturnValue(false);
      vi.mocked(clack.confirm).mockResolvedValue(true);

      await pull(["https://github.com/test/repo"]);

      expect(clack.confirm).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("consent"),
        }),
      );
      expect(mockConsentManager.grantConsent).toHaveBeenCalledWith("git");
    });

    it("should error when consent denied", async () => {
      mockConsentManager.checkConsent.mockReturnValue(false);
      vi.mocked(clack.confirm).mockResolvedValue(false);

      await pull(["https://github.com/test/repo"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("consent"),
      );
    });

    it("should error when consent cancelled", async () => {
      mockConsentManager.checkConsent.mockReturnValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(true);

      await pull(["https://github.com/test/repo"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it("should skip consent check in offline mode", async () => {
      mockConsentManager.checkConsent.mockReturnValue(false);

      await pull(["https://github.com/test/repo", "--offline"]);

      expect(clack.confirm).not.toHaveBeenCalled();
      expect(mockGitProvider.fetch).toHaveBeenCalled();
    });

    it("should skip consent check when already granted", async () => {
      mockConsentManager.checkConsent.mockReturnValue(true);

      await pull(["https://github.com/test/repo"]);

      expect(clack.confirm).not.toHaveBeenCalled();
      expect(mockGitProvider.fetch).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle invalid URL error", async () => {
      mockGitProvider.fetch.mockRejectedValue(new Error("Invalid git URL"));

      await pull(["https://invalid-url"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid git URL"),
      );
    });

    it("should handle network failure", async () => {
      mockGitProvider.fetch.mockRejectedValue(
        new Error("Network error: Connection refused"),
      );

      await pull(["https://github.com/test/repo"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Network error"),
      );
    });

    it("should handle missing rules file", async () => {
      mockGitProvider.fetch.mockRejectedValue(
        new Error("File not found: .aligntrue.yaml"),
      );

      await pull(["https://github.com/test/repo"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("File not found"),
      );
    });

    it("should handle parse error", async () => {
      mockParseMarkdown.mockImplementation(() => {
        throw new Error("Invalid YAML syntax");
      });

      await pull(["https://github.com/test/repo"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Invalid YAML"),
      );
    });

    it("should handle config save error when using --save", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        version: "1",
        sources: [],
      } as any);
      mockSaveConfig.mockRejectedValue(new Error("Permission denied"));

      await pull(["https://github.com/test/repo", "--save"]);

      expect(processExitSpy).toHaveBeenCalledWith(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Permission denied"),
      );
    });

    it("should warn when config missing but continue pull", async () => {
      mockLoadConfig.mockRejectedValue(new Error("Config not found"));

      await pull(["https://github.com/test/repo"]);

      expect(clack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining("Config not found"),
      );
      expect(mockGitProvider.fetch).toHaveBeenCalled();
    });

    it("should stop spinner on error", async () => {
      mockGitProvider.fetch.mockRejectedValue(new Error("Test error"));

      await pull(["https://github.com/test/repo"]);

      expect(mockSpinner.stop).toHaveBeenCalledWith("✗ Pull failed");
    });
  });

  describe("integration", () => {
    it("should pass mode from config to GitProvider", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "team",
        version: "1",
      } as any);

      await pull(["https://github.com/test/repo"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ mode: "team" }),
      );
    });

    it("should pass performance settings from config to GitProvider", async () => {
      mockLoadConfig.mockResolvedValue({
        mode: "solo",
        version: "1",
        performance: { max_file_size_mb: 20 },
      } as any);

      await pull(["https://github.com/test/repo"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ maxFileSizeMb: 20 }),
      );
    });

    it("should create GitProvider with correct cache directory", async () => {
      await pull(["https://github.com/test/repo"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.any(Object),
        ".aligntrue/.cache/git",
        expect.any(Object),
      );
    });

    it("should pass consent manager to GitProvider", async () => {
      await pull(["https://github.com/test/repo"]);

      expect(GitProvider).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(String),
        expect.objectContaining({ consentManager: mockConsentManager }),
      );
    });
  });
});
