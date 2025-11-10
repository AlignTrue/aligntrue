/**
 * Tests for overlay operations (Overlays system)
 */

import { describe, it, expect } from "vitest";
import {
  setProperty,
  removeProperty,
  applySetOperations,
  applyRemoveOperations,
  mergeArraysAsSet,
  deepClone,
  isPlainObject,
} from "../../src/overlays/operations.js";

describe("setProperty", () => {
  it("sets simple property", () => {
    const obj = { name: "test" };
    setProperty(obj, "name", "updated");
    expect(obj.name).toBe("updated");
  });

  it("sets nested property", () => {
    const obj = { check: { inputs: { pattern: "old" } } };
    setProperty(obj, "check.inputs.pattern", "new");
    expect(obj.check.inputs.pattern).toBe("new");
  });

  it("creates intermediate objects", () => {
    const obj: unknown = {};
    setProperty(obj, "check.inputs.pattern", "value");
    expect(obj.check.inputs.pattern).toBe("value");
  });

  it("throws on non-object target", () => {
    expect(() => setProperty(null, "key", "value")).toThrow("non-object");
    expect(() => setProperty("string", "key", "value")).toThrow("non-object");
  });

  it("throws when intermediate value is not object", () => {
    const obj = { check: "string" };
    expect(() => setProperty(obj, "check.inputs.pattern", "value")).toThrow(
      "not an object",
    );
  });
});

describe("removeProperty", () => {
  it("removes simple property", () => {
    const obj = { name: "test", other: "keep" };
    const removed = removeProperty(obj, "name");
    expect(removed).toBe(true);
    expect(obj).not.toHaveProperty("name");
    expect(obj.other).toBe("keep");
  });

  it("removes nested property", () => {
    const obj = { check: { inputs: { pattern: "test", files: [] } } };
    const removed = removeProperty(obj, "check.inputs.pattern");
    expect(removed).toBe(true);
    expect(obj.check.inputs).not.toHaveProperty("pattern");
    expect(obj.check.inputs.files).toEqual([]);
  });

  it("returns false for non-existent property", () => {
    const obj = { name: "test" };
    const removed = removeProperty(obj, "nonexistent");
    expect(removed).toBe(false);
  });

  it("returns false for non-object target", () => {
    expect(removeProperty(null, "key")).toBe(false);
    expect(removeProperty("string", "key")).toBe(false);
  });

  it("returns false when intermediate path doesn't exist", () => {
    const obj = { check: {} };
    const removed = removeProperty(obj, "check.inputs.pattern");
    expect(removed).toBe(false);
  });
});

describe("applySetOperations", () => {
  it("applies multiple set operations in order", () => {
    const obj: unknown = {};
    applySetOperations(obj, {
      "check.type": "regex",
      severity: "error",
      "check.inputs.pattern": "test",
    });
    expect(obj.severity).toBe("error");
    expect(obj.check.type).toBe("regex");
    expect(obj.check.inputs.pattern).toBe("test");
  });

  it("applies operations in sorted key order", () => {
    const obj: unknown = {};
    const operations = { z: 1, a: 2, m: 3 };
    applySetOperations(obj, operations);
    expect(Object.keys(obj)).toEqual(["a", "m", "z"]);
  });
});

describe("applyRemoveOperations", () => {
  it("removes multiple properties in order", () => {
    const obj = {
      severity: "error",
      autofix: { hint: "test" },
      tags: ["a"],
      mode: "always",
    };
    applyRemoveOperations(obj, ["autofix", "tags"]);
    expect(obj).not.toHaveProperty("autofix");
    expect(obj).not.toHaveProperty("tags");
    expect(obj.severity).toBe("error");
    expect(obj.mode).toBe("always");
  });

  it("applies removals in sorted order", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const operations = ["d", "b", "c", "a"];
    applyRemoveOperations(obj, operations);
    expect(Object.keys(obj)).toEqual([]);
  });
});

describe("mergeArraysAsSet", () => {
  it("merges arrays and removes duplicates", () => {
    const result = mergeArraysAsSet([1, 2, 3], [3, 4, 5]);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it("sorts merged array", () => {
    const result = mergeArraysAsSet(["z", "a", "m"], ["b", "x"]);
    expect(result).toEqual(["a", "b", "m", "x", "z"]);
  });

  it("handles empty arrays", () => {
    expect(mergeArraysAsSet([], [1, 2])).toEqual([1, 2]);
    expect(mergeArraysAsSet([1, 2], [])).toEqual([1, 2]);
    expect(mergeArraysAsSet([], [])).toEqual([]);
  });
});

describe("deepClone", () => {
  it("clones simple objects", () => {
    const obj = { name: "test", value: 123 };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned).not.toBe(obj);
  });

  it("clones nested objects", () => {
    const obj = { check: { inputs: { pattern: "test" } } };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.check).not.toBe(obj.check);
  });

  it("clones arrays", () => {
    const obj = { rules: [{ id: "a" }, { id: "b" }] };
    const cloned = deepClone(obj);
    expect(cloned).toEqual(obj);
    expect(cloned.rules).not.toBe(obj.rules);
    expect(cloned.rules[0]).not.toBe(obj.rules[0]);
  });
});

describe("isPlainObject", () => {
  it("returns true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ key: "value" })).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject("string")).toBe(false);
    expect(isPlainObject(123)).toBe(false);
    expect(isPlainObject([])).toBe(false);
  });
});
