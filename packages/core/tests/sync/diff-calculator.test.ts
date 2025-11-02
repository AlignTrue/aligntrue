/**
 * Tests for rule diff calculation and formatting
 */

import { describe, it, expect } from "vitest";
import {
  calculateRuleDiff,
  formatDiffSummary,
  formatFullDiff,
  type RuleDiff,
} from "../../src/sync/diff-calculator.js";
import type { AlignRule } from "@aligntrue/schema";

describe("calculateRuleDiff", () => {
  it("detects added rules", () => {
    const before: AlignRule[] = [];
    const after: AlignRule[] = [
      {
        id: "test.new.rule",
        severity: "error",
        guidance: "Test rule",
      },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe("test.new.rule");
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });

  it("detects removed rules", () => {
    const before: AlignRule[] = [
      {
        id: "test.old.rule",
        severity: "warn",
        guidance: "Old rule",
      },
    ];
    const after: AlignRule[] = [];

    const diff = calculateRuleDiff(before, after);

    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.id).toBe("test.old.rule");
  });

  it("detects modified rules with severity change", () => {
    const before: AlignRule[] = [
      {
        id: "test.rule.one",
        severity: "warn",
        guidance: "Test guidance",
      },
    ];
    const after: AlignRule[] = [
      {
        id: "test.rule.one",
        severity: "error",
        guidance: "Test guidance",
      },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(1);
    expect(diff.removed).toHaveLength(0);

    const modified = diff.modified[0];
    expect(modified?.rule.id).toBe("test.rule.one");
    expect(modified?.changes).toContain("severity: warn → error");
  });

  it("detects modified rules with guidance change", () => {
    const before: AlignRule[] = [
      {
        id: "test.rule.two",
        severity: "error",
        guidance: "Original guidance",
      },
    ];
    const after: AlignRule[] = [
      {
        id: "test.rule.two",
        severity: "error",
        guidance: "Updated guidance with more content",
      },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.modified).toHaveLength(1);
    const modified = diff.modified[0];
    expect(modified?.changes.some((c) => c.includes("guidance:"))).toBe(true);
  });

  it("detects multiple changes in one rule", () => {
    const before: AlignRule[] = [
      {
        id: "test.rule.three",
        severity: "warn",
        guidance: "Short",
        tags: ["old-tag"],
      },
    ];
    const after: AlignRule[] = [
      {
        id: "test.rule.three",
        severity: "error",
        guidance: "Much longer guidance text here",
        tags: ["old-tag", "new-tag"],
      },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.modified).toHaveLength(1);
    const modified = diff.modified[0];
    expect(modified?.changes.length).toBeGreaterThan(1);
    expect(modified?.changes.some((c) => c.includes("severity:"))).toBe(true);
    expect(modified?.changes.some((c) => c.includes("guidance:"))).toBe(true);
    expect(modified?.changes.some((c) => c.includes("tags:"))).toBe(true);
  });

  it("handles complex diffs with all change types", () => {
    const before: AlignRule[] = [
      {
        id: "test.rule.keep",
        severity: "error",
        guidance: "Unchanged",
      },
      {
        id: "test.rule.modify",
        severity: "warn",
        guidance: "Before",
      },
      {
        id: "test.rule.remove",
        severity: "info",
        guidance: "Will be removed",
      },
    ];

    const after: AlignRule[] = [
      {
        id: "test.rule.keep",
        severity: "error",
        guidance: "Unchanged",
      },
      {
        id: "test.rule.modify",
        severity: "error",
        guidance: "After",
      },
      {
        id: "test.rule.add",
        severity: "warn",
        guidance: "New rule",
      },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]?.id).toBe("test.rule.add");

    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0]?.rule.id).toBe("test.rule.modify");

    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0]?.id).toBe("test.rule.remove");
  });

  it("returns deterministic sorted results", () => {
    const before: AlignRule[] = [];
    const after: AlignRule[] = [
      { id: "z.rule", severity: "error", guidance: "Z" },
      { id: "a.rule", severity: "error", guidance: "A" },
      { id: "m.rule", severity: "error", guidance: "M" },
    ];

    const diff = calculateRuleDiff(before, after);

    expect(diff.added[0]?.id).toBe("a.rule");
    expect(diff.added[1]?.id).toBe("m.rule");
    expect(diff.added[2]?.id).toBe("z.rule");
  });

  it("returns empty diff for identical rule sets", () => {
    const rules: AlignRule[] = [
      {
        id: "test.rule.one",
        severity: "error",
        guidance: "Test",
      },
    ];

    const diff = calculateRuleDiff(rules, rules);

    expect(diff.added).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
  });
});

