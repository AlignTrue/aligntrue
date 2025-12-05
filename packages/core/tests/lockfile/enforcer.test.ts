import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkLockfileValidation,
  enforceLockfile,
} from "../../src/lockfile/enforcer.js";
import type { LockfileValidationResult } from "../../src/lockfile/types.js";

describe("lockfile enforcer", () => {
  // Mock console methods to ensure no output
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

  describe("checkLockfileValidation", () => {
    it("returns success when validation passes", () => {
      const result = checkLockfileValidation(validResult);

      expect(result.success).toBe(true);
      expect(result.message).toContain("up to date");
    });

    it("returns failure when validation fails", () => {
      const result = checkLockfileValidation(invalidResult);

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });

    it("does not log to console", () => {
      checkLockfileValidation(invalidResult);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it("includes hash comparison in failure message", () => {
      const result = checkLockfileValidation(invalidResult);

      expect(result.message).toContain("Expected:");
      expect(result.message).toContain("Actual:");
    });
  });

  describe("enforceLockfile (deprecated)", () => {
    it("ignores mode parameter and just validates", () => {
      // Mode is ignored - all modes now behave the same
      const offResult = enforceLockfile("off", invalidResult);
      const softResult = enforceLockfile("soft", invalidResult);
      const strictResult = enforceLockfile("strict", invalidResult);

      // All return the same validation result
      expect(offResult.success).toBe(false);
      expect(softResult.success).toBe(false);
      expect(strictResult.success).toBe(false);
    });

    it("succeeds when validation passes regardless of mode", () => {
      const offResult = enforceLockfile("off", validResult);
      const softResult = enforceLockfile("soft", validResult);
      const strictResult = enforceLockfile("strict", validResult);

      expect(offResult.success).toBe(true);
      expect(softResult.success).toBe(true);
      expect(strictResult.success).toBe(true);
    });

    it("does not log to console", () => {
      enforceLockfile("strict", invalidResult);

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
