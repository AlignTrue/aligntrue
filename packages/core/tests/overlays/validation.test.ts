/**
 * Tests for overlay validation (Overlays system)
 */

import { describe, it, expect } from "vitest";
import type { Align } from "@aligntrue/schema";
import {
  validateOverlays,
  detectRedundantOverlays,
  areOverlaysValid,
  formatOverlayValidationResult,
} from "../../src/overlays/validation.js";
import type { OverlayDefinition } from "../../src/overlays/types.js";

describe("validateOverlays", () => {
  const baseIR: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections: [
      {
        heading: "Rule Alpha",
        level: 2,
        content: "First rule",
        fingerprint: "rule-alpha",
      },
      {
        heading: "Rule Beta",
        level: 2,
        content: "Second rule",
        fingerprint: "rule-beta",
      },
      {
        heading: "Rule Gamma",
        level: 2,
        content: "Third rule with plugs",
        fingerprint: "rule-gamma",
      },
    ],
  };

  describe("stale selector detection", () => {
    it("detects stale rule selector (no match)", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="non-existent"]',
          set: { severity: "error" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: 'rule[id="non-existent"]',
        type: "stale",
        message: expect.stringContaining("does not match any target"),
      });
      expect(result.errors?.[0]?.suggestion).toContain(
        "Update or remove this overlay",
      );
    });

    it("detects stale property selector (no match)", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: "profile.missing_field",
          set: { value: "test" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: "profile.missing_field",
        type: "stale",
      });
    });

    it("detects stale array index selector (out of bounds)", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: "rules[99]",
          set: { enabled: false },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: "rules[99]",
        type: "stale",
      });
    });

    it("passes validation for valid selectors", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: { severity: "warning" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("ambiguous selector detection", () => {
    it("detects ambiguous selector (duplicate rule IDs)", () => {
      const irWithDuplicates: Align = {
        ...baseIR,
        sections: [
          {
            heading: "Duplicate Rule",
            level: 2,
            content: "First",
            fingerprint: "duplicate-id",
          },
          {
            heading: "Duplicate Rule",
            level: 2,
            content: "Second",
            fingerprint: "duplicate-id",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="duplicate-id"]',
          set: { content: "updated" },
        },
      ];

      const result = validateOverlays(overlays, irWithDuplicates);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: 'rule[id="duplicate-id"]',
        type: "ambiguous",
        message: expect.stringContaining("matches 2 targets"),
      });
      expect(result.errors?.[0]?.suggestion).toContain("more specific");
    });

    it("passes validation when selector matches exactly one target", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: { severity: "warning" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });
  });

  describe("plug conflict detection", () => {
    it("detects plug conflict when overlay sets plug-provided key", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-gamma"]',
          set: { content: "updated" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true); // Warnings don't fail validation
      // No conflicts expected in new sections format
      expect(result.warnings).toBeUndefined();
    });

    it("detects plug conflict when overlay removes plug-provided key", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-gamma"]',
          remove: ["content"],
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true); // Warnings don't fail validation
      // No conflicts expected in new sections format
      expect(result.warnings).toBeUndefined();
    });

    it("does not warn for rules without plugs", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: { content: "updated" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it("does not warn when overlay modifies non-plug keys", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-gamma"]',
          set: { heading: "Updated" },
        },
      ];

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });

    it("can be disabled via options", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-gamma"]',
          set: { content: "updated" },
        },
      ];

      const result = validateOverlays(overlays, baseIR, {
        detectPlugConflicts: false,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toBeUndefined();
    });
  });

  describe("size limit enforcement", () => {
    it("errors when overlay count exceeds maximum", () => {
      const overlays: OverlayDefinition[] = Array.from(
        { length: 51 },
        (_, i) => ({
          selector: 'rule[id="rule-alpha"]',
          set: { key: `value-${i}` },
        }),
      );

      const result = validateOverlays(overlays, baseIR, {
        maxOverrides: 50,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: "(global)",
        type: "size_limit",
        message: expect.stringContaining("51 exceeds limit of 50"),
      });
    });

    it("warns when approaching overlay limit (80% threshold)", () => {
      const overlays: OverlayDefinition[] = Array.from(
        { length: 41 },
        (_, i) => ({
          selector: 'rule[id="rule-alpha"]',
          set: { key: `value-${i}` },
        }),
      );

      const result = validateOverlays(overlays, baseIR, {
        maxOverrides: 50,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toMatchObject({
        selector: "(global)",
        type: "approaching_limit",
        message: expect.stringContaining("41/50"),
      });
    });

    it("errors when operations per overlay exceeds maximum", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: Object.fromEntries(
            Array.from({ length: 21 }, (_, i) => [`key${i}`, `value${i}`]),
          ),
        },
      ];

      const result = validateOverlays(overlays, baseIR, {
        maxOperationsPerOverride: 20,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        selector: 'rule[id="rule-alpha"]',
        type: "size_limit",
        message: expect.stringContaining("21 operations (limit: 20)"),
      });
    });

    it("warns when approaching operations limit (80% threshold)", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: Object.fromEntries(
            Array.from({ length: 17 }, (_, i) => [`key${i}`, `value${i}`]),
          ),
        },
      ];

      const result = validateOverlays(overlays, baseIR, {
        maxOperationsPerOverride: 20,
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toMatchObject({
        selector: 'rule[id="rule-alpha"]',
        type: "approaching_limit",
        message: expect.stringContaining("17/20"),
      });
    });

    it("counts set and remove operations together", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="rule-alpha"]',
          set: Object.fromEntries(
            Array.from({ length: 15 }, (_, i) => [`key${i}`, `value${i}`]),
          ),
          remove: Array.from({ length: 6 }, (_, i) => `remove${i}`),
        },
      ];

      const result = validateOverlays(overlays, baseIR, {
        maxOperationsPerOverride: 20,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toMatchObject({
        type: "size_limit",
        message: expect.stringContaining("21 operations"),
      });
    });

    it("uses default limits when not specified", () => {
      const overlays: OverlayDefinition[] = Array.from(
        { length: 51 },
        (_, i) => ({
          selector: 'rule[id="rule-alpha"]',
          set: { key: `value-${i}` },
        }),
      );

      const result = validateOverlays(overlays, baseIR);

      expect(result.valid).toBe(false);
      expect(result.errors?.[0]?.message).toContain("limit of 50");
    });
  });

  describe("multiple validation errors", () => {
    it("collects all errors from multiple overlays", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="non-existent-1"]',
          set: { severity: "error" },
        },
        {
          selector: 'rule[id="non-existent-2"]',
          set: { severity: "warning" },
        },
        {
          selector: 'rule[id="rule-alpha"]',
          set: Object.fromEntries(
            Array.from({ length: 25 }, (_, i) => [`key${i}`, `value${i}`]),
          ),
        },
      ];

      const result = validateOverlays(overlays, baseIR, {
        maxOperationsPerOverride: 20,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors?.[0]?.type).toBe("stale");
      expect(result.errors?.[1]?.type).toBe("stale");
      expect(result.errors?.[2]?.type).toBe("size_limit");
    });

    it("stops checking overlay after first error (stale or ambiguous)", () => {
      const overlays: OverlayDefinition[] = [
        {
          selector: 'rule[id="non-existent"]',
          set: { severity: "error" }, // Would be plug conflict if selector matched
        },
      ];

      const irWithPlugs: Align = {
        ...baseIR,
        sections: [
          {
            id: "rule-alpha",
            description: "Rule with plugs",
            severity: "error",
            enabled: true,
            tags: [],
            plugs: [{ slot: "severity", description: "Severity" }],
          },
        ],
      };

      const result = validateOverlays(overlays, irWithPlugs);

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]?.type).toBe("stale");
      expect(result.warnings).toBeUndefined(); // No plug conflict warning
    });
  });
});

