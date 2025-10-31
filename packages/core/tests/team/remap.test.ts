/**
 * Tests for severity remapping functionality
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  parseTeamYaml,
  validateRemaps,
  hasValidTeamYaml,
  applySeverityRemap,
  type SeverityRemap,
} from "../../src/team/remap.js";

describe("parseTeamYaml", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "test-remap-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("parses valid team.yaml with remaps", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "no-console"
    from: "MUST"
    to: "warn"
    rationale_file: "RATIONALE.md"
  - rule_id: "prefer-const"
    from: "SHOULD"
    to: "info"
`,
    );

    const result = parseTeamYaml(teamYamlPath);

    expect(result.severity_remaps).toHaveLength(2);
    expect(result.severity_remaps[0]).toEqual({
      rule_id: "no-console",
      from: "MUST",
      to: "warn",
      rationale_file: "RATIONALE.md",
    });
    expect(result.severity_remaps[1]).toEqual({
      rule_id: "prefer-const",
      from: "SHOULD",
      to: "info",
    });
  });

  it("parses empty team.yaml", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(teamYamlPath, "");

    const result = parseTeamYaml(teamYamlPath);

    expect(result.severity_remaps).toEqual([]);
  });

  it("parses team.yaml without severity_remaps field", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(teamYamlPath, "other_field: value");

    const result = parseTeamYaml(teamYamlPath);

    expect(result.severity_remaps).toEqual([]);
  });

  it("throws error if file does not exist", () => {
    const teamYamlPath = join(tempDir, "missing.yaml");

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "Team configuration not found",
    );
  });

  it("throws error if YAML is invalid", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(teamYamlPath, "invalid: yaml: syntax: ::::");

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "Failed to parse team YAML",
    );
  });

  it("throws error if severity_remaps is not an array", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(teamYamlPath, "severity_remaps: not_an_array");

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "severity_remaps must be an array",
    );
  });

  it("throws error if remap entry is missing rule_id", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - from: "MUST"
    to: "warn"
`,
    );

    expect(() => parseTeamYaml(teamYamlPath)).toThrow("rule_id is required");
  });

  it("throws error if from severity is invalid", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "test"
    from: "INVALID"
    to: "warn"
`,
    );

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "from must be one of: MUST, SHOULD, MAY",
    );
  });

  it("throws error if to severity is invalid", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "invalid"
`,
    );

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "to must be one of: error, warn, info",
    );
  });

  it("throws error if rationale_file is not a string", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "warn"
    rationale_file: 123
`,
    );

    expect(() => parseTeamYaml(teamYamlPath)).toThrow(
      "rationale_file must be a string",
    );
  });
});

describe("validateRemaps", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "test-validate-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns no errors for valid remaps without guardrail triggers", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "test1", from: "MUST", to: "warn" },
      { rule_id: "test2", from: "SHOULD", to: "info" },
      { rule_id: "test3", from: "MAY", to: "info" },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toEqual([]);
  });

  it("returns error when MUST→info without rationale_file", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "dangerous-rule", from: "MUST", to: "info" },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toHaveLength(1);
    expect(errors[0].rule_id).toBe("dangerous-rule");
    expect(errors[0].error).toContain("requires rationale_file");
    expect(errors[0].suggestion).toContain("RATIONALE.md");
  });

  it("returns error when rationale file does not exist", () => {
    const remaps: SeverityRemap[] = [
      {
        rule_id: "dangerous-rule",
        from: "MUST",
        to: "info",
        rationale_file: "MISSING_RATIONALE.md",
      },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toHaveLength(1);
    expect(errors[0].rule_id).toBe("dangerous-rule");
    expect(errors[0].error).toContain("Rationale file not found");
    expect(errors[0].error).toContain("MISSING_RATIONALE.md");
  });

  it("returns no error when MUST→info with existing rationale file", () => {
    const rationaleFile = join(tempDir, "RATIONALE.md");
    writeFileSync(rationaleFile, "# Rationale\n\nIssue: #123\n\nReason here");

    const remaps: SeverityRemap[] = [
      {
        rule_id: "rule-with-rationale",
        from: "MUST",
        to: "info",
        rationale_file: "RATIONALE.md",
      },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toEqual([]);
  });

  it("allows MUST→warn without rationale (not lowering below warn)", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "test", from: "MUST", to: "warn" },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toEqual([]);
  });

  it("allows MUST→error without rationale (not lowering)", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "test", from: "MUST", to: "error" },
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toEqual([]);
  });

  it("validates multiple remaps with mixed results", () => {
    const rationaleFile = join(tempDir, "GOOD_RATIONALE.md");
    writeFileSync(rationaleFile, "Valid rationale");

    const remaps: SeverityRemap[] = [
      { rule_id: "valid1", from: "SHOULD", to: "info" },
      { rule_id: "valid2", from: "MUST", to: "warn" },
      {
        rule_id: "valid3",
        from: "MUST",
        to: "info",
        rationale_file: "GOOD_RATIONALE.md",
      },
      { rule_id: "invalid1", from: "MUST", to: "info" }, // Missing rationale
      {
        rule_id: "invalid2",
        from: "MUST",
        to: "info",
        rationale_file: "MISSING.md",
      }, // File not found
    ];

    const errors = validateRemaps(remaps, tempDir);

    expect(errors).toHaveLength(2);
    expect(errors[0].rule_id).toBe("invalid1");
    expect(errors[1].rule_id).toBe("invalid2");
  });
});

describe("hasValidTeamYaml", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "test-has-valid-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns true for valid team.yaml", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "test"
    from: "MUST"
    to: "warn"
`,
    );

    expect(hasValidTeamYaml(teamYamlPath)).toBe(true);
  });

  it("returns false for missing file", () => {
    const teamYamlPath = join(tempDir, "missing.yaml");

    expect(hasValidTeamYaml(teamYamlPath)).toBe(false);
  });

  it("returns false for invalid YAML", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(teamYamlPath, "invalid: yaml: syntax: ::::");

    expect(hasValidTeamYaml(teamYamlPath)).toBe(false);
  });

  it("returns false for invalid schema", () => {
    const teamYamlPath = join(tempDir, ".aligntrue.team.yaml");
    writeFileSync(
      teamYamlPath,
      `
severity_remaps:
  - rule_id: "test"
    from: "INVALID_SEVERITY"
    to: "warn"
`,
    );

    expect(hasValidTeamYaml(teamYamlPath)).toBe(false);
  });
});

describe("applySeverityRemap", () => {
  it("applies exact remap match", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "no-console", from: "MUST", to: "warn" },
    ];

    const result = applySeverityRemap("no-console", "MUST", remaps);

    expect(result).toBe("warn");
  });

  it("returns default mapping when no remap found", () => {
    const remaps: SeverityRemap[] = [];

    expect(applySeverityRemap("any-rule", "MUST", remaps)).toBe("error");
    expect(applySeverityRemap("any-rule", "SHOULD", remaps)).toBe("warn");
    expect(applySeverityRemap("any-rule", "MAY", remaps)).toBe("info");
  });

  it("does not apply remap when rule_id does not match", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "no-console", from: "MUST", to: "warn" },
    ];

    const result = applySeverityRemap("different-rule", "MUST", remaps);

    expect(result).toBe("error"); // Default mapping
  });

  it("does not apply remap when from severity does not match", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "no-console", from: "MUST", to: "warn" },
    ];

    const result = applySeverityRemap("no-console", "SHOULD", remaps);

    expect(result).toBe("warn"); // Default mapping for SHOULD
  });

  it("applies first matching remap when multiple exist", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "test", from: "MUST", to: "warn" },
      { rule_id: "test", from: "MUST", to: "note" }, // Duplicate (invalid config, but test behavior)
    ];

    const result = applySeverityRemap("test", "MUST", remaps);

    expect(result).toBe("warn"); // First match wins
  });

  it("handles all severity level mappings", () => {
    const remaps: SeverityRemap[] = [
      { rule_id: "rule1", from: "MUST", to: "info" },
      { rule_id: "rule2", from: "SHOULD", to: "error" },
      { rule_id: "rule3", from: "MAY", to: "warn" },
    ];

    expect(applySeverityRemap("rule1", "MUST", remaps)).toBe("info");
    expect(applySeverityRemap("rule2", "SHOULD", remaps)).toBe("error");
    expect(applySeverityRemap("rule3", "MAY", remaps)).toBe("warn");
  });
});
