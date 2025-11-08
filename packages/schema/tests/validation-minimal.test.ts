/**
 * Test minimal valid pack validation
 * Reproduces the "(root): must be object" error from team mode testing
 */

import { describe, it, expect } from "vitest";
import { validateAlignSchema, parseYamlToJson } from "../src/index.js";

describe("Minimal Pack Validation", () => {
  it("validates minimal YAML pack", () => {
    const yaml = `id: test-project
version: 1.0.0
spec_version: "1"
rules:
  - id: test.rule
    severity: warn
    applies_to: ["**/*.ts"]
    guidance: Test rule`;

    const parsed = parseYamlToJson(yaml);
    console.log("Parsed type:", typeof parsed);
    console.log("Parsed value:", JSON.stringify(parsed, null, 2));

    const result = validateAlignSchema(parsed);

    if (!result.valid) {
      console.log("Validation errors:", result.errors);
    }

    expect(result.valid).toBe(true);
  });

  it("validates minimal object pack", () => {
    const pack = {
      id: "test-project",
      version: "1.0.0",
      spec_version: "1",
      rules: [
        {
          id: "test.rule",
          severity: "warn",
          applies_to: ["**/*.ts"],
          guidance: "Test rule",
        },
      ],
    };

    const result = validateAlignSchema(pack);

    if (!result.valid) {
      console.log("Validation errors:", result.errors);
    }

    expect(result.valid).toBe(true);
  });
});
