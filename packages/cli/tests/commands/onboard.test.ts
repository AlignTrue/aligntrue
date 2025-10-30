/**
 * Tests for onboard command
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import * as clack from "@clack/prompts";
import { onboard } from "../../src/commands/onboard.js";
import { loadConfig, detectDriftForConfig } from "@aligntrue/core";
import { load } from "js-yaml";

// Mock dependencies
vi.mock("child_process");
vi.mock("fs");
vi.mock("@clack/prompts");
vi.mock("@aligntrue/core/telemetry/collector.js", () => ({
  recordEvent: vi.fn(),
}));
vi.mock("@aligntrue/core", () => ({
  loadConfig: vi.fn(),
  detectDriftForConfig: vi.fn(),
  getAlignTruePaths: vi.fn((cwd = process.cwd()) => ({
    config: `${cwd}/.aligntrue/config.yaml`,
  })),
}));
vi.mock("js-yaml", () => ({
  load: vi.fn(),
}));

describe("onboard command", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: ReturnType<typeof vi.spyOn>;
  let mockSpinner: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock console
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock process.exit
    processExitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Mock clack
    mockSpinner = {
      start: vi.fn(),
      stop: vi.fn(),
    };
    vi.mocked(clack.spinner).mockReturnValue(mockSpinner);
    vi.mocked(clack.intro).mockImplementation(vi.fn());
    vi.mocked(clack.outro).mockImplementation(vi.fn());
    vi.mocked(clack.cancel).mockImplementation(vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("help and arg parsing", () => {
    it("should show help with --help flag", async () => {
      await onboard(["--help"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("onboard"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Generate personalized onboarding checklist"),
      );
    });

    it("should show help with -h alias", async () => {
      await onboard(["-h"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("onboard"),
      );
    });
  });

  describe("git history analysis", () => {
    it("should handle git repo with commits", async () => {
      // Mock git commands - return strings when encoding specified
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|feat: Add feature|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git diff-tree")) {
          return hasEncoding
            ? "src/file1.ts\nsrc/file2.test.ts"
            : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer Onboarding Checklist"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("feat: Add feature"),
      );
    });

    it("should handle non-git directory", async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("not a git repo");
      });

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer Onboarding Checklist"),
      );
    });

    it("should detect uncommitted changes", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|feat: Test|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding
            ? " M src/file.ts\n?? new-file.ts"
            : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Uncommitted changes detected"),
      );
    });
  });

  describe("checklist generation", () => {
    it("should suggest running tests when test files modified", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|test: Add tests|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git diff-tree")) {
          return hasEncoding
            ? "src/file.test.ts\nsrc/another.spec.ts"
            : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Run tests"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("2 test files modified"),
      );
    });

    it("should warn about source changes without tests", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|feat: Add logic|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git diff-tree")) {
          return hasEncoding ? "src/file1.ts\nsrc/file2.ts" : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Source files modified without test updates"),
      );
    });

    it("should note documentation updates", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|docs: Update|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git diff-tree")) {
          return hasEncoding ? "docs/guide.md\ndocs/api.md" : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Documentation updated"),
      );
    });

    it("should provide default checklist when no specific patterns", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|chore: Config|Dev|2025-10-30"
            : Buffer.from("");
        }
        if (cmd.includes("git diff-tree")) {
          return hasEncoding ? "package.json" : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Run validation checks"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("aligntrue check"),
      );
    });
  });

  describe("CI integration", () => {
    beforeEach(() => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|fix: Bug|Dev|2025-10-30"
            : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });
    });

    it("should parse SARIF file when --ci provided", async () => {
      const sarifContent = {
        runs: [
          {
            results: [
              { message: { text: "Check failed" }, level: "error" },
              { message: { text: "Warning found" }, level: "warning" },
            ],
          },
        ],
      };

      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(sarifContent));

      await onboard(["--ci", "sarif.json"]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("1 check failed"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("1 warning from checks"),
      );
    });

    it("should handle missing SARIF file gracefully", async () => {
      vi.mocked(existsSync).mockReturnValue(false);

      await onboard(["--ci", "missing.json"]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should handle invalid SARIF format", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("invalid json{");

      await onboard(["--ci", "invalid.json"]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("error handling", () => {
    it("should handle git command failures gracefully", async () => {
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("git command failed");
      });

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Developer Onboarding Checklist"),
      );
    });

    it("should handle empty git log", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          return hasEncoding ? "" : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    it("should handle git status failures", async () => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";

        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding ? "abc123|test|dev|2025-10-30" : Buffer.from("");
        }
        if (cmd.includes("git status --porcelain")) {
          throw new Error("status failed");
        }
        return hasEncoding ? "" : Buffer.from("");
      });

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe("integrations", () => {
    beforeEach(() => {
      vi.mocked(execSync).mockImplementation((cmd: any, options?: any) => {
        const hasEncoding = options?.encoding === "utf-8";
        if (cmd === "git rev-parse --git-dir") {
          return hasEncoding ? "" : Buffer.from("");
        }
        if (cmd.includes("git log -1")) {
          return hasEncoding
            ? "abc123|feat: Test|Dev|2025-10-30"
            : Buffer.from("");
        }
        return hasEncoding ? "" : Buffer.from("");
      });
    });

    it("should show drift info in team mode with drift", async () => {
      vi.mocked(loadConfig).mockResolvedValue({ mode: "team" } as any);
      vi.mocked(detectDriftForConfig).mockResolvedValue({
        success: true,
        drift: [{ source_id: "test", status: "upstream", message: "drift" }],
      } as any);

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Team drift detected"),
      );
    });

    it("should not show drift info in solo mode", async () => {
      vi.mocked(loadConfig).mockResolvedValue({ mode: "solo" } as any);

      await onboard([]);

      expect(consoleLogSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("Team drift"),
      );
    });

    it("should show unresolved plugs", async () => {
      vi.mocked(loadConfig).mockResolvedValue({ mode: "solo" } as any);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("plugs: {}");
      vi.mocked(load).mockReturnValue({
        plugs: {
          slots: {
            "my.tool": { required: true, format: "command" },
          },
          fills: {},
        },
      } as any);

      await onboard([]);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("unresolved plug"),
      );
    });

    it("should handle no plugs gracefully", async () => {
      vi.mocked(loadConfig).mockResolvedValue({ mode: "solo" } as any);
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue("rules: []");
      vi.mocked(load).mockReturnValue({ rules: [] } as any);

      await onboard([]);

      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });
});
