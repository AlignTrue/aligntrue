/**
 * Test edge cases in YAML parsing
 */

import { describe, it, expect } from "vitest";
import { parseYamlToJson } from "../src/index.js";

describe("YAML Parsing Edge Cases", () => {
  it("parses empty YAML", () => {
    const result = parseYamlToJson("");
    console.log("Empty YAML:", typeof result, result);
    expect(result).toBeDefined();
  });

  it("parses YAML with only comments", () => {
    const yaml = `# Just a comment
# Another comment`;
    const result = parseYamlToJson(yaml);
    console.log("Comments only:", typeof result, result);
    expect(result).toBeDefined();
  });

  it("parses YAML with leading whitespace", () => {
    const yaml = `
id: test
version: 1.0.0`;
    const result = parseYamlToJson(yaml);
    console.log("Leading whitespace:", typeof result, result);
    expect(typeof result).toBe("object");
  });

  it("parses YAML document separator", () => {
    const yaml = `---
id: test
version: 1.0.0`;
    const result = parseYamlToJson(yaml);
    console.log("With separator:", typeof result, result);
    expect(typeof result).toBe("object");
  });

  it("parses multiple YAML documents", () => {
    const yaml = `---
id: test1
---
id: test2`;
    const result = parseYamlToJson(yaml);
    console.log("Multiple docs:", typeof result, result);
  });
});
