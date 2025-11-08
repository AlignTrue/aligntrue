/**
 * Regression tests for schema validation
 * Prevents issues found during clean environment testing
 */

import { describe, it, expect } from "vitest";
import { parseYamlToJson, validateAlignSchema } from "../src/index.js";

describe("Schema Validation Regression Tests", () => {
  it("should parse valid YAML and return an object", () => {
    const yaml = `
id: "test.rules.example"
version: "1.0.0"
spec_version: "1"
rules:
  - id: "test.rule.one"
    severity: "error"
    applies_to: ["**/*.ts"]
    guidance: "Test rule"
`;

    const parsed = parseYamlToJson(yaml);

    expect(typeof parsed).toBe("object");
    expect(parsed).not.toBeNull();
    expect(Array.isArray(parsed)).toBe(false);
    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("rules");
  });

  it("should validate a minimal valid pack", () => {
    const pack = {
      id: "test.rules.minimal",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.one",
          severity: "error",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(true);
  });

  it("should reject old severity values (MUST/SHOULD/MAY)", () => {
    const pack = {
      id: "test.rules.old-severity",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.one",
          severity: "MUST", // Old format
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.path.includes("severity"))).toBe(true);
  });

  it("should require applies_to field on rules", () => {
    const pack = {
      id: "test.rules.missing-applies-to",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule.one",
          severity: "error",
          // Missing applies_to
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.message.includes("applies_to"))).toBe(
      true,
    );
  });

  it("should require 3-segment rule IDs", () => {
    const pack = {
      id: "test.rules.invalid-id",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "single-segment", // Invalid: only 1 segment
          severity: "error",
          applies_to: ["**/*.ts"],
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.path.includes("/rules/0/id"))).toBe(
      true,
    );
  });

  it("should validate file_presence check with paths field", () => {
    const pack = {
      id: "test.rules.file-presence",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.file.presence",
          severity: "error",
          applies_to: ["**/*"],
          check: {
            type: "file_presence",
            inputs: {
              paths: [".github/workflows/*.yml"],
            },
          },
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(true);
  });

  it("should validate regex check with include field", () => {
    const pack = {
      id: "test.rules.regex",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.regex.check",
          severity: "warn",
          applies_to: ["**/*"],
          check: {
            type: "regex",
            inputs: {
              include: [".git/COMMIT_EDITMSG"],
              pattern: "^(feat|fix):",
              allow: true,
            },
          },
        },
      ],
    };

    const result = validateAlignSchema(pack);
    expect(result.valid).toBe(true);
  });

  it("should accept all valid severity values", () => {
    const severities = ["error", "warn", "info"];

    for (const severity of severities) {
      const pack = {
        id: `test.rules.${severity}`,
        version: "1.0.0",
        spec_version: "1",
        rules: [
          {
            id: "test.rule.one",
            severity,
            applies_to: ["**/*.ts"],
          },
        ],
      };

      const result = validateAlignSchema(pack);
      expect(result.valid).toBe(true, `severity "${severity}" should be valid`);
    }
  });
});
