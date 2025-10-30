/**
 * Tests for SARIF emitter
 */

import { describe, it, expect } from "vitest";
import { emitSarif } from "../src/sarif.js";
import type { CheckResult } from "../src/types.js";
import type { AlignRule } from "@aligntrue/schema";

describe("emitSarif", () => {
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
    pass: false,
    findings: [],
    ...overrides,
  });

  it("produces valid SARIF 2.1.0 structure", () => {
    const results: CheckResult[] = [];
    const sarif = emitSarif(results);

    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toBe("https://json.schemastore.org/sarif-2.1.0.json");
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0].tool.driver.name).toBe("AlignTrue Checks");
  });

  it("maps severity error to error level", () => {
    const result = createCheckResult({
      rule: {
        id: "test-rule",
        severity: "error",
        check: {
          type: "file_presence",
          inputs: {},
          evidence: "Missing required file",
        },
      } as AlignRule,
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Missing required file",
          message: "File not found: test.txt",
          location: { path: "test.txt" },
        },
      ],
    });

    const sarif = emitSarif([result]);
    expect(sarif.runs[0].results[0].level).toBe("error");
  });

  it("maps severity warn to warning level", () => {
    const result = createCheckResult({
      rule: {
        id: "test-rule",
        severity: "warn",
        check: {
          type: "regex",
          inputs: {},
          evidence: "TODO found",
        },
      } as AlignRule,
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "warn",
          evidence: "TODO found",
          message: "TODO: fix this",
          location: { path: "src/foo.ts", line: 10 },
        },
      ],
    });

    const sarif = emitSarif([result]);
    expect(sarif.runs[0].results[0].level).toBe("warning");
  });

  it("maps severity info to note level", () => {
    const result = createCheckResult({
      rule: {
        id: "test-rule",
        severity: "info",
        check: {
          type: "file_presence",
          inputs: {},
          evidence: "Optional file missing",
        },
      } as AlignRule,
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "info",
          evidence: "Optional file missing",
          message: "Consider adding README",
          location: { path: "." },
        },
      ],
    });

    const sarif = emitSarif([result]);
    expect(sarif.runs[0].results[0].level).toBe("note");
  });

  it("formats ruleId as packId/ruleId", () => {
    const result = createCheckResult({
      packId: "packs/base/testing",
      rule: {
        id: "require-tests",
        severity: "error",
        check: {
          type: "file_presence",
          inputs: {},
          evidence: "Missing tests",
        },
      } as AlignRule,
      findings: [
        {
          packId: "packs/base/testing",
          ruleId: "require-tests",
          severity: "error",
          evidence: "Missing tests",
          message: "No test files found",
          location: { path: "." },
        },
      ],
    });

    const sarif = emitSarif([result]);
    expect(sarif.runs[0].results[0].ruleId).toBe(
      "packs/base/testing/require-tests",
    );
  });

  it("includes location with line numbers when present", () => {
    const result = createCheckResult({
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Issue found",
          message: "Problem at line 42",
          location: { path: "src/foo.ts", line: 42, column: 10 },
        },
      ],
    });

    const sarif = emitSarif([result]);
    const location = sarif.runs[0].results[0].locations![0];

    expect(location.physicalLocation.artifactLocation.uri).toBe("src/foo.ts");
    expect(location.physicalLocation.region?.startLine).toBe(42);
    expect(location.physicalLocation.region?.startColumn).toBe(10);
  });

  it("omits region when no line number", () => {
    const result = createCheckResult({
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Issue found",
          message: "File-level issue",
          location: { path: "package.json" },
        },
      ],
    });

    const sarif = emitSarif([result]);
    const location = sarif.runs[0].results[0].locations![0];

    expect(location.physicalLocation.region).toBeUndefined();
  });

  it("includes rule definitions", () => {
    const result = createCheckResult({
      rule: {
        id: "test-rule",
        severity: "error",
        check: {
          type: "file_presence",
          inputs: {},
          evidence: "Test evidence message",
        },
      } as AlignRule,
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Test evidence message",
          message: "Finding message",
          location: { path: "." },
        },
      ],
    });

    const sarif = emitSarif([result]);
    const rules = sarif.runs[0].tool.driver.rules!;

    expect(rules).toHaveLength(1);
    expect(rules[0].id).toBe("test/pack/test-rule");
    expect(rules[0].shortDescription?.text).toBe("Test evidence message");
  });

  it("deduplicates rule definitions", () => {
    const result1 = createCheckResult({
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Evidence",
          message: "Finding 1",
          location: { path: "file1.ts" },
        },
      ],
    });

    const result2 = createCheckResult({
      findings: [
        {
          packId: "test/pack",
          ruleId: "test-rule",
          severity: "error",
          evidence: "Evidence",
          message: "Finding 2",
          location: { path: "file2.ts" },
        },
      ],
    });

    const sarif = emitSarif([result1, result2]);
    const rules = sarif.runs[0].tool.driver.rules!;

    expect(rules).toHaveLength(1);
    expect(sarif.runs[0].results).toHaveLength(2);
  });
});
