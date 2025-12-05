import { describe, it, expect } from "vitest";
import {
  validateLockfile,
  formatValidationResult,
} from "../../src/lockfile/validator.js";
import type {
  Lockfile,
  LockfileValidationResult,
} from "../../src/lockfile/types.js";

describe("lockfile validator", () => {
  describe("validateLockfile", () => {
    it("validates matching bundle hash", () => {
      const lockfile: Lockfile = {
        version: "2",
        bundle_hash: "sha256:abc123",
      };

      const result = validateLockfile(lockfile, "sha256:abc123");

      expect(result.valid).toBe(true);
      expect(result.expectedHash).toBe("sha256:abc123");
      expect(result.actualHash).toBe("sha256:abc123");
    });

    it("detects bundle hash mismatch", () => {
      const lockfile: Lockfile = {
        version: "2",
        bundle_hash: "sha256:abc123",
      };

      const result = validateLockfile(lockfile, "sha256:different");

      expect(result.valid).toBe(false);
      expect(result.expectedHash).toBe("sha256:abc123");
      expect(result.actualHash).toBe("sha256:different");
    });

    it("handles v1 lockfile format", () => {
      const lockfile: Lockfile = {
        version: "1",
        bundle_hash: "sha256:v1hash",
      };

      const result = validateLockfile(lockfile, "sha256:v1hash");

      expect(result.valid).toBe(true);
    });
  });

  describe("formatValidationResult", () => {
    it("formats success message", () => {
      const result: LockfileValidationResult = {
        valid: true,
        expectedHash: "sha256:abc",
        actualHash: "sha256:abc",
      };

      const message = formatValidationResult(result);

      expect(message).toContain("up to date");
    });

    it("formats drift message with hashes", () => {
      const result: LockfileValidationResult = {
        valid: false,
        expectedHash: "sha256:abc123def456789012345678901234567890",
        actualHash: "sha256:xyz789uvw0123456789012345678901234567",
      };

      const message = formatValidationResult(result);

      expect(message).toContain("drift detected");
      // Hash is truncated to 16 characters
      expect(message).toContain("Expected: sha256:abc123de");
      expect(message).toContain("Actual:   sha256:xyz789uv");
    });

    it("includes fix instructions", () => {
      const result: LockfileValidationResult = {
        valid: false,
        expectedHash: "sha256:old",
        actualHash: "sha256:new",
      };

      const message = formatValidationResult(result);

      expect(message).toContain("aligntrue sync");
      expect(message).toContain("git diff");
    });
  });
});
