/**
 * Test minimal valid align validation
 * Reproduces the "(root): must be object" error from team mode testing
 */

import { describe, it, expect } from "vitest";
import { validateAlignSchema, parseYamlToJson } from "../src/index.js";

describe("Minimal Align Validation", () => {
  it("validates minimal YAML align with sections", () => {
    const yaml = `id: test-project
version: 1.0.0
spec_version: "1"
sections:
  - heading: "Linting"
    level: 2
    content: "Enforce linting standards"
    fingerprint: "linting-abc123"`;

    const parsed = parseYamlToJson(yaml);
    const result = validateAlignSchema(parsed);

    if (!result.valid) {
      console.log("Validation errors:", result.errors);
    }

    expect(result.valid).toBe(true);
  });

  it("validates minimal object align with sections", () => {
    const align = {
      id: "test-project",
      version: "1.0.0",
      spec_version: "1",
      sections: [
        {
          heading: "Linting",
          level: 2,
          content: "Enforce linting standards",
          fingerprint: "linting-xyz789",
        },
      ],
    };

    const result = validateAlignSchema(align);

    if (!result.valid) {
      console.log("Validation errors:", result.errors);
    }

    expect(result.valid).toBe(true);
  });
});
