/**
 * Security tests for regex safety and ReDoS prevention
 */

import { describe, it, expect } from "vitest";
import {
  validateRegexPattern,
  escapeForRegex,
  safeRegExp,
} from "../../src/security/regex-validator.js";

describe("Regex Safety", () => {
  describe("validateRegexPattern", () => {
    it("accepts patterns within length limit", () => {
      const pattern = "a".repeat(200);
      expect(() => {
        validateRegexPattern(pattern);
      }).not.toThrow();
    });

    it("rejects patterns exceeding length limit", () => {
      const pattern = "a".repeat(201);
      expect(() => {
        validateRegexPattern(pattern);
      }).toThrow("exceeds maximum length");
    });

    it("rejects nested quantifiers that could cause ReDoS", () => {
      const nestedQuantifierPatterns = ["(a+)+", "(a*)*", "(a?)?", "((a+)+)+"];

      for (const pattern of nestedQuantifierPatterns) {
        expect(() => {
          validateRegexPattern(pattern);
        }).toThrow("nested quantifiers");
      }
    });

    it("rejects exponential backtracking patterns", () => {
      const exponentialPatterns = ["(a|a)+", "(a|b)+"];

      for (const pattern of exponentialPatterns) {
        expect(() => {
          validateRegexPattern(pattern);
        }).toThrow("exponential backtracking");
      }
    });

    it("accepts safe patterns with bounded quantifiers", () => {
      const safePatterns = [
        "a{1,10}",
        "[a-z]+",
        ".*",
        "^[a-z0-9-]+$",
        "\\d{4}-\\d{2}-\\d{2}",
      ];

      for (const pattern of safePatterns) {
        expect(() => {
          validateRegexPattern(pattern);
        }).not.toThrow();
      }
    });
  });

  describe("escapeForRegex", () => {
    it("escapes all regex special characters", () => {
      const input = ".*+?^${}()|[\\]-";
      const escaped = escapeForRegex(input);
      expect(escaped).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\\\\\]\\-");
    });

    it("handles empty string", () => {
      expect(escapeForRegex("")).toBe("");
    });

    it("handles strings without special characters", () => {
      expect(escapeForRegex("abc123")).toBe("abc123");
    });
  });

  describe("safeRegExp", () => {
    it("constructs regex from safe pattern", () => {
      const pattern = "^[a-z]+$";
      const regex = safeRegExp(pattern);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.test("abc")).toBe(true);
      expect(regex.test("ABC")).toBe(false);
    });

    it("accepts regex flags", () => {
      const pattern = "[a-z]+";
      const regex = safeRegExp(pattern, "i");
      expect(regex.test("ABC")).toBe(true);
    });

    it("rejects unsafe patterns", () => {
      expect(() => {
        safeRegExp("(a+)+");
      }).toThrow("nested quantifiers");
    });

    it("rejects overly long patterns", () => {
      const longPattern = "a".repeat(201);
      expect(() => {
        safeRegExp(longPattern);
      }).toThrow("exceeds maximum length");
    });
  });
});
