/**
 * Tests for JSON emitter
 */

import { describe, it, expect } from "vitest";
import { emitJson } from "../src/json.js";
import type { CheckResult } from "../src/types.js";
import type { AlignRule } from "@aligntrue/schema";

describe("emitJson", () => {
  const createCheckResult = (
    overrides: Partial<CheckResult> = {},
  ): CheckResult => ({
    rule: {
      id: "test-rule",
      severity: "error",
      check: {
        type: "file_presence",
        inputs: {},
        evidence: "Test evidence",
      },
    } as AlignRule,
    packId: "test/pack",
    pass: true,
    findings: [],
    ...overrides,
  });

  it("produces valid JSON findings structure", () => {
    const results: CheckResult[] = [];
    const json = emitJson(results);

    expect(json.summary).toBeDefined();
    expect(json.findings).toEqual([]);
    expect(json.errors).toEqual([]);
  });

  it("calculates summary statistics correctly", () => {
    const results = [
      createCheckResult({ pass: true }),
      createCheckResult({ pass: false, findings: [] }),
      createCheckResult({ pass: false, error: "Check failed" }),
    ];

    const json = emitJson(results);

    expect(json.summary.totalChecks).toBe(3);
    expect(json.summary.passed).toBe(1);
    expect(json.summary.failed).toBe(1);
    expect(json.summary.errors).toBe(1);
  });

  it("includes all findings from failed checks", () => {
    const results = [
      createCheckResult({
        pass: false,
        findings: [
          {
            packId: "test/pack",
            ruleId: "rule-1",
            severity: "error",
            evidence: "Evidence 1",
            message: "Finding 1",
            location: { path: "file1.ts" },
          },
        ],
      }),
      createCheckResult({
        pass: false,
        findings: [
          {
            packId: "test/pack",
            ruleId: "rule-2",
            severity: "warn",
            evidence: "Evidence 2",
            message: "Finding 2",
            location: { path: "file2.ts" },
          },
        ],
      }),
    ];

    const json = emitJson(results);

    expect(json.findings).toHaveLength(2);
    expect(json.findings[0].packId).toBe("test/pack");
    expect(json.findings[0].ruleId).toBe("rule-1");
    expect(json.findings[1].ruleId).toBe("rule-2");
  });

  it("includes errors from checks that could not run", () => {
    const results = [
      createCheckResult({
        pass: false,
        error: "File system error",
        findings: [],
      }),
      createCheckResult({
        pass: false,
        error: "Timeout exceeded",
        findings: [],
      }),
    ];

    const json = emitJson(results);

    expect(json.errors).toHaveLength(2);
    expect(json.errors[0].error).toBe("File system error");
    expect(json.errors[1].error).toBe("Timeout exceeded");
  });

  it("preserves finding details", () => {
    const results = [
      createCheckResult({
        pass: false,
        findings: [
          {
            packId: "packs/base/testing",
            ruleId: "require-tests",
            severity: "error",
            evidence: "Missing test file",
            message: "Test file not found for src/foo.ts",
            location: { path: "src/foo.ts", line: 1 },
            autofixHint: "Create test file",
          },
        ],
      }),
    ];

    const json = emitJson(results);
    const finding = json.findings[0];

    expect(finding.packId).toBe("packs/base/testing");
    expect(finding.ruleId).toBe("require-tests");
    expect(finding.severity).toBe("error");
    expect(finding.evidence).toBe("Missing test file");
    expect(finding.message).toBe("Test file not found for src/foo.ts");
    expect(finding.location.path).toBe("src/foo.ts");
    expect(finding.location.line).toBe(1);
    expect(finding.autofixHint).toBe("Create test file");
  });
});
