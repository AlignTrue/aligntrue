/**
 * Tests for rule ID validation
 */

import { describe, it, expect } from "vitest";
import { validateRuleId } from "../src/validator.js";

describe("validateRuleId", () => {
  describe("valid IDs", () => {
    it("accepts valid dot notation with 3 segments", () => {
      expect(validateRuleId("testing.require.tests").valid).toBe(true);
      expect(validateRuleId("security.no.secrets").valid).toBe(true);
      expect(validateRuleId("docs.public.api").valid).toBe(true);
    });

    it("accepts valid dot notation with 4+ segments", () => {
      expect(validateRuleId("team.frontend.react.hooks").valid).toBe(true);
      expect(validateRuleId("org.backend.api.validation.strict").valid).toBe(
        true,
      );
    });

    it("accepts hyphens in non-first segments", () => {
      expect(validateRuleId("testing.no.console-log").valid).toBe(true);
      expect(validateRuleId("security.no.hard-coded-secrets").valid).toBe(true);
    });

    it("accepts numbers in all segments", () => {
      expect(validateRuleId("http2.max.connections").valid).toBe(true);
      expect(validateRuleId("node20.require.esm").valid).toBe(true);
    });
  });

  describe("invalid IDs", () => {
    it("rejects single segment", () => {
      const result = validateRuleId("testing");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("category.subcategory.rule-name");
    });

    it("rejects two segments", () => {
      const result = validateRuleId("testing.rules");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("category.subcategory.rule-name");
    });

    it("rejects uppercase letters", () => {
      const result = validateRuleId("Testing.require.tests");
      expect(result.valid).toBe(false);
    });

    it("rejects spaces", () => {
      const result = validateRuleId("testing require tests");
      expect(result.valid).toBe(false);
    });

    it("rejects underscores", () => {
      const result = validateRuleId("testing_require_tests");
      expect(result.valid).toBe(false);
    });

    it("rejects leading dot", () => {
      const result = validateRuleId(".testing.require.tests");
      expect(result.valid).toBe(false);
    });

    it("rejects trailing dot", () => {
      const result = validateRuleId("testing.require.tests.");
      expect(result.valid).toBe(false);
    });

    it("rejects double dots", () => {
      const result = validateRuleId("testing..require.tests");
      expect(result.valid).toBe(false);
    });
  });

  describe("kebab-case conversion suggestions", () => {
    it("suggests conversion from kebab-case with 3 segments", () => {
      const result = validateRuleId("testing-require-tests");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("dot notation");
      expect(result.suggestion).toContain("testing.require.tests");
    });

    it("suggests conversion from kebab-case with 4+ segments", () => {
      const result = validateRuleId("team-frontend-react-hooks");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toContain("team.frontend.react.hooks");
    });

    it("suggests conversion for kebab-case with numbers", () => {
      const result = validateRuleId("http2-max-connections");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toContain("http2.max.connections");
    });

    it("suggests conversion for two-hyphen kebab-case (becomes 3 segments)", () => {
      const result = validateRuleId("testing-require-tests");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toContain("testing.require.tests");
    });
  });

  describe("error messages", () => {
    it("provides helpful examples for generic invalid IDs", () => {
      const result = validateRuleId("invalid_id");
      expect(result.valid).toBe(false);
      expect(result.suggestion).toContain("testing.require.tests");
      expect(result.suggestion).toContain("security.no.secrets");
      expect(result.suggestion).toContain("docs.public.api");
    });

    it("provides specific conversion hint for kebab-case", () => {
      const result = validateRuleId("docs-public-api");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("3+ segments");
      expect(result.suggestion).toContain("Try:");
    });
  });
});
