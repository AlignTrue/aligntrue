/**
 * Tests for import coverage analysis
 */

import { describe, it, expect } from "vitest";
import type { AlignRule } from "@aligntrue/schema";
import {
  analyzeCursorCoverage,
  analyzeAgentsMdCoverage,
  calculateConfidence,
  formatCoverageReport,
} from "../src/coverage.js";

describe("analyzeCursorCoverage", () => {
  it("should analyze coverage for basic rules", () => {
    const rules: AlignRule[] = [
      {
        id: "test-rule",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "Test guidance",
      },
    ];

    const report = analyzeCursorCoverage(rules);

    expect(report.agent).toBe("cursor");
    expect(report.rulesImported).toBe(1);
    expect(report.coveragePercentage).toBe(71); // 5/7 fields
    expect(report.confidence).toBe("medium");
    expect(report.vendorPreserved).toBe(false);
  });

  it("should detect vendor.cursor metadata", () => {
    const rules: AlignRule[] = [
      {
        id: "test-rule",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "Test guidance",
        vendor: {
          cursor: {
            ai_hint: "Use TypeScript",
          },
        },
      },
    ];

    const report = analyzeCursorCoverage(rules);

    expect(report.vendorPreserved).toBe(true);
  });

  it("should list mapped fields correctly", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "info",
        applies_to: ["**/*"],
      },
    ];

    const report = analyzeCursorCoverage(rules);

    expect(report.mappedFields).toHaveLength(7);

    const mappedFieldNames = report.mappedFields
      .filter((f) => f.mapped)
      .map((f) => f.irField);

    expect(mappedFieldNames).toContain("id");
    expect(mappedFieldNames).toContain("severity");
    expect(mappedFieldNames).toContain("applies_to");
    expect(mappedFieldNames).toContain("guidance");
    expect(mappedFieldNames).toContain("vendor");
  });

  it("should list unmapped fields correctly", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "info",
        applies_to: ["**/*"],
      },
    ];

    const report = analyzeCursorCoverage(rules);

    expect(report.unmappedFields).toHaveLength(2);

    const unmappedFieldNames = report.unmappedFields.map((f) => f.irField);
    expect(unmappedFieldNames).toContain("check");
    expect(unmappedFieldNames).toContain("tags");
  });
});

describe("analyzeAgentsMdCoverage", () => {
  it("should analyze coverage for basic rules", () => {
    const rules: AlignRule[] = [
      {
        id: "test-rule",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "Test guidance",
      },
    ];

    const report = analyzeAgentsMdCoverage(rules);

    expect(report.agent).toBe("agents-md");
    expect(report.rulesImported).toBe(1);
    expect(report.coveragePercentage).toBe(71); // 5/7 fields
    expect(report.confidence).toBe("medium");
    expect(report.vendorPreserved).toBe(false); // AGENTS.md doesn't preserve vendor
  });

  it("should never show vendor preserved for AGENTS.md", () => {
    const rules: AlignRule[] = [
      {
        id: "test-rule",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "Test guidance",
        vendor: {
          cursor: {
            ai_hint: "This should not matter",
          },
        },
      },
    ];

    const report = analyzeAgentsMdCoverage(rules);

    // AGENTS.md universal format doesn't preserve vendor metadata
    expect(report.vendorPreserved).toBe(false);
  });

  it("should list mapped fields correctly", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "info",
        applies_to: ["**/*"],
      },
    ];

    const report = analyzeAgentsMdCoverage(rules);

    expect(report.mappedFields).toHaveLength(7);

    const mappedFieldNames = report.mappedFields
      .filter((f) => f.mapped)
      .map((f) => f.irField);

    expect(mappedFieldNames).toContain("id");
    expect(mappedFieldNames).toContain("severity");
    expect(mappedFieldNames).toContain("applies_to");
    expect(mappedFieldNames).toContain("guidance");
    expect(mappedFieldNames).toContain("vendor");
  });

  it("should list unmapped fields correctly", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "info",
        applies_to: ["**/*"],
      },
    ];

    const report = analyzeAgentsMdCoverage(rules);

    expect(report.unmappedFields).toHaveLength(2);

    const unmappedFieldNames = report.unmappedFields.map((f) => f.irField);
    expect(unmappedFieldNames).toContain("check");
    expect(unmappedFieldNames).toContain("tags");
  });
});

describe("calculateConfidence", () => {
  it("should return high for ≥90% coverage", () => {
    expect(calculateConfidence(7, 7)).toBe("high"); // 100%
    expect(calculateConfidence(9, 10)).toBe("high"); // 90%
  });

  it("should return medium for 70-89% coverage", () => {
    expect(calculateConfidence(8, 10)).toBe("medium"); // 80%
    expect(calculateConfidence(7, 10)).toBe("medium"); // 70%
  });

  it("should return low for <70% coverage", () => {
    expect(calculateConfidence(6, 10)).toBe("low"); // 60%
    expect(calculateConfidence(3, 10)).toBe("low"); // 30%
  });
});

describe("formatCoverageReport", () => {
  it("should format cursor coverage report", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "error",
        applies_to: ["**/*.ts"],
        guidance: "Test",
      },
    ];

    const report = analyzeCursorCoverage(rules);
    const formatted = formatCoverageReport(report);

    expect(formatted).toContain("Import Coverage Report: cursor");
    expect(formatted).toContain("Imported: 1 rules from .cursor/rules/*.mdc");
    expect(formatted).toContain("Field Mapping:");
    expect(formatted).toContain("✓ id");
    expect(formatted).toContain("✓ severity");
    expect(formatted).toContain("✓ applies_to");
    expect(formatted).toContain("✓ guidance");
    expect(formatted).toContain("✓ vendor");
    expect(formatted).toContain("⚠ Unmapped Fields");
    expect(formatted).toContain("• check");
    expect(formatted).toContain("• tags");
    expect(formatted).toContain("Coverage: 71%");
    expect(formatted).toContain("Confidence: Medium");
  });

  it("should format agents-md coverage report", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "warn",
        applies_to: ["**/*"],
      },
    ];

    const report = analyzeAgentsMdCoverage(rules);
    const formatted = formatCoverageReport(report);

    expect(formatted).toContain("Import Coverage Report: agents-md");
    expect(formatted).toContain("Imported: 1 rules from AGENTS.md");
    expect(formatted).toContain("Field Mapping:");
    expect(formatted).toContain("Coverage: 71%");
    expect(formatted).toContain("Confidence: Medium (70-89% coverage)");
  });

  it("should show vendor preserved message for cursor with vendor metadata", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "error",
        applies_to: ["**/*.ts"],
        vendor: {
          cursor: {
            ai_hint: "Test",
          },
        },
      },
    ];

    const report = analyzeCursorCoverage(rules);
    const formatted = formatCoverageReport(report);

    expect(formatted).toContain(
      "✓ Vendor metadata preserved for round-trip fidelity",
    );
  });

  it("should not show vendor preserved message when no vendor metadata", () => {
    const rules: AlignRule[] = [
      {
        id: "test",
        severity: "error",
        applies_to: ["**/*.ts"],
      },
    ];

    const report = analyzeCursorCoverage(rules);
    const formatted = formatCoverageReport(report);

    expect(formatted).not.toContain("Vendor metadata preserved");
  });
});
