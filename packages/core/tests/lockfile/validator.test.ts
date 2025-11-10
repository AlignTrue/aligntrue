import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  validateLockfile,
  formatValidationResult,
  validateAgainstAllowList,
  checkDriftFromAllowedHashes,
  validateLockfileTeamMode,
  formatLockfileTeamErrors,
} from "../../src/lockfile/validator.js";
import { generateLockfile } from "../../src/lockfile/generator.js";
import type { AlignPack, AlignSection, AlignSection } from "@aligntrue/schema";
import type { Lockfile } from "../../src/lockfile/types.js";
import * as fs from "fs";

// Mock filesystem - preserve real readFileSync for schema files
const _realFs = await import("fs");
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

// Mock allow list parser
vi.mock("../../src/team/allow.js", () => ({
  parseAllowList: vi.fn(),
}));

describe("lockfile validator", () => {
  const mockRule: AlignSection = {
    heading: "Test Rule One",
    level: 2,
    content: "Test rule guidance",
    fingerprint: "test-rule-one",
  };

  const mockPack: AlignPack = {
    id: "test.pack",
    version: "1.0.0",
    spec_version: "1",
    summary: "Test pack",
    owner: "test-org",
    source: "https://github.com/test-org/aligns",
    source_sha: "abc123",
    sections: [mockRule],
  };

  describe("validateLockfile", () => {
    it("validates matching lockfile", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const result = validateLockfile(lockfile, mockPack);

      expect(result.valid).toBe(true);
      expect(result.mismatches).toHaveLength(0);
      expect(result.newRules).toHaveLength(0);
      expect(result.deletedRules).toHaveLength(0);
    });

    it("detects modified rules", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const modifiedPack: AlignPack = {
        ...mockPack,
        sections: [{ ...mockRule, guidance: "Modified guidance" }],
      };

      const result = validateLockfile(lockfile, modifiedPack);

      expect(result.valid).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].rule_id).toBe("test.rule.one");
      expect(result.mismatches[0].expected_hash).toBeDefined();
      expect(result.mismatches[0].actual_hash).toBeDefined();
      expect(result.mismatches[0].expected_hash).not.toBe(
        result.mismatches[0].actual_hash,
      );
    });

    it("detects new rules", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const packWithNewRule: AlignPack = {
        ...mockPack,
        sections: [mockRule, { ...mockRule, id: "test.rule.new" }],
      };

      const result = validateLockfile(lockfile, packWithNewRule);

      expect(result.valid).toBe(false);
      expect(result.newRules).toHaveLength(1);
      expect(result.newRules[0]).toBe("test.rule.new");
    });

    it("detects deleted rules", () => {
      const packWithTwoRules: AlignPack = {
        ...mockPack,
        sections: [mockRule, { ...mockRule, id: "test.rule.deleted" }],
      };
      const lockfile = generateLockfile(packWithTwoRules, "team");

      const result = validateLockfile(lockfile, mockPack);

      expect(result.valid).toBe(false);
      expect(result.deletedRules).toHaveLength(1);
      expect(result.deletedRules[0]).toBe("test.rule.deleted");
    });

    it("detects multiple types of changes", () => {
      const originalPack: AlignPack = {
        ...mockPack,
        sections: [
          { ...mockRule, id: "test.rule.one" },
          { ...mockRule, id: "test.rule.two" },
        ],
      };
      const lockfile = generateLockfile(originalPack, "team");

      const modifiedPack: AlignPack = {
        ...mockPack,
        sections: [
          { ...mockRule, id: "test.rule.one", guidance: "Modified" }, // Modified
          { ...mockRule, id: "test.rule.three" }, // New
          // test.rule.two is deleted
        ],
      };

      const result = validateLockfile(lockfile, modifiedPack);

      expect(result.valid).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].rule_id).toBe("test.rule.one");
      expect(result.newRules).toHaveLength(1);
      expect(result.newRules[0]).toBe("test.rule.three");
      expect(result.deletedRules).toHaveLength(1);
      expect(result.deletedRules[0]).toBe("test.rule.two");
    });

    it("handles empty rule arrays", () => {
      const emptyPack: AlignPack = { ...mockPack, sections: [] };
      const lockfile = generateLockfile(emptyPack, "team");

      const result = validateLockfile(lockfile, emptyPack);

      expect(result.valid).toBe(true);
      expect(result.mismatches).toHaveLength(0);
      expect(result.newRules).toHaveLength(0);
      expect(result.deletedRules).toHaveLength(0);
    });

    it("includes source in mismatch info", () => {
      const lockfile = generateLockfile(mockPack, "team");
      const modifiedPack: AlignPack = {
        ...mockPack,
        sections: [{ ...mockRule, guidance: "Modified" }],
      };

      const result = validateLockfile(lockfile, modifiedPack);

      expect(result.mismatches[0].source).toBe(
        "https://github.com/test-org/aligns",
      );
    });
  });

  describe("formatValidationResult", () => {
    it("formats success message", () => {
      const result = {
        valid: true,
        mismatches: [],
        newRules: [],
        deletedRules: [],
      };

      const message = formatValidationResult(result);

      expect(message).toContain("up to date");
    });

    it("formats modified rules", () => {
      const result = {
        valid: false,
        mismatches: [
          {
            rule_id: "test.rule.one",
            expected_hash: "1234567890abcdef",
            actual_hash: "fedcba0987654321",
          },
        ],
        newRules: [],
        deletedRules: [],
      };

      const message = formatValidationResult(result);

      expect(message).toContain("Modified rules");
      expect(message).toContain("test.rule.one");
      expect(message).toContain("Expected: 1234567890ab");
      expect(message).toContain("Actual:   fedcba098765");
    });

    it("formats new rules", () => {
      const result = {
        valid: false,
        mismatches: [],
        newRules: ["test.rule.new"],
        deletedRules: [],
      };

      const message = formatValidationResult(result);

      expect(message).toContain("New rules");
      expect(message).toContain("+ test.rule.new");
    });

    it("formats deleted rules", () => {
      const result = {
        valid: false,
        mismatches: [],
        newRules: [],
        deletedRules: ["test.rule.deleted"],
      };

      const message = formatValidationResult(result);

      expect(message).toContain("Deleted rules");
      expect(message).toContain("- test.rule.deleted");
    });

    it("formats multiple changes", () => {
      const result = {
        valid: false,
        mismatches: [
          {
            rule_id: "test.rule.modified",
            expected_hash: "1234",
            actual_hash: "5678",
          },
        ],
        newRules: ["test.rule.new"],
        deletedRules: ["test.rule.deleted"],
      };

      const message = formatValidationResult(result);

      expect(message).toContain("Modified rules");
      expect(message).toContain("New rules");
      expect(message).toContain("Deleted rules");
    });
  });

  describe("validateAgainstAllowList", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns empty array for solo mode", () => {
      const lockfile = generateLockfile(mockPack, "solo");
      const errors = validateAgainstAllowList(lockfile, "solo");
      expect(errors).toEqual([]);
    });

    it("warns when no allow list exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const lockfile = generateLockfile(mockPack, "team");
      const errors = validateAgainstAllowList(lockfile, "team");

      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe("warning");
      expect(errors[0]?.message).toContain("No allow list");
    });

    it("returns error when allow list parse fails", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = validateAgainstAllowList(lockfile, "team");

      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe("error");
      expect(errors[0]?.message).toContain("Failed to parse");
    });

    it("warns when allow list is empty", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({ sources: [] });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = validateAgainstAllowList(lockfile, "team");

      expect(errors).toHaveLength(1);
      expect(errors[0]?.type).toBe("warning");
      expect(errors[0]?.message).toContain("empty");
    });

    it("returns error when source not in allow list", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [{ type: "hash", value: "sha256:different..." }],
      });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = validateAgainstAllowList(lockfile, "team");

      expect(errors.length).toBeGreaterThan(0);
      const sourceError = errors.find((e) =>
        e.message.includes("not in allow list"),
      );
      expect(sourceError?.type).toBe("error");
    });

    it("passes when source is in allow list", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [{ type: "id", value: mockPack.source }],
      });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = validateAgainstAllowList(lockfile, "team");

      expect(errors).toEqual([]);
    });

    it("skips entries without source", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [{ type: "hash", value: "sha256:abc..." }],
      });

      const lockfile: Lockfile = {
        version: "1",
        generated_at: new Date().toISOString(),
        mode: "team",
        sections: [
          {
            rule_id: "test.rule",
            content_hash: "sha256:abc...",
            // No source field
          },
        ],
      };

      const errors = validateAgainstAllowList(lockfile, "team");
      expect(errors).toEqual([]);
    });
  });

  describe("checkDriftFromAllowedHashes", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns empty array for solo mode", () => {
      const lockfile = generateLockfile(mockPack, "solo");
      const errors = checkDriftFromAllowedHashes(lockfile, "solo");
      expect(errors).toEqual([]);
    });

    it("returns empty array when no allow list exists", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const lockfile = generateLockfile(mockPack, "team");
      const errors = checkDriftFromAllowedHashes(lockfile, "team");
      expect(errors).toEqual([]);
    });

    it("returns empty array when allow list parse fails", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockImplementation(() => {
        throw new Error("Parse error");
      });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = checkDriftFromAllowedHashes(lockfile, "team");
      expect(errors).toEqual([]);
    });

    it("warns when lockfile hash differs from allowed hash", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [
          {
            type: "id",
            value: mockPack.source,
            resolved_hash: "sha256:different...",
          },
        ],
      });

      const lockfile = generateLockfile(mockPack, "team");
      const errors = checkDriftFromAllowedHashes(lockfile, "team");

      expect(errors.length).toBeGreaterThan(0);
      const driftError = errors.find((e) => e.message.includes("differs"));
      expect(driftError?.type).toBe("warning");
      expect(driftError?.message).toContain("differs from allowed version");
    });

    it("passes when lockfile hash matches allowed hash", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      const lockfile = generateLockfile(mockPack, "team");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [
          {
            type: "id",
            value: mockPack.source,
            resolved_hash: lockfile.rules[0]?.content_hash,
          },
        ],
      });

      const errors = checkDriftFromAllowedHashes(lockfile, "team");
      expect(errors).toEqual([]);
    });
  });

  describe("validateLockfileTeamMode", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("returns valid for solo mode", () => {
      const lockfile = generateLockfile(mockPack, "solo");
      const result = validateLockfileTeamMode(lockfile, "solo");

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("aggregates allow list and drift errors", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [{ type: "hash", value: "sha256:wrong..." }],
      });

      const lockfile = generateLockfile(mockPack, "team");
      const result = validateLockfileTeamMode(lockfile, "team");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns valid when all checks pass", async () => {
      const { parseAllowList } = await import("../../src/team/allow.js");
      const lockfile = generateLockfile(mockPack, "team");

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(parseAllowList).mockReturnValue({
        sources: [
          {
            type: "id",
            value: mockPack.source,
            resolved_hash: lockfile.rules[0]?.content_hash,
          },
        ],
      });

      const result = validateLockfileTeamMode(lockfile, "team");
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe("formatLockfileTeamErrors", () => {
    it("formats errors and warnings separately", () => {
      const result = {
        valid: false,
        errors: [
          {
            type: "error" as const,
            message: "Test error",
            suggestion: "Fix it",
          },
          {
            type: "warning" as const,
            message: "Test warning",
            suggestion: "Consider this",
          },
        ],
      };

      const formatted = formatLockfileTeamErrors(result);
      expect(formatted).toContain("Lockfile Team Mode Errors:");
      expect(formatted).toContain("ERROR: Test error");
      expect(formatted).toContain("Lockfile Team Mode Warnings:");
      expect(formatted).toContain("WARNING: Test warning");
    });

    it("returns success message when valid", () => {
      const result = {
        valid: true,
        errors: [],
      };

      const formatted = formatLockfileTeamErrors(result);
      expect(formatted).toContain("passes team mode validation");
    });
  });

  // Team mode enhancements: Section-based validation tests
  describe("section-based validation", () => {
    const mockSection: AlignSection = {
      heading: "Testing Guidelines",
      level: 2,
      content: "Write comprehensive tests for all features.",
      fingerprint: "fp:testing-guidelines-abc123",
    };

    const mockSectionPack: AlignPack = {
      id: "test.section.pack",
      version: "1.0.0",
      spec_version: "1",
      summary: "Test section pack",
      owner: "test-org",
      source: "https://github.com/test-org/aligns",
      source_sha: "def456",
      sections: [mockSection],
    };

    it("validates matching section-based lockfile", () => {
      const lockfile = generateLockfile(mockSectionPack, "team");
      const result = validateLockfile(lockfile, mockSectionPack);

      expect(result.valid).toBe(true);
      expect(result.mismatches).toHaveLength(0);
      expect(result.newRules).toHaveLength(0);
      expect(result.deletedRules).toHaveLength(0);
    });

    it("detects modified sections", () => {
      const lockfile = generateLockfile(mockSectionPack, "team");
      const modifiedPack: AlignPack = {
        ...mockSectionPack,
        sections: [{ ...mockSection, content: "Modified content" }],
      };

      const result = validateLockfile(lockfile, modifiedPack);

      expect(result.valid).toBe(false);
      expect(result.mismatches).toHaveLength(1);
      expect(result.mismatches[0].rule_id).toBe("fp:testing-guidelines-abc123");
    });

    it("detects new sections", () => {
      const lockfile = generateLockfile(mockSectionPack, "team");
      const expandedPack: AlignPack = {
        ...mockSectionPack,
        sections: [
          mockSection,
          {
            ...mockSection,
            fingerprint: "fp:new-section",
            heading: "New Section",
          },
        ],
      };

      const result = validateLockfile(lockfile, expandedPack);

      expect(result.valid).toBe(false);
      expect(result.newRules).toHaveLength(1);
      expect(result.newRules[0]).toBe("fp:new-section");
    });

    it("detects deleted sections", () => {
      const packWithTwo: AlignPack = {
        ...mockSectionPack,
        sections: [
          mockSection,
          {
            ...mockSection,
            fingerprint: "fp:second-section",
            heading: "Second Section",
          },
        ],
      };

      const lockfile = generateLockfile(packWithTwo, "team");
      const result = validateLockfile(lockfile, mockSectionPack);

      expect(result.valid).toBe(false);
      expect(result.deletedRules).toHaveLength(1);
      expect(result.deletedRules[0]).toBe("fp:second-section");
    });

    it("handles multiple section changes", () => {
      const originalPack: AlignPack = {
        ...mockSectionPack,
        sections: [
          { ...mockSection, fingerprint: "fp:one", content: "Content 1" },
          { ...mockSection, fingerprint: "fp:two", content: "Content 2" },
        ],
      };

      const lockfile = generateLockfile(originalPack, "team");

      const modifiedPack: AlignPack = {
        ...mockSectionPack,
        sections: [
          { ...mockSection, fingerprint: "fp:one", content: "Modified 1" },
          { ...mockSection, fingerprint: "fp:three", content: "Content 3" },
        ],
      };

      const result = validateLockfile(lockfile, modifiedPack);

      expect(result.valid).toBe(false);
      expect(result.mismatches).toHaveLength(1); // fp:one modified
      expect(result.newRules).toHaveLength(1); // fp:three added
      expect(result.deletedRules).toHaveLength(1); // fp:two deleted
    });
  });
});
