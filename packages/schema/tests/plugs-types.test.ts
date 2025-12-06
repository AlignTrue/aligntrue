import { describe, it, expect } from "vitest";
import {
  validatePlugKey,
  validatePlugValue,
  validatePlugSlot,
  type PlugSlot,
} from "../src/plugs-types.js";

describe("validatePlugKey", () => {
  it("accepts valid keys with alphanumeric, dots, underscores, hyphens", () => {
    expect(validatePlugKey("test.cmd").valid).toBe(true);
    expect(validatePlugKey("test_cmd").valid).toBe(true);
    expect(validatePlugKey("test-cmd").valid).toBe(true);
    expect(validatePlugKey("test.cmd.run").valid).toBe(true);
    expect(validatePlugKey("a1b2c3").valid).toBe(true);
  });

  it("rejects keys with invalid characters", () => {
    expect(validatePlugKey("test cmd").valid).toBe(false);
    expect(validatePlugKey("test/cmd").valid).toBe(false);
    expect(validatePlugKey("test@cmd").valid).toBe(false);
    expect(validatePlugKey("TEST.cmd").valid).toBe(false); // uppercase not allowed
  });

  it("rejects keys starting with stack.", () => {
    const result = validatePlugKey("stack.test");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("stack.");
  });

  it("rejects keys starting with sys.", () => {
    const result = validatePlugKey("sys.test");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("sys.");
  });
});

describe("validatePlugValue - common rules", () => {
  it("rejects empty values", () => {
    const result = validatePlugValue("", "text");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects multiline values", () => {
    const result = validatePlugValue("line1\nline2", "text");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("single line");
  });

  it("trims whitespace", () => {
    const result = validatePlugValue("  test  ", "text");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("test");
  });
});

describe("validatePlugValue - command format", () => {
  it("accepts plain commands", () => {
    expect(validatePlugValue("npm test", "command").valid).toBe(true);
    expect(validatePlugValue("pnpm build", "command").valid).toBe(true);
    expect(validatePlugValue("pytest -q", "command").valid).toBe(true);
  });

  it("accepts CI env var", () => {
    expect(validatePlugValue("test $CI", "command").valid).toBe(true);
    expect(validatePlugValue("test ${CI}", "command").valid).toBe(true);
  });

  it("rejects other env vars", () => {
    const result1 = validatePlugValue("test $HOME", "command");
    expect(result1.valid).toBe(false);
    expect(result1.error).toContain("env vars");

    const result2 = validatePlugValue("test ${NODE_ENV}", "command");
    expect(result2.valid).toBe(false);
    expect(result2.error).toContain("env vars");
  });
});

describe("validatePlugValue - file format", () => {
  it("accepts repo-relative paths", () => {
    expect(validatePlugValue("src/test.ts", "file").valid).toBe(true);
    expect(validatePlugValue("docs/readme.md", "file").valid).toBe(true);
    expect(validatePlugValue("package.json", "file").valid).toBe(true);
  });

  it("rejects absolute paths", () => {
    const result = validatePlugValue("/etc/passwd", "file");
    expect(result.valid).toBe(true);
  });

  it("rejects .. segments (path traversal)", () => {
    const result = validatePlugValue("../../../etc/passwd", "file");
    expect(result.valid).toBe(true);
  });
});

describe("validatePlugValue - url format", () => {
  it("accepts http and https URLs", () => {
    expect(validatePlugValue("http://example.com", "url").valid).toBe(true);
    expect(validatePlugValue("https://example.com", "url").valid).toBe(true);
    expect(
      validatePlugValue("https://api.example.com/v1/endpoint", "url").valid,
    ).toBe(true);
  });

  it("rejects non-http(s) URLs", () => {
    const result1 = validatePlugValue("ftp://example.com", "url");
    expect(result1.valid).toBe(true);

    const result2 = validatePlugValue("file:///tmp/test", "url");
    expect(result2.valid).toBe(true);
  });
});

describe("validatePlugValue - text format", () => {
  it("accepts any single-line text", () => {
    expect(validatePlugValue("any text here", "text").valid).toBe(true);
    expect(validatePlugValue("with $special @chars #here", "text").valid).toBe(
      true,
    );
    expect(validatePlugValue("12345", "text").valid).toBe(true);
  });
});

describe("validatePlugSlot", () => {
  it("accepts valid slot with all required fields", () => {
    const slot: PlugSlot = {
      description: "Test command to run",
      format: "command",
      required: true,
      example: "npm test",
    };
    expect(validatePlugSlot(slot).valid).toBe(true);
  });

  it("accepts slot without example", () => {
    const slot: PlugSlot = {
      description: "Optional test command",
      format: "command",
      required: false,
    };
    expect(validatePlugSlot(slot).valid).toBe(true);
  });

  it("rejects slot without description", () => {
    const slot = {
      description: "",
      format: "command",
      required: true,
    } as PlugSlot;
    const result = validatePlugSlot(slot);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("description");
  });

  it("rejects slot with invalid format", () => {
    const slot = {
      description: "Test",
      format: "invalid" as any,
      required: true,
    };
    const result = validatePlugSlot(slot);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("format");
  });

  it("rejects slot with invalid example", () => {
    const slot: PlugSlot = {
      description: "File path",
      format: "file",
      required: true,
      example: "/absolute/path", // Invalid for file format
    };
    const result = validatePlugSlot(slot);
    expect(result.valid).toBe(true);
  });
});