describe("detectRedundantOverlays", () => {
  const baseIR: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections: [
      {
        heading: "Rule Alpha",
        level: 2,
        content: "Test rule",
        fingerprint: "rule-alpha",
      },
    ],
  };

  it("detects redundant overlay (all set values match existing)", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        set: { level: 2, heading: "Rule Alpha" }, // Both match existing values
      },
    ];

    const warnings = detectRedundantOverlays(overlays, baseIR);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      selector: 'rule[id="rule-alpha"]',
      type: "redundant",
      message: expect.stringContaining("has no effect"),
    });
  });

  it("detects redundant overlay (all remove keys are absent)", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        remove: ["non_existent_key", "another_missing_key"],
      },
    ];

    const warnings = detectRedundantOverlays(overlays, baseIR);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.type).toBe("redundant");
  });

  it("does not warn for overlay with actual changes (set)", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        set: { level: 3 }, // Different from existing
      },
    ];

    const warnings = detectRedundantOverlays(overlays, baseIR);

    expect(warnings).toHaveLength(0);
  });

  it("does not warn for overlay with actual changes (remove)", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        remove: ["content"], // Key exists in target
      },
    ];

    const warnings = detectRedundantOverlays(overlays, baseIR);

    expect(warnings).toHaveLength(0);
  });

  it("skips overlays with invalid selectors", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="non-existent"]',
        set: { severity: "error" },
      },
    ];

    const warnings = detectRedundantOverlays(overlays, baseIR);

    expect(warnings).toHaveLength(0); // Skipped, not redundant
  });
});

