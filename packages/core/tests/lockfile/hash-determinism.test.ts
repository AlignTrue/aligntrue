/**
 * Lockfile Hash Determinism Tests
 *
 * Verifies that lockfile hashes change when rule content changes
 * and that vendor.*.volatile fields are correctly excluded.
 */

import { describe, it, expect } from "vitest";
import { hashRule } from "../../src/lockfile/generator.js";
import type { AlignRule } from "@aligntrue/schema";

describe("Lockfile Hash Determinism", () => {
  it("hash changes when rule severity changes", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "warn",
      guidance: "Test guidance",
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test guidance",
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    expect(hash1).not.toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex
    expect(hash2).toMatch(/^[a-f0-9]{64}$/);
  });

  it("hash changes when rule guidance changes", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Original guidance",
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Modified guidance",
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    expect(hash1).not.toBe(hash2);
  });

  it("hash changes when applies_to changes", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      applies_to: ["**/*.ts"],
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      applies_to: ["**/*.tsx"],
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    expect(hash1).not.toBe(hash2);
  });

  it("hash changes when tags change", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      tags: ["typescript"],
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      tags: ["typescript", "quality"],
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    expect(hash1).not.toBe(hash2);
  });

  it("hash excludes vendor.*.volatile fields", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      vendor: {
        cursor: { stable: "value" },
        _meta: { volatile: ["cursor.session_id"] },
      },
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      vendor: {
        cursor: { stable: "value", session_id: "different" },
        _meta: { volatile: ["cursor.session_id"] },
      },
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    // Should be same since session_id is marked as volatile
    expect(hash1).toBe(hash2);
  });

  it("hash includes non-volatile vendor fields", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      vendor: {
        cursor: { ai_hint: "Original hint" },
      },
    };
    const rule2: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      vendor: {
        cursor: { ai_hint: "Modified hint" },
      },
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    // Should be different since ai_hint is not volatile
    expect(hash1).not.toBe(hash2);
  });

  it("hash is deterministic for identical rules", () => {
    const rule: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test guidance",
      applies_to: ["**/*.ts"],
      tags: ["typescript", "quality"],
    };

    const hash1 = hashRule(rule);
    const hash2 = hashRule(rule);
    const hash3 = hashRule(JSON.parse(JSON.stringify(rule))); // Deep clone

    expect(hash1).toBe(hash2);
    expect(hash1).toBe(hash3);
  });

  it("hash ignores key order", () => {
    const rule1: AlignRule = {
      id: "test.rule",
      severity: "error",
      guidance: "Test",
      tags: ["a", "b"],
    };
    const rule2: AlignRule = {
      tags: ["a", "b"],
      guidance: "Test",
      severity: "error",
      id: "test.rule",
    };

    const hash1 = hashRule(rule1);
    const hash2 = hashRule(rule2);

    // Should be same due to canonical JSON (stable key ordering)
    expect(hash1).toBe(hash2);
  });
});
