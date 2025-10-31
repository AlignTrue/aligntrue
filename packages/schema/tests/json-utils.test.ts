/**
 * Tests for JSON utilities (Phase 4.5)
 *
 * Consolidation of common JSON patterns with comprehensive test coverage.
 */

import { describe, it, expect } from "vitest";
import {
  stringifyCanonical,
  computeContentHash,
  parseJsonSafe,
  hashObject,
  compareCanonical,
} from "../src/json-utils.js";

describe("json-utils", () => {
  describe("stringifyCanonical", () => {
    it("produces deterministic output", () => {
      const obj = { b: 2, a: 1, c: 3 };
      const result1 = stringifyCanonical(obj);
      const result2 = stringifyCanonical(obj);
      expect(result1).toBe(result2);
    });

    it("sorts keys alphabetically (JCS)", () => {
      const obj = { z: 26, a: 1, m: 13 };
      const result = stringifyCanonical(obj);
      expect(result).toBe('{"a":1,"m":13,"z":26}');
    });

    it("handles nested objects", () => {
      const obj = { outer: { b: 2, a: 1 } };
      const result = stringifyCanonical(obj);
      expect(result).toBe('{"outer":{"a":1,"b":2}}');
    });

    it("handles arrays", () => {
      const obj = { items: [3, 1, 2] };
      const result = stringifyCanonical(obj);
      // Arrays preserve order (not sorted)
      expect(result).toBe('{"items":[3,1,2]}');
    });

    it("excludes volatile vendor fields by default", () => {
      const obj = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "abc123", mode: "native" },
        },
      };
      const result = stringifyCanonical(obj);
      // session_id should be excluded, but _meta.volatile path will still appear
      const parsed = JSON.parse(result);
      expect(parsed.vendor.cursor.session_id).toBeUndefined();
      expect(parsed.vendor.cursor.mode).toBe("native");
    });

    it("includes volatile fields when excludeVolatile=false", () => {
      const obj = {
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "abc123" },
        },
      };
      const result = stringifyCanonical(obj, false);
      expect(result).toContain("session_id");
    });

    it("handles null values", () => {
      const obj = { value: null };
      const result = stringifyCanonical(obj);
      expect(result).toBe('{"value":null}');
    });

    it("handles boolean values", () => {
      const obj = { enabled: true, disabled: false };
      const result = stringifyCanonical(obj);
      expect(result).toBe('{"disabled":false,"enabled":true}');
    });

    it("handles numbers including zero", () => {
      const obj = { count: 0, total: 42 };
      const result = stringifyCanonical(obj);
      expect(result).toBe('{"count":0,"total":42}');
    });

    it("handles empty objects", () => {
      const result = stringifyCanonical({});
      expect(result).toBe("{}");
    });

    it("handles empty arrays", () => {
      const result = stringifyCanonical([]);
      expect(result).toBe("[]");
    });
  });

  describe("computeContentHash", () => {
    it("produces deterministic hash", () => {
      const obj = { id: "rule1", content: "test" };
      const hash1 = computeContentHash(obj);
      const hash2 = computeContentHash(obj);
      expect(hash1).toBe(hash2);
    });

    it("produces SHA-256 hex string (64 chars)", () => {
      const obj = { test: "data" };
      const hash = computeContentHash(obj);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces same hash for objects with different key order", () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      const hash1 = computeContentHash(obj1);
      const hash2 = computeContentHash(obj2);
      expect(hash1).toBe(hash2);
    });

    it("produces different hash for different content", () => {
      const obj1 = { id: "rule1" };
      const obj2 = { id: "rule2" };
      const hash1 = computeContentHash(obj1);
      const hash2 = computeContentHash(obj2);
      expect(hash1).not.toBe(hash2);
    });

    it("excludes volatile fields by default", () => {
      const obj1 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "abc123" },
        },
      };
      const obj2 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "xyz789" },
        },
      };
      // Should have same hash (session_id excluded)
      const hash1 = computeContentHash(obj1);
      const hash2 = computeContentHash(obj2);
      expect(hash1).toBe(hash2);
    });

    it("includes volatile fields when excludeVolatile=false", () => {
      const obj1 = {
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "abc123" },
        },
      };
      const obj2 = {
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "xyz789" },
        },
      };
      // Should have different hash (session_id included)
      const hash1 = computeContentHash(obj1, false);
      const hash2 = computeContentHash(obj2, false);
      expect(hash1).not.toBe(hash2);
    });

    it("handles complex nested structures", () => {
      const obj = {
        rules: [
          { id: "rule1", applies_to: ["**/*.ts"] },
          { id: "rule2", applies_to: ["**/*.js"] },
        ],
        profile: { id: "test", version: "1.0.0" },
      };
      const hash = computeContentHash(obj);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("parseJsonSafe", () => {
    it("parses valid JSON", () => {
      const result = parseJsonSafe('{"key": "value"}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ key: "value" });
      }
    });

    it("returns error for invalid JSON", () => {
      const result = parseJsonSafe("{invalid json}");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain("JSON");
      }
    });

    it("handles empty string", () => {
      const result = parseJsonSafe("");
      expect(result.ok).toBe(false);
    });

    it("handles null JSON", () => {
      const result = parseJsonSafe("null");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(null);
      }
    });

    it("handles boolean JSON", () => {
      const result = parseJsonSafe("true");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it("handles number JSON", () => {
      const result = parseJsonSafe("42");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it("handles array JSON", () => {
      const result = parseJsonSafe("[1,2,3]");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([1, 2, 3]);
      }
    });

    it("handles nested objects", () => {
      const json = '{"outer":{"inner":"value"}}';
      const result = parseJsonSafe(json);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ outer: { inner: "value" } });
      }
    });
  });

  describe("hashObject", () => {
    it("is shorthand for computeContentHash", () => {
      const obj = { id: "rule1", content: "test" };
      const hash1 = hashObject(obj);
      const hash2 = computeContentHash(obj, true);
      expect(hash1).toBe(hash2);
    });

    it("produces SHA-256 hex string", () => {
      const obj = { test: "data" };
      const hash = hashObject(obj);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("produces deterministic output", () => {
      const obj = { a: 1, b: 2, c: 3 };
      const hash1 = hashObject(obj);
      const hash2 = hashObject(obj);
      expect(hash1).toBe(hash2);
    });
  });

  describe("compareCanonical", () => {
    it("returns true for identical objects", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("returns true for objects with different key order", () => {
      const obj1 = { b: 2, a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("returns false for different objects", () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      expect(compareCanonical(obj1, obj2)).toBe(false);
    });

    it("returns true for nested objects with different key order", () => {
      const obj1 = { outer: { b: 2, a: 1 } };
      const obj2 = { outer: { a: 1, b: 2 } };
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("handles volatile fields consistently", () => {
      const obj1 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "abc123" },
        },
      };
      const obj2 = {
        rules: [{ id: "rule1" }],
        vendor: {
          _meta: { volatile: ["cursor.session_id"] },
          cursor: { session_id: "xyz789" },
        },
      };
      // Should be equal (volatile fields excluded)
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("returns false for objects with different structure", () => {
      const obj1 = { a: 1 };
      const obj2 = { a: 1, b: 2 };
      expect(compareCanonical(obj1, obj2)).toBe(false);
    });

    it("handles arrays correctly", () => {
      const obj1 = { items: [1, 2, 3] };
      const obj2 = { items: [1, 2, 3] };
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("returns false for arrays with different order", () => {
      const obj1 = { items: [1, 2, 3] };
      const obj2 = { items: [3, 2, 1] };
      expect(compareCanonical(obj1, obj2)).toBe(false);
    });

    it("handles null values", () => {
      const obj1 = { value: null };
      const obj2 = { value: null };
      expect(compareCanonical(obj1, obj2)).toBe(true);
    });

    it("returns false when one has null and other has value", () => {
      const obj1 = { value: null };
      const obj2 = { value: 0 };
      expect(compareCanonical(obj1, obj2)).toBe(false);
    });

    it("returns false for uncanonicalizeable values", () => {
      // Create circular reference (not canonicalizable)
      const obj1: any = { a: 1 };
      obj1.self = obj1;
      const obj2 = { a: 1 };
      expect(compareCanonical(obj1, obj2)).toBe(false);
    });
  });

  describe("performance", () => {
    it("stringifyCanonical has acceptable performance", () => {
      const obj = {
        rules: Array.from({ length: 100 }, (_, i) => ({
          id: `rule${i}`,
          applies_to: ["**/*.ts"],
          guidance: "Test rule",
        })),
      };

      const start = performance.now();
      stringifyCanonical(obj);
      const duration = performance.now() - start;

      // Should complete in reasonable time (<100ms for 100 rules)
      expect(duration).toBeLessThan(100);
    });

    it("computeContentHash has acceptable performance", () => {
      const obj = {
        rules: Array.from({ length: 100 }, (_, i) => ({
          id: `rule${i}`,
          applies_to: ["**/*.ts"],
          guidance: "Test rule",
        })),
      };

      const start = performance.now();
      computeContentHash(obj);
      const duration = performance.now() - start;

      // Should complete in reasonable time (<100ms for 100 rules)
      expect(duration).toBeLessThan(100);
    });
  });

  describe("integration with canonicalize module", () => {
    it("uses same canonicalization as canonicalizeJson", async () => {
      // Import canonicalizeJson for comparison
      const { canonicalizeJson } = await import("../src/canonicalize.js");

      const obj = { b: 2, a: 1, c: 3 };
      const util = stringifyCanonical(obj);
      const direct = canonicalizeJson(obj);

      expect(util).toBe(direct);
    });

    it("uses same hashing as computeHash", async () => {
      const { canonicalizeJson, computeHash } = await import(
        "../src/canonicalize.js"
      );

      const obj = { id: "rule1", content: "test" };
      const util = computeContentHash(obj);
      const direct = computeHash(canonicalizeJson(obj));

      expect(util).toBe(direct);
    });
  });
});