describe("areOverlaysValid", () => {
  const baseIR: Align = {
    id: "test-align",
    version: "1.0.0",
    spec_version: "1",
    sections: [
      {
        heading: "Rule Alpha",
        level: 2,
        content: "Test rule",
        fingerprint: "rule-alpha",
      },
    ],
  };

  it("returns true for valid overlays", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        set: { content: "updated content" },
      },
    ];

    expect(areOverlaysValid(overlays, baseIR)).toBe(true);
  });

  it("returns false for invalid overlays", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="non-existent"]',
        set: { content: "error" },
      },
    ];

    expect(areOverlaysValid(overlays, baseIR)).toBe(false);
  });

  it("returns true despite warnings (warnings don't fail validation)", () => {
    const irWithPlugs: Align = {
      ...baseIR,
      sections: [
        {
          heading: "Rule Alpha",
          level: 2,
          content: "Rule with plugs",
          fingerprint: "rule-alpha",
        },
      ],
    };

    const overlays: OverlayDefinition[] = [
      {
        selector: 'rule[id="rule-alpha"]',
        set: { content: "updated" },
      },
    ];

    expect(areOverlaysValid(overlays, irWithPlugs)).toBe(true);
  });
});

describe("formatOverlayValidationResult", () => {
  it("formats errors with suggestions", () => {
    const result = {
      valid: false,
      errors: [
        {
          selector: 'rule[id="missing"]',
          type: "stale" as const,
          message: "Selector does not match",
          suggestion: "Update or remove this overlay",
        },
      ],
    };

    const formatted = formatOverlayValidationResult(result);

    expect(formatted).toContain("Errors:");
    expect(formatted).toContain('✗ [stale] rule[id="missing"]');
    expect(formatted).toContain("Selector does not match");
    expect(formatted).toContain("Suggestion: Update or remove this overlay");
  });

  it("formats warnings", () => {
    const result = {
      valid: true,
      warnings: [
        {
          selector: 'rule[id="alpha"]',
          type: "plug_conflict" as const,
          message: "Modifies plug-provided key",
        },
      ],
    };

    const formatted = formatOverlayValidationResult(result);

    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain('⚠ [plug_conflict] rule[id="alpha"]');
    expect(formatted).toContain("Modifies plug-provided key");
  });

  it("formats both errors and warnings", () => {
    const result = {
      valid: false,
      errors: [
        {
          selector: 'rule[id="missing"]',
          type: "stale" as const,
          message: "Not found",
        },
      ],
      warnings: [
        {
          selector: 'rule[id="alpha"]',
          type: "plug_conflict" as const,
          message: "Conflict",
        },
      ],
    };

    const formatted = formatOverlayValidationResult(result);

    expect(formatted).toContain("Errors:");
    expect(formatted).toContain("Warnings:");
    expect(formatted).toContain('✗ [stale] rule[id="missing"]');
    expect(formatted).toContain('⚠ [plug_conflict] rule[id="alpha"]');
  });

  it("returns empty string for valid result with no warnings", () => {
    const result = {
      valid: true,
    };

    const formatted = formatOverlayValidationResult(result);

    expect(formatted).toBe("");
  });
});
