/**
 * Tests for plugs fill validation
 */

import { describe, it, expect } from "vitest";
import {
  validateCommand,
  validateFile,
  validateUrl,
  validateText,
  validateFill,
} from "../../src/plugs/validator.js";

describe("validateCommand", () => {
  it("accepts valid commands", () => {
    expect(validateCommand("pnpm test")).toEqual({ valid: true });
    expect(validateCommand("pytest -q")).toEqual({ valid: true });
    expect(validateCommand("cargo build --release")).toEqual({ valid: true });
    expect(validateCommand("npm run test:ci")).toEqual({ valid: true });
  });

  it("rejects empty commands", () => {
    const result = validateCommand("");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("empty");
  });

  it("rejects absolute paths", () => {
    const result1 = validateCommand("/usr/bin/test");
    expect(result1.valid).toBe(false);
    expect(result1.errors?.[0].message).toContain("absolute");

    const result2 = validateCommand("C:\\Program Files\\test.exe");
    expect(result2.valid).toBe(false);
    expect(result2.errors?.[0].message).toContain("absolute");
  });

  it("rejects parent directory traversal", () => {
    const result = validateCommand("../scripts/test.sh");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("parent directory");
  });
});

describe("validateFile", () => {
  it("accepts valid relative paths", () => {
    expect(validateFile("config/settings.json")).toEqual({ valid: true });
    expect(validateFile("docs/README.md")).toEqual({ valid: true });
    expect(validateFile("src/index.ts")).toEqual({ valid: true });
  });

  it("rejects empty paths", () => {
    const result = validateFile("");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("empty");
  });

  it("rejects absolute paths", () => {
    const result1 = validateFile("/etc/config.json");
    expect(result1.valid).toBe(false);
    expect(result1.errors?.[0].message).toContain("absolute");

    const result2 = validateFile("C:\\config\\settings.json");
    expect(result2.valid).toBe(false);
    expect(result2.errors?.[0].message).toContain("absolute");
  });

  it("rejects parent directory traversal", () => {
    const result = validateFile("../secrets.json");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("parent directory");
  });
});

describe("validateUrl", () => {
  it("accepts valid URLs", () => {
    expect(validateUrl("https://docs.example.com")).toEqual({ valid: true });
    expect(validateUrl("http://localhost:3000")).toEqual({ valid: true });
    expect(validateUrl("https://github.com/org/repo")).toEqual({ valid: true });
  });

  it("rejects empty URLs", () => {
    const result = validateUrl("");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("empty");
  });

  it("rejects URLs without protocol", () => {
    const result = validateUrl("example.com");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("Invalid URL");
  });

  it("rejects invalid protocols", () => {
    const result = validateUrl("ftp://example.com");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("protocol");
  });

  it("rejects malformed URLs", () => {
    const result = validateUrl("not a url");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("Invalid URL");
  });
});

describe("validateText", () => {
  it("accepts any non-empty string", () => {
    expect(validateText("John Doe")).toEqual({ valid: true });
    expect(validateText("Acme Corp")).toEqual({ valid: true });
    expect(validateText("v1.0.0")).toEqual({ valid: true });
    expect(validateText("Special chars: !@#$%")).toEqual({ valid: true });
  });

  it("rejects empty text", () => {
    const result = validateText("");
    expect(result.valid).toBe(false);
    expect(result.errors?.[0].message).toContain("empty");
  });
});

describe("validateFill", () => {
  it("validates command format", () => {
    expect(validateFill("pnpm test", "command")).toEqual({ valid: true });
    expect(validateFill("/usr/bin/test", "command").valid).toBe(false);
  });

  it("validates file format", () => {
    expect(validateFill("config/settings.json", "file")).toEqual({
      valid: true,
    });
    expect(validateFill("/etc/config.json", "file").valid).toBe(false);
  });

  it("validates url format", () => {
    expect(validateFill("https://example.com", "url")).toEqual({ valid: true });
    expect(validateFill("example.com", "url").valid).toBe(false);
  });

  it("validates text format by default", () => {
    expect(validateFill("any text", "text")).toEqual({ valid: true });
    expect(validateFill("any text")).toEqual({ valid: true }); // default format
  });
});
