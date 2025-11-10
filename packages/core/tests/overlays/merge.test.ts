/**
 * Tests for three-way merge algorithm (Overlays system)
 */

import { describe, it, expect } from "vitest";
import {
  threeWayMerge,
  generatePatchFile,
  type MergeConflict,
} from "../../src/overlays/merge.js";
import type { AlignPack } from "@aligntrue/schema";
import type { OverlayDefinition } from "../../src/overlays/types.js";

describe("threeWayMerge", () => {
  describe("no conflicts", () => {
    it("applies overlay to new base when property unchanged", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning", // Unchanged
            description: "Added description", // New field
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.summary.appliedOverlays).toBe(1);
      expect(result.mergedIR).toBeDefined();
    });

    it("handles new properties added upstream", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { tags: ["custom"] },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            description: "New description", // Added upstream
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });
  });

  describe("conflict detection", () => {
    it("detects modified property conflict", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" }, // Local change
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "critical", // Upstream change (different from base and overlay)
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.type).toBe("modified");
      expect(result.conflicts[0]?.propertyPath).toBe("severity");
    });

    it("detects removed property conflict", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
            enabled: true,
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { enabled: false }, // Local change
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
            // enabled removed upstream
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.type).toBe("removed");
      expect(result.conflicts[0]?.propertyPath).toBe("enabled");
    });

    it("detects conflicts for remove operations", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            deprecated: true,
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          remove: ["deprecated"], // Local removal
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            deprecated: false, // Upstream changed value
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0]?.type).toBe("modified");
    });
  });

  describe("auto-resolution", () => {
    it("auto-resolves with 'ours' strategy", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "critical",
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase, {
        autoResolve: "ours",
      });

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.autoResolved).toHaveLength(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain("Auto-resolved");
    });

    it("auto-resolves with 'theirs' strategy", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "critical",
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase, {
        autoResolve: "theirs",
      });

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.autoResolved).toHaveLength(1);
    });

    it("requires manual resolution by default", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "warning",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
            severity: "critical",
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(1);
      expect(result.autoResolved).toHaveLength(0);
    });
  });

  describe("multiple overlays", () => {
    it("tracks all overlay applications", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Rule 1",
            severity: "warning",
          },
          {
            id: "rule2",
            name: "Rule 2",
            enabled: true,
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
        {
          selector: "rule[id=rule2]",
          set: { enabled: false },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Rule 1",
            severity: "warning",
          },
          {
            id: "rule2",
            name: "Rule 2",
            enabled: true,
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(true);
      expect(result.summary.totalOverlays).toBe(2);
      expect(result.summary.appliedOverlays).toBe(2);
    });

    it("detects conflicts across multiple overlays", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Rule 1",
            severity: "warning",
          },
          {
            id: "rule2",
            name: "Rule 2",
            severity: "info",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
        {
          selector: "rule[id=rule2]",
          set: { severity: "warning" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [
          {
            id: "rule1",
            name: "Rule 1",
            severity: "critical", // Changed upstream
          },
          {
            id: "rule2",
            name: "Rule 2",
            severity: "error", // Changed upstream
          },
        ],
      };

      const result = threeWayMerge(base, overlays, newBase);

      expect(result.success).toBe(false);
      expect(result.conflicts).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("handles empty overlay list", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [],
      };

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [],
      };

      const result = threeWayMerge(base, [], newBase);

      expect(result.success).toBe(true);
      expect(result.summary.totalOverlays).toBe(0);
    });

    it("handles identical base and newBase", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [
          {
            id: "rule1",
            name: "Test Rule",
          },
        ],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "rule[id=rule1]",
          set: { severity: "error" },
        },
      ];

      const result = threeWayMerge(base, overlays, base);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
    });

    it("handles non-rule selectors gracefully", () => {
      const base: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.0" },
        rules: [],
      };

      const overlays: OverlayDefinition[] = [
        {
          selector: "profile.name", // Non-rule selector
          set: { value: "custom" },
        },
      ];

      const newBase: AlignPack = {
        spec_version: "1",
        profile: { id: "test", version: "1.0.1" },
        rules: [],
      };

      const result = threeWayMerge(base, overlays, newBase);

      // Non-rule selectors are skipped for conflict detection
      expect(result.success).toBe(true);
    });
  });
});

describe("generatePatchFile", () => {
  it("generates patch with conflicts grouped by selector", () => {
    const conflicts: MergeConflict[] = [
      {
        type: "modified",
        selector: "rule[id=rule1]",
        propertyPath: "severity",
        baseValue: "warning",
        overlayValue: "error",
        newBaseValue: "critical",
        description: 'Property "severity" was modified upstream and locally',
        suggestion: "Review upstream change and update overlay if needed",
      },
      {
        type: "removed",
        selector: "rule[id=rule2]",
        propertyPath: "enabled",
        baseValue: true,
        overlayValue: false,
        newBaseValue: undefined,
        description:
          'Property "enabled" was removed upstream but is modified by overlay',
        suggestion:
          "Remove overlay or update selector to target different property",
      },
    ];

    const metadata = {
      baseHash: "abc123def456",
      newBaseHash: "789ghi012jkl",
      timestamp: "2025-10-30T12:00:00Z",
      source: "github.com/example/pack",
    };

    const patch = generatePatchFile(conflicts, metadata);

    expect(patch).toContain("# AlignTrue Overlay Merge Conflicts");
    expect(patch).toContain("# Generated: 2025-10-30T12:00:00Z");
    expect(patch).toContain("# Base: abc123de");
    expect(patch).toContain("# Updated: 789ghi01");
    expect(patch).toContain("# Source: github.com/example/pack");
    expect(patch).toContain("## Selector: rule[id=rule1]");
    expect(patch).toContain("## Selector: rule[id=rule2]");
    expect(patch).toContain("### MODIFIED: severity");
    expect(patch).toContain("### REMOVED: enabled");
    expect(patch).toContain("## Resolution Steps");
  });

  it("handles empty conflict list", () => {
    const metadata = {
      baseHash: "abc123",
      newBaseHash: "def456",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const patch = generatePatchFile([], metadata);

    expect(patch).toContain("# AlignTrue Overlay Merge Conflicts");
    expect(patch).toContain("## Resolution Steps");
  });

  it("includes all three values in patch", () => {
    const conflicts: MergeConflict[] = [
      {
        type: "modified",
        selector: "rule[id=test]",
        propertyPath: "value",
        baseValue: "old",
        overlayValue: "custom",
        newBaseValue: "new",
        description: "Conflict",
      },
    ];

    const metadata = {
      baseHash: "aaa",
      newBaseHash: "bbb",
      timestamp: "2025-10-30T12:00:00Z",
    };

    const patch = generatePatchFile(conflicts, metadata);

    expect(patch).toContain('base: "old"');
    expect(patch).toContain('overlay: "custom"');
    expect(patch).toContain('new_base: "new"');
  });
});