describe("formatDiffSummary", () => {
  it("formats brief summary for added rules", () => {
    const diff: RuleDiff = {
      added: [
        { id: "test.rule.one", severity: "error", guidance: "Test 1" },
        { id: "test.rule.two", severity: "warn", guidance: "Test 2" },
      ],
      modified: [],
      removed: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0]).toContain("2 changes");
    expect(summary.some((l) => l.includes("+ Added: test.rule.one"))).toBe(
      true,
    );
    expect(summary.some((l) => l.includes("+ Added: test.rule.two"))).toBe(
      true,
    );
  });

  it("truncates long lists with ... and N more", () => {
    const diff: RuleDiff = {
      added: [
        { id: "rule.1", severity: "error", guidance: "1" },
        { id: "rule.2", severity: "error", guidance: "2" },
        { id: "rule.3", severity: "error", guidance: "3" },
        { id: "rule.4", severity: "error", guidance: "4" },
        { id: "rule.5", severity: "error", guidance: "5" },
      ],
      modified: [],
      removed: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary.some((l) => l.includes("... and 2 more"))).toBe(true);
  });

  it("shows no changes for empty diff", () => {
    const diff: RuleDiff = {
      added: [],
      modified: [],
      removed: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toBe("No changes");
  });

  it("formats modified rules with change summary", () => {
    const diff: RuleDiff = {
      added: [],
      modified: [
        {
          rule: { id: "test.rule", severity: "error", guidance: "Test" },
          changes: ["severity: warn → error", "guidance: modified"],
        },
      ],
      removed: [],
    };

    const summary = formatDiffSummary(diff);

    expect(summary.some((l) => l.includes("~ Modified: test.rule"))).toBe(true);
    expect(summary.some((l) => l.includes("(severity: warn → error)"))).toBe(
      true,
    );
  });
});

describe("formatFullDiff", () => {
  it("formats full diff with all details", () => {
    const diff: RuleDiff = {
      added: [
        {
          id: "test.new.rule",
          severity: "error",
          guidance: "New rule guidance",
        },
      ],
      modified: [
        {
          rule: { id: "test.mod.rule", severity: "warn", guidance: "Modified" },
          changes: ["severity: info → warn"],
        },
      ],
      removed: [
        {
          id: "test.old.rule",
          severity: "info",
          guidance: "Old rule",
        },
      ],
    };

    const fullDiff = formatFullDiff(diff);

    expect(fullDiff.some((l) => l.includes("Added rules:"))).toBe(true);
    expect(fullDiff.some((l) => l.includes("+ test.new.rule"))).toBe(true);
    expect(fullDiff.some((l) => l.includes("Severity: error"))).toBe(true);

    expect(fullDiff.some((l) => l.includes("Modified rules:"))).toBe(true);
    expect(fullDiff.some((l) => l.includes("~ test.mod.rule"))).toBe(true);

    expect(fullDiff.some((l) => l.includes("Removed rules:"))).toBe(true);
    expect(fullDiff.some((l) => l.includes("- test.old.rule"))).toBe(true);
  });

  it("truncates long guidance in preview", () => {
    const longGuidance = "A".repeat(100);
    const diff: RuleDiff = {
      added: [
        {
          id: "test.rule",
          severity: "error",
          guidance: longGuidance,
        },
      ],
      modified: [],
      removed: [],
    };

    const fullDiff = formatFullDiff(diff);
    const guidanceLine = fullDiff.find((l) => l.includes("Guidance:"));

    expect(guidanceLine).toBeDefined();
    expect(guidanceLine!.length).toBeLessThan(longGuidance.length + 20); // Allow for "Guidance: " prefix and "..."
    expect(guidanceLine).toContain("...");
  });
});
