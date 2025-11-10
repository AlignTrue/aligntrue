import { describe, it, expect } from "vitest";
import { validateAlignSchema, parseYamlToJson } from "../src/index.js";

describe("Plugs schema validation", () => {
  it("validates align pack with plugs slots", () => {
    const yaml = `
id: "test/base-pack"
version: "1.0.0"
spec_version: "1"
plugs:
  slots:
    test.cmd:
      description: "Command to run tests"
      format: command
      required: true
      example: "npm test"
    docs.url:
      description: "Documentation URL"
      format: url
      required: false
sections:
  - heading: "Testing"
    level: 2
    content: "Run [[plug:test.cmd]] to verify"
    fingerprint: "testing-abc"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates align pack with plugs fills", () => {
    const yaml = `
id: "test/stack-pack"
version: "1.0.0"
spec_version: "1"
plugs:
  fills:
    test.cmd: "pnpm test"
    docs.url: "https://docs.example.com"
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests for verification"
    fingerprint: "testing-xyz"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates align pack with both slots and fills", () => {
    const yaml = `
id: "test/combined-pack"
version: "1.0.0"
spec_version: "1"
plugs:
  slots:
    build.cmd:
      description: "Build command"
      format: command
      required: true
  fills:
    test.cmd: "pnpm test"
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests and build"
    fingerprint: "testing-combined"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("validates align pack without plugs", () => {
    const yaml = `
id: "test/no-plugs"
version: "1.0.0"
spec_version: "1"
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests"
    fingerprint: "testing-plain"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
  });

  it("rejects plug slot missing required fields", () => {
    const yaml = `
id: "test/invalid-slot"
version: "1.0.0"
spec_version: "1"
plugs:
  slots:
    test.cmd:
      description: "Test command"
      # missing format and required
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests"
    fingerprint: "testing-invalid"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.some((e) => e.path.includes("plugs"))).toBe(true);
  });

  it("rejects plug slot with invalid format", () => {
    const yaml = `
id: "test/invalid-format"
version: "1.0.0"
spec_version: "1"
plugs:
  slots:
    test.cmd:
      description: "Test command"
      format: invalid_format
      required: true
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests"
    fingerprint: "testing-badformat"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it("rejects empty plug fill", () => {
    const yaml = `
id: "test/empty-fill"
version: "1.0.0"
spec_version: "1"
plugs:
  fills:
    test.cmd: ""
sections:
  - heading: "Testing"
    level: 2
    content: "Run tests"
    fingerprint: "testing-emptyfill"
`;

    const obj = parseYamlToJson(yaml);
    const result = validateAlignSchema(obj);

    expect(result.valid).toBe(false);
    expect(result.errors).toBeDefined();
  });
});
