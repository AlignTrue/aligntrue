import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { enforceLockfile } from "../../src/lockfile/enforcer.js";
import type { LockfileValidationResult } from "../../src/lockfile/types.js";

describe("lockfile enforcer", () => {
  // Mock console methods
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const validResult: LockfileValidationResult = {
    valid: true,
    expectedHash: "sha256:abc123",
    actualHash: "sha256:abc123",
  };

  const invalidResult: LockfileValidationResult = {
    valid: false,
    expectedHash: "sha256:abc123def456789012345678901234567890",
    actualHash: "sha256:xyz789uvw0123456789012345678901234567",
  };

  describe("off mode", () => {
    it("always succeeds without validation", () => {
      const result = enforceLockfile("off", invalidResult);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("does not log anything", () => {
      enforceLockfile("off", validResult);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("soft mode", () => {
    it("succeeds when validation passes", () => {
      const result = enforceLockfile("soft", validResult);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain("passed");
    });

    it("warns but succeeds when validation fails", () => {
      const result = enforceLockfile("soft", invalidResult);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toBeDefined();
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it("logs warnings to stderr", () => {
      enforceLockfile("soft", invalidResult);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Lockfile drift detected"),
      );
    });

    it("suggests creating PR for team approval", () => {
      enforceLockfile("soft", invalidResult);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("PR"),
      );
    });

    it("does not call console.error", () => {
      enforceLockfile("soft", invalidResult);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });

  describe("strict mode", () => {
    it("succeeds when validation passes", () => {
      const result = enforceLockfile("strict", validResult);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.message).toContain("passed");
    });

    it("fails when validation fails", () => {
      const result = enforceLockfile("strict", invalidResult);

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.message).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("logs errors to stderr", () => {
      enforceLockfile("strict", invalidResult);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Lockfile validation failed"),
      );
    });

    it("aborts sync on failure", () => {
      enforceLockfile("strict", invalidResult);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Sync aborted"),
      );
    });

    it("suggests creating PR for team approval", () => {
      enforceLockfile("strict", invalidResult);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("PR"),
      );
    });

    it("does not call console.warn", () => {
      enforceLockfile("strict", invalidResult);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });

  describe("exit codes", () => {
    it("returns 0 for off mode", () => {
      const result = enforceLockfile("off", invalidResult);
      expect(result.exitCode).toBe(0);
    });

    it("returns 0 for soft mode", () => {
      const result = enforceLockfile("soft", invalidResult);
      expect(result.exitCode).toBe(0);
    });

    it("returns 0 for strict mode when valid", () => {
      const result = enforceLockfile("strict", validResult);
      expect(result.exitCode).toBe(0);
    });

    it("returns 1 for strict mode when invalid", () => {
      const result = enforceLockfile("strict", invalidResult);
      expect(result.exitCode).toBe(1);
    });
  });

  describe("message content", () => {
    it("includes hash comparison in message", () => {
      const result = enforceLockfile("soft", invalidResult);

      expect(result.message).toContain("Expected:");
      expect(result.message).toContain("Actual:");
    });
  });
});
