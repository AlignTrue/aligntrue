/**
 * Tests for provenance tracking in lockfile system
 */

import { describe, it, expect } from "vitest";
import type { AlignPack } from "@aligntrue/schema";
import {
  generateLockfile,
  validateLockfile,
  formatValidationResult,
} from "../../src/lockfile/index.js";

describe("Lockfile Provenance Tracking", () => {
  describe("generateLockfile with full provenance", () => {
    it("includes all provenance fields when present", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule one",
          },
          {
            id: "test.rule.two",
            severity: "warn",
            guidance: "Test rule two",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules).toHaveLength(2);
      expect(lockfile.rules[0]).toMatchObject({
        rule_id: "test.rule.one",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
      });
      expect(lockfile.rules[0].content_hash).toBeTruthy();
      expect(lockfile.rules[1]).toMatchObject({
        rule_id: "test.rule.two",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
      });
    });

    it("handles partial provenance (only source)", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules[0]).toMatchObject({
        rule_id: "test.rule.one",
        source: "github.com/mycompany/rules",
      });
      expect(lockfile.rules[0].owner).toBeUndefined();
      expect(lockfile.rules[0].source_sha).toBeUndefined();
    });

    it("handles missing provenance (solo mode)", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      expect(lockfile.rules[0]).toMatchObject({
        rule_id: "test.rule.one",
      });
      expect(lockfile.rules[0].owner).toBeUndefined();
      expect(lockfile.rules[0].source).toBeUndefined();
      expect(lockfile.rules[0].source_sha).toBeUndefined();
      expect(lockfile.rules[0].content_hash).toBeTruthy();
    });
  });

  describe("validateLockfile with provenance", () => {
    it("includes provenance in mismatch details", () => {
      const originalPack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Original guidance",
          },
        ],
      };

      const lockfile = generateLockfile(originalPack, "team");

      const modifiedPack: AlignPack = {
        ...originalPack,
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Modified guidance",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedPack);

      expect(validation.valid).toBe(false);
      expect(validation.mismatches).toHaveLength(1);
      expect(validation.mismatches[0]).toMatchObject({
        rule_id: "test.rule.one",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
      });
      expect(validation.mismatches[0].expected_hash).toBeTruthy();
      expect(validation.mismatches[0].actual_hash).toBeTruthy();
      expect(validation.mismatches[0].expected_hash).not.toBe(
        validation.mismatches[0].actual_hash,
      );
    });

    it("validates successfully with matching provenance", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");
      const validation = validateLockfile(lockfile, pack);

      expect(validation.valid).toBe(true);
      expect(validation.mismatches).toHaveLength(0);
    });
  });

  describe("formatValidationResult with provenance", () => {
    it("displays provenance in mismatch error messages", () => {
      const originalPack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        owner: "aligntrue",
        source: "github.com/AlignTrue/aligns",
        source_sha: "abc123def456",
        rules: [
          {
            id: "base.no.console",
            severity: "error",
            guidance: "Original",
          },
        ],
      };

      const lockfile = generateLockfile(originalPack, "team");

      const modifiedPack: AlignPack = {
        ...originalPack,
        rules: [
          {
            id: "base.no.console",
            severity: "error",
            guidance: "Modified",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedPack);
      const message = formatValidationResult(validation);

      expect(message).toContain("Lockfile validation failed");
      expect(message).toContain("base.no.console");
      expect(message).toContain("owner=aligntrue");
      expect(message).toContain("source=github.com/AlignTrue/aligns");
      expect(message).toContain("sha=abc123d"); // First 7 chars
      expect(message).toContain(
        "Rule content changed - review before proceeding",
      );
    });

    it("handles mismatches without provenance gracefully", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Original",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      const modifiedPack: AlignPack = {
        ...pack,
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Modified",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedPack);
      const message = formatValidationResult(validation);

      expect(message).toContain("Lockfile validation failed");
      expect(message).toContain("test.rule.one");
      expect(message).not.toContain("owner=");
      expect(message).not.toContain("source=");
      expect(message).not.toContain("sha=");
    });

    it("displays partial provenance", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Original",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      const modifiedPack: AlignPack = {
        ...pack,
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Modified",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedPack);
      const message = formatValidationResult(validation);

      expect(message).toContain("source=github.com/mycompany/rules");
      expect(message).not.toContain("owner=");
      expect(message).not.toContain("sha=");
    });
  });

  describe("provenance stability", () => {
    it("same pack produces same lockfile hashes regardless of provenance", () => {
      const baseRules = [
        {
          id: "test.rule.one",
          severity: "error" as const,
          guidance: "Test rule",
        },
      ];

      const packWithProvenance: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        rules: baseRules,
      };

      const packWithoutProvenance: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        rules: baseRules,
      };

      const lockfile1 = generateLockfile(packWithProvenance, "team");
      const lockfile2 = generateLockfile(packWithoutProvenance, "team");

      // Content hashes should match (provenance not part of hash)
      expect(lockfile1.rules[0].content_hash).toBe(
        lockfile2.rules[0].content_hash,
      );

      // But provenance fields should differ
      expect(lockfile1.rules[0].owner).toBe("mycompany");
      expect(lockfile2.rules[0].owner).toBeUndefined();
    });
  });

  describe("provenance change detection", () => {
    it("detects source_sha changes even with same content", () => {
      const pack: AlignPack = {
        id: "test-pack",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        rules: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(pack, "team");

      // Same content, different SHA (e.g., rebase/cherry-pick)
      const packWithNewSha: AlignPack = {
        ...pack,
        source_sha: "def456",
      };

      // Content hash matches (same rule content)
      const validation = validateLockfile(lockfile, packWithNewSha);
      expect(validation.valid).toBe(true); // Content didn't change

      // But we can see SHA changed in lockfile entry provenance
      const newLockfile = generateLockfile(packWithNewSha, "team");
      expect(newLockfile.rules[0].source_sha).toBe("def456");
      expect(lockfile.rules[0].source_sha).toBe("abc123");
    });
  });
});
