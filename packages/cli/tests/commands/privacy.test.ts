import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { privacyCommand as privacy } from "../../src/commands/privacy.js";
import { mockCommandArgs } from "../utils/command-test-helpers.js";
import * as clack from "@clack/prompts";

// Mock clack prompts
vi.mock("@clack/prompts", () => ({
  log: {
    info: vi.fn(),
    success: vi.fn(),
    message: vi.fn(),
    error: vi.fn(),
  },
  confirm: vi.fn(),
  isCancel: vi.fn(),
  cancel: vi.fn(),
  outro: vi.fn(),
}));

describe("privacy command", () => {
  const testDir = join(process.cwd(), "test-privacy-cli");
  const _consentFile = join(testDir, ".aligntrue", "privacy-consent.json");

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Change to test directory
    process.chdir(testDir);

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore directory
    process.chdir(join(testDir, ".."));

    // Clean up
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("help", () => {
    it("shows help with no args", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit: 0");
      });

      await privacy([]);

      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("Privacy consent management");
      expect(output).toContain("aligntrue privacy audit");
      expect(output).toContain("aligntrue privacy revoke");

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("shows help with --help flag", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
        throw new Error("process.exit: 0");
      });

      const args = mockCommandArgs({ help: true });
      await privacy(args);

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  describe("audit command", () => {
    it("shows message when no consents", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await privacy(["audit"]);

      expect(clack.log.info).toHaveBeenCalledWith(
        "No privacy consents granted yet",
      );
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("lists all granted consents", async () => {
      // Grant some consents first
      const { createConsentManager } = await import("@aligntrue/core");
      const manager = createConsentManager(
        join(testDir, ".aligntrue/privacy-consent.json"),
      );
      manager.grantConsent("catalog", "2025-10-29T10:00:00.000Z");
      manager.grantConsent("git", "2025-10-29T11:00:00.000Z");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await privacy(["audit"]);

      expect(clack.log.message).toHaveBeenCalledWith("Privacy Consents");
      expect(consoleSpy).toHaveBeenCalled();

      const output = consoleSpy.mock.calls.map((call) => call[0]).join("\n");
      expect(output).toContain("catalog");
      expect(output).toContain("git");
      expect(output).toContain("Granted");

      consoleSpy.mockRestore();
    });
  });

  describe("revoke command", () => {
    it("shows error when no operation specified", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await privacy(["revoke"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it("shows error for invalid operation", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await privacy(["revoke", "invalid"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });

    it("shows info when no consent to revoke", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await privacy(["revoke", "git"]);

      expect(clack.log.info).toHaveBeenCalledWith(
        "No consent for 'git' to revoke",
      );
      consoleSpy.mockRestore();
    });

    it("revokes specific operation", async () => {
      // Grant consent first
      const { createConsentManager } = await import("@aligntrue/core");
      const manager = createConsentManager(
        join(testDir, ".aligntrue/privacy-consent.json"),
      );
      manager.grantConsent("git");

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await privacy(["revoke", "git"]);

      expect(clack.log.success).toHaveBeenCalledWith(
        "Revoked consent for 'git'",
      );
      expect(manager.checkConsent("git")).toBe(false);

      consoleSpy.mockRestore();
    });

    it("revokes all consents when --all flag used", async () => {
      // Grant multiple consents
      const { createConsentManager } = await import("@aligntrue/core");
      const manager = createConsentManager(
        join(testDir, ".aligntrue/privacy-consent.json"),
      );
      manager.grantConsent("catalog");
      manager.grantConsent("git");

      // Mock confirm to return true
      vi.mocked(clack.confirm).mockResolvedValue(true);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await privacy(["revoke", "--all"]);

      expect(clack.confirm).toHaveBeenCalled();
      expect(clack.log.success).toHaveBeenCalledWith(
        "Revoked all consents (2)",
      );
      expect(manager.listConsents()).toHaveLength(0);

      consoleSpy.mockRestore();
    });

    it("handles cancelled revoke all", async () => {
      // Grant consent
      const { createConsentManager } = await import("@aligntrue/core");
      const manager = createConsentManager(
        join(testDir, ".aligntrue/privacy-consent.json"),
      );
      manager.grantConsent("catalog");

      // Mock confirm to return cancel
      vi.mocked(clack.confirm).mockResolvedValue(false);
      vi.mocked(clack.isCancel).mockReturnValue(false);

      await privacy(["revoke", "--all"]);

      expect(clack.cancel).toHaveBeenCalledWith("Revoke cancelled");
      expect(manager.checkConsent("catalog")).toBe(true); // Should still be granted
    });

    it("shows info when no consents to revoke with --all", async () => {
      await privacy(["revoke", "--all"]);

      expect(clack.log.info).toHaveBeenCalledWith("No consents to revoke");
    });
  });

  describe("unknown subcommand", () => {
    it("shows error for unknown subcommand", async () => {
      const exitSpy = vi
        .spyOn(process, "exit")
        .mockImplementation(() => undefined as never);

      await privacy(["unknown"]);

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });
});
