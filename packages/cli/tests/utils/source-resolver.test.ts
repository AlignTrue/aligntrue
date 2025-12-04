import { describe, it, expect } from "vitest";
import { __normalizeFingerprintForTests } from "../../src/utils/source-resolver.js";

describe("normalizeFingerprint", () => {
  it("sanitizes to lowercase alphanumerics and hyphens", () => {
    const raw = "Aligns/Base/Base-Global";
    expect(__normalizeFingerprintForTests(raw)).toBe("aligns-base-base-global");
  });

  it("falls back to hash slice when sanitized value is empty", () => {
    const raw = "###";
    const result = __normalizeFingerprintForTests(raw);
    expect(result).toMatch(/^[a-f0-9]{16}$/);
  });
});
