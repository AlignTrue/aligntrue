/**
 * Tests for overlay application logic (Overlays system)
 */

import { describe, it, expect } from "vitest";
import type { AlignPack } from "@aligntrue/schema";
import {
  applyOverlays,
  normalizeLineEndings,
  validateOverlaySizeLimits,
} from "../../src/overlays/apply.js";
import type { OverlayDefinition } from "../../src/overlays/types.js";

// Mock IR for testing
const mockIR: AlignPack = {
  id: "test-pack",
  version: "1.0.0",
  spec_version: "1",
  sections: [
    {
      heading: "First Rule",
      level: 2,
      content: "First rule guidance",
      fingerprint: "rule-one",
      severity: "error",
      applies_to: ["*.ts"],
    },
    {
      heading: "Second Rule",
      level: 2,
      content: "Second rule guidance",
      fingerprint: "rule-two",
      severity: "warn",
      applies_to: ["*.js"],
      check: {
        type: "regex",
        inputs: { pattern: "test" },
      },
    },
  ],
};

describe("applyOverlays", () => {
  it("applies set operation to rule", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-one]",
        set: { severity: "warn" },
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(true);
    expect(result.modifiedIR?.sections[0].severity).toBe("warn");
    expect(result.appliedCount).toBe(1);
  });

  it("applies multiple overlays in order", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-one]",
        set: { severity: "warn" },
      },
      {
        selector: "rule[id=rule-two]",
        set: { severity: "info" },
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(true);
    expect(result.modifiedIR?.sections[0].severity).toBe("warn");
    expect(result.modifiedIR?.sections[1].severity).toBe("info");
    expect(result.appliedCount).toBe(2);
  });

  it("applies remove operation", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-two]",
        remove: ["check"],
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(true);
    expect(result.modifiedIR?.sections[1]).not.toHaveProperty("check");
    expect(result.modifiedIR?.sections[1].severity).toBe("warn"); // Other properties intact
  });

  it("applies both set and remove operations", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-two]",
        set: { severity: "error" },
        remove: ["check"],
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(true);
    expect(result.modifiedIR?.sections[1].severity).toBe("error");
    expect(result.modifiedIR?.sections[1]).not.toHaveProperty("check");
  });

  it("does not mutate original IR", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-one]",
        set: { severity: "warn" },
      },
    ];

    const originalSeverity = mockIR.sections[0].severity;
    applyOverlays(mockIR, overlays);
    expect(mockIR.sections[0].severity).toBe(originalSeverity);
  });

  it("fails on stale selector", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=nonexistent]",
        set: { severity: "warn" },
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("Selector");
    expect(result.errors?.[0]).toContain("rule[id=nonexistent]");
  });

  it("enforces max overrides limit", () => {
    const overlays: OverlayDefinition[] = Array(60).fill({
      selector: "rule[id=rule-one]",
      set: { severity: "warn" },
    });

    const result = applyOverlays(mockIR, overlays, { maxOverrides: 50 });
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("Too many overlays");
  });

  it("enforces max operations per override", () => {
    const largeSetOps: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) {
      largeSetOps[`prop${i}`] = `value${i}`;
    }

    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-one]",
        set: largeSetOps,
      },
    ];

    const result = applyOverlays(mockIR, overlays, {
      maxOperationsPerOverride: 20,
    });
    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("25 operations");
  });

  it("warns on overlapping overlays", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=rule-one]",
        set: { severity: "warn" },
      },
      {
        selector: "rule[id=rule-one]",
        set: { severity: "info" },
      },
    ];

    const result = applyOverlays(mockIR, overlays);
    expect(result.success).toBe(true);
    expect(result.warnings?.[0]).toContain(
      "Multiple overlays modify same properties",
    );
    // Last wins
    expect(result.modifiedIR?.sections[0].severity).toBe("info");
  });
});

describe("normalizeLineEndings", () => {
  it("normalizes CRLF to LF", () => {
    const ir: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Line one\r\nLine two\r\n",
          fingerprint: "test-rule",
        },
      ],
    };

    const normalized = normalizeLineEndings(ir);
    expect(normalized.sections[0].content).toBe("Line one\nLine two\n");
  });

  it("ensures single trailing LF", () => {
    const ir: AlignPack = {
      id: "test",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Test Rule",
          level: 2,
          content: "Text\n\n\n",
          fingerprint: "test-rule",
        },
      ],
    };

    const normalized = normalizeLineEndings(ir);
    expect(normalized.sections[0].content).toBe("Text\n");
  });
});

describe("validateOverlaySizeLimits", () => {
  it("validates within limits", () => {
    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=test]",
        set: { severity: "warn" },
      },
    ];

    const result = validateOverlaySizeLimits(overlays);
    expect(result.valid).toBe(true);
  });

  it("detects too many overlays", () => {
    const overlays: OverlayDefinition[] = Array(60).fill({
      selector: "rule[id=test]",
      set: { severity: "warn" },
    });

    const result = validateOverlaySizeLimits(overlays, { maxOverrides: 50 });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain("Too many overlays");
  });

  it("warns when approaching limit", () => {
    const overlays: OverlayDefinition[] = Array(45).fill({
      selector: "rule[id=test]",
      set: { severity: "warn" },
    });

    const result = validateOverlaySizeLimits(overlays, { maxOverrides: 50 });
    expect(result.valid).toBe(false); // Warnings count as invalid
    expect(result.errors?.[0]).toContain("Approaching overlay limit");
  });

  it("detects too many operations per override", () => {
    const largeSetOps: Record<string, unknown> = {};
    for (let i = 0; i < 25; i++) {
      largeSetOps[`prop${i}`] = `value${i}`;
    }

    const overlays: OverlayDefinition[] = [
      {
        selector: "rule[id=test]",
        set: largeSetOps,
      },
    ];

    const result = validateOverlaySizeLimits(overlays, {
      maxOperationsPerOverride: 20,
    });
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain("25 operations");
  });
});
