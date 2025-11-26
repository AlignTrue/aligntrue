/**
 * Tests for provenance tracking in lockfile system
 */

import { describe, it, expect } from "vitest";
import type { Align } from "@aligntrue/schema";
import {
  generateLockfile,
  validateLockfile,
  formatValidationResult,
} from "../../src/lockfile/index.js";

describe("Lockfile Provenance Tracking", () => {
  describe("generateLockfile with full provenance", () => {
    it("includes all provenance fields when present", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
        sections: [
          {
            heading: "Rule One",
            level: 2,
            content: "Test rule one",
            fingerprint: "test-rule-one",
          },
          {
            heading: "Rule Two",
            level: 2,
            content: "Test rule two",
            fingerprint: "test-rule-two",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

      expect(lockfile.rules).toHaveLength(2);
      expect(lockfile.rules[0]).toMatchObject({
        rule_id: "test-rule-one",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
      });
      expect(lockfile.rules[0].content_hash).toBeTruthy();
      expect(lockfile.rules[1]).toMatchObject({
        rule_id: "test-rule-two",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123def456",
      });
    });

    it("handles partial provenance (only source)", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        sections: [
          {
            id: "test.rule.one",
            fingerprint: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

      expect(lockfile.rules[0]).toMatchObject({
        rule_id: "test.rule.one",
        source: "github.com/mycompany/rules",
      });
      expect(lockfile.rules[0].owner).toBeUndefined();
      expect(lockfile.rules[0].source_sha).toBeUndefined();
    });

    it("handles missing provenance (solo mode)", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            id: "test.rule.one",
            fingerprint: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

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
      const originalAlign: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        sections: [
          {
            id: "test.rule.one",
            fingerprint: "test.rule.one",
            severity: "error",
            guidance: "Original guidance",
          },
        ],
      };

      const lockfile = generateLockfile(originalAlign, "team");

      const modifiedAlign: Align = {
        ...originalAlign,
        sections: [
          {
            id: "test.rule.one",
            fingerprint: "test.rule.one",
            severity: "error",
            guidance: "Modified guidance",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedAlign);

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
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany/platform",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        sections: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");
      const validation = validateLockfile(lockfile, align);

      expect(validation.valid).toBe(true);
      expect(validation.mismatches).toHaveLength(0);
    });
  });

  describe("formatValidationResult with provenance", () => {
    it("displays provenance in mismatch error messages", () => {
      const originalAlign: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        owner: "aligntrue",
        source: "github.com/AlignTrue/aligns",
        source_sha: "abc123def456",
        sections: [
          {
            heading: "Base No Console",
            level: 2,
            content: "Original",
            fingerprint: "base-no-console",
          },
        ],
      };

      const lockfile = generateLockfile(originalAlign, "team");

      const modifiedAlign: Align = {
        ...originalAlign,
        sections: [
          {
            heading: "Base No Console",
            level: 2,
            content: "Modified",
            fingerprint: "base-no-console",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedAlign);
      const message = formatValidationResult(validation);

      expect(message).toContain("Lockfile validation failed");
      expect(message).toContain("base-no-console");
      expect(message).toContain("owner=aligntrue");
      expect(message).toContain("source=github.com/AlignTrue/aligns");
      expect(message).toContain("sha=abc123d"); // First 7 chars
      expect(message).toContain(
        "Rule content changed - review before proceeding",
      );
    });

    it("handles mismatches without provenance gracefully", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: [
          {
            heading: "Test Rule One",
            level: 2,
            content: "Original",
            fingerprint: "test-rule-one",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

      const modifiedAlign: Align = {
        ...align,
        sections: [
          {
            heading: "Test Rule One",
            level: 2,
            content: "Modified",
            fingerprint: "test-rule-one",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedAlign);
      const message = formatValidationResult(validation);

      expect(message).toContain("Lockfile validation failed");
      expect(message).toContain("test-rule-one");
      expect(message).not.toContain("owner=");
      expect(message).not.toContain("source=");
      expect(message).not.toContain("sha=");
    });

    it("displays partial provenance", () => {
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        sections: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Original",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

      const modifiedAlign: Align = {
        ...align,
        sections: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Modified",
          },
        ],
      };

      const validation = validateLockfile(lockfile, modifiedAlign);
      const message = formatValidationResult(validation);

      expect(message).toContain("source=github.com/mycompany/rules");
      expect(message).not.toContain("owner=");
      expect(message).not.toContain("sha=");
    });
  });

  describe("provenance stability", () => {
    it("same align produces same lockfile hashes regardless of provenance", () => {
      const baseRules = [
        {
          id: "test.rule.one",
          severity: "error" as const,
          guidance: "Test rule",
        },
      ];

      const alignWithProvenance: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        owner: "mycompany",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        sections: baseRules,
      };

      const alignWithoutProvenance: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        sections: baseRules,
      };

      const lockfile1 = generateLockfile(alignWithProvenance, "team");
      const lockfile2 = generateLockfile(alignWithoutProvenance, "team");

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
      const align: Align = {
        id: "test-align",
        version: "1.0.0",
        spec_version: "1",
        source: "github.com/mycompany/rules",
        source_sha: "abc123",
        sections: [
          {
            id: "test.rule.one",
            severity: "error",
            guidance: "Test rule",
          },
        ],
      };

      const lockfile = generateLockfile(align, "team");

      // Same content, different SHA (e.g., rebase/cherry-pick)
      const alignWithNewSha: Align = {
        ...align,
        source_sha: "def456",
      };

      // Content hash matches (same rule content)
      const validation = validateLockfile(lockfile, alignWithNewSha);
      expect(validation.valid).toBe(true); // Content didn't change

      // But we can see SHA changed in lockfile entry provenance
      const newLockfile = generateLockfile(alignWithNewSha, "team");
      expect(newLockfile.rules[0].source_sha).toBe("def456");
      expect(lockfile.rules[0].source_sha).toBe("abc123");
    });
  });
});
